// DLNA/UPnP Device Discovery Service
// HTTP-based UPnP device discovery for Chrome MV3
// Chrome MV3 removed chrome.sockets.udp, so we use HTTP probing instead of SSDP multicast

import { CastingDevice, DeviceType } from '@shared/types';
import { HTTP_DISCOVERY_TIMEOUT } from '@shared/constants';
import { generateUUID } from '@shared/utils';

export interface DiscoveryOptions {
  timeout?: number;
  searchTarget?: string;
  onDeviceFound?: (device: CastingDevice) => void;
  onDiscoveryStart?: () => void;
  onDiscoveryEnd?: (devices: CastingDevice[]) => void;
  onError?: (error: Error) => void;
  fastResolveOnFirstDevice?: boolean;
}

// - port 49152: standard UPnP dynamic port start (MateTV HarmonyOS, etc.)
// - port 5000:  common UPnP/DLNA control port
// - port 8008:  Chromecast / Android TV (DIAL)
// - port 2869:  Windows Media Player / UPnP
// - port 1076:  XGIMI projector, some Xiaomi TVs, and other devices
// Keep this list probability-ordered because targets are generated port-first.
const UPNP_HTTP_PORTS = [49152, 5000, 8008, 2869, 1076];

// Full port list used when chrome.system.network detects the actual subnet
const FULL_UPNP_HTTP_PORTS = [49152, 5000, 8008, 2869, 1076, 49153, 49154, 5001];

// UPnP description paths to try (ordered by probability)
const UPNP_DESCRIPTION_PATHS = ['/description.xml', '/'];

// Number of concurrent HTTP probes.
// A Chrome extension can tolerate a higher fan-out on LAN HTTP probes, and this
// cuts a detected /24 scan from tens of seconds to a few seconds.
const PROBE_CONCURRENCY = 64;

// Timeout per HTTP probe (ms). LAN devices normally respond quickly; a shorter
// timeout favors fast discovery over exhaustive slow-host probing.
const PROBE_TIMEOUT = 450;

// Once the first device is found, wait briefly for other in-flight probes from
// the same high-probability batch, then return results to the UI.
const FIRST_DEVICE_SETTLE_MS = 700;

// Fallback subnets when chrome.system.network is unavailable
// Ordered by probability. Scanned sequentially — stop on first device found.
// Each subnet: 254 IPs × 5 ports = 1270 targets ≈ 13s at 50 concurrency
// So 3 subnets worst case: ~39s (no devices). OK with 45s timeout.
const FALLBACK_SUBNETS = [
  '192.168.0.',
  '192.168.1.',
  '192.168.3.',
];

/**
 * DLNA Device Discovery using HTTP UPnP probing
 *
 * Since Chrome MV3 removed chrome.sockets.udp (needed for SSDP multicast),
 * discovery is done by probing common UPnP HTTP ports on the local subnet.
 * This works because UPnP devices serve device description XML over HTTP.
 */
export class DLNADiscoveryService {
  private discoveredDevices: Map<string, CastingDevice> = new Map();
  private isDiscovering: boolean = false;
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;
  private onDeviceFoundCallback: ((device: CastingDevice) => void) | null = null;
  private abortController: AbortController | null = null;
  private pendingResolve: ((devices: CastingDevice[]) => void) | null = null;
  private currentOptions: DiscoveryOptions = {};
  private firstDeviceSettleTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Start device discovery
   */
  async startDiscovery(options: DiscoveryOptions = {}): Promise<CastingDevice[]> {
    if (this.isDiscovering) {
      console.warn('[DLNA] Discovery already in progress');
      return Array.from(this.discoveredDevices.values());
    }

    const timeout = options.timeout ?? HTTP_DISCOVERY_TIMEOUT;
    this.isDiscovering = true;
    this.discoveredDevices.clear();
    this.abortController = new AbortController();
    this.currentOptions = options;

    // Store onDeviceFound callback for use in handleMessage and HTTP probing
    this.onDeviceFoundCallback = options.onDeviceFound ?? null;

    options.onDiscoveryStart?.();

    try {
      this.httpProbeSubnets().then(() => {
        console.log(`[DLNA] HTTP probing completed early, finishing discovery (found ${this.discoveredDevices.size} devices)`);
        this.finishDiscovery();
      }).catch((error) => {
        console.warn('[DLNA] HTTP probing error (non-fatal):', error);
        this.currentOptions.onError?.(error);
      });
    } catch (error) {
      // Catch synchronous errors only (async ones handled by .catch above)
      console.warn('[DLNA] Failed to start HTTP probing:', error);
      this.currentOptions.onError?.(error instanceof Error ? error : new Error(String(error)));
    }

    // Return a Promise that resolves when discovery ends (after timeout or stopDiscovery)
    return new Promise<CastingDevice[]>((resolve) => {
      this.pendingResolve = resolve;
      this.searchTimeout = setTimeout(() => {
        this.finishDiscovery();
      }, timeout);
    });
  }

  /**
   * Resolve the discovery promise and clean up
   */
  private finishDiscovery(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = null;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.firstDeviceSettleTimer) {
      clearTimeout(this.firstDeviceSettleTimer);
      this.firstDeviceSettleTimer = null;
    }

    this.isDiscovering = false;

    const devices = Array.from(this.discoveredDevices.values());
    if (this.pendingResolve) {
      this.pendingResolve(devices);
      this.pendingResolve = null;
    }
    this.currentOptions.onDiscoveryEnd?.(devices);
  }

  /**
   * Stop device discovery
   */
  stopDiscovery(): void {
    this.finishDiscovery();
  }

  // ============================================================
  // HTTP-based UPnP probing (replaces SSDP multicast)
  // ============================================================

  /**
   * Probe local subnets for UPnP devices via HTTP
   */
  private async httpProbeSubnets(): Promise<void> {
    const { subnets, isFallback } = await this.getLocalSubnets();
    console.log(`[DLNA] HTTP probing subnets: [${subnets.join(', ')}] (${isFallback ? 'fallback — sequential scan' : 'detected — concurrent scan with full ports'})`);

    // Use full port list when we have confirmed subnets detected via chrome.system.network
    // or gateway probe (1-2 actual subnets × 8 ports = 1016-2032 targets — fits within timeout).
    // Use slim port list for fallback subnets (may have many subnets × 5 ports)
    // to keep total scan time within the discovery timeout.
    const ports = isFallback ? UPNP_HTTP_PORTS : FULL_UPNP_HTTP_PORTS;
    console.log(`[DLNA] Using ${ports.length} ports: [${ports.join(', ')}] (${isFallback ? 'fallback subnets — slim scan' : 'detected subnets — full port scan'})`);

    const startTime = Date.now();

    if (isFallback) {
      // Fallback mode: scan subnets SEQUENTIALLY — stop as soon as any device is found.
      // This ensures users on any common subnet (192.168.0.x, 1.x, 3.x) find devices
      // quickly without wasting time on irrelevant subnets.
      for (const subnet of subnets) {
        // Check if discovery was aborted (e.g. by timeout or user stop)
        if (!this.isDiscovering || this.abortController?.signal.aborted) break;

        // Build targets for this subnet only
        const ips: string[] = [];
        for (let i = 1; i <= 254; i++) {
          ips.push(`${subnet}${i}`);
        }
        const targets = buildPortFirstTargets(ips, ports);

        console.log(`[DLNA] Scanning subnet ${subnet.substring(0, subnet.length - 1)}.0/24 (${targets.length} targets)...`);
        await this.probeTargets(targets);

        // If we found devices on this subnet, stop — no need to scan others
        if (this.discoveredDevices.size > 0) {
          console.log(`[DLNA] ✅ Devices found on subnet ${subnet}, skipping remaining subnets`);
          break;
        }
        console.log(`[DLNA] No devices on subnet ${subnet}, moving to next...`);
      }
    } else {
      // Detected mode (via chrome.system.network): scan all subnets concurrently.
      // Only 1-2 subnets are detected, so total targets are manageable.
      const allIps: string[] = [];
      for (const subnet of subnets) {
        for (let i = 1; i <= 254; i++) {
          allIps.push(`${subnet}${i}`);
        }
      }

      const targets = buildPortFirstTargets(allIps, ports);

      console.log(`[DLNA] Probing ${targets.length} targets across ${subnets.length} subnets (${allIps.length} IPs × ${ports.length} ports)`);
      await this.probeTargets(targets);
    }

    const elapsed = Date.now() - startTime;
    console.log(`[DLNA] HTTP probing completed in ${elapsed}ms. Found ${this.discoveredDevices.size} devices`);
    if (this.discoveredDevices.size > 0) {
      for (const [addr, device] of this.discoveredDevices) {
        console.log(`[DLNA]   → ${device.name} at ${addr}:${device.port}`);
      }
    }
  }

  /**
   * Get local subnet prefixes from chrome.system.network or fallback
   * Returns subnets and whether they are fallback (not detected via system.network)
   */
  private async getLocalSubnets(): Promise<{ subnets: string[]; isFallback: boolean }> {
    // Method 1: chrome.system.network API (requires "system.network" permission)
    try {
      const systemNetwork = (chrome as any).system?.network;
      if (systemNetwork) {
        console.log('[DLNA] Getting network interfaces via chrome.system.network...');
        const interfaces = await systemNetwork.getNetworkInterfaces() as Array<{
          address: string;
          name: string;
          prefixLength: number;
        }>;
        console.log('[DLNA] Network interfaces:', JSON.stringify(interfaces));
        const subnets = new Set<string>();

        for (const iface of interfaces) {
          const parts = iface.address.split('.');
          if (parts.length !== 4) continue;

          // Filter private IPv4 addresses only
          const first = parseInt(parts[0], 10);
          const second = parseInt(parts[1], 10);

          const isPrivate =
            first === 10 ||
            (first === 172 && second >= 16 && second <= 31) ||
            (first === 192 && second === 168);

          if (isPrivate) {
            subnets.add(`${parts[0]}.${parts[1]}.${parts[2]}.`);
          }
        }

        if (subnets.size > 0) {
          const result = Array.from(subnets);
          console.log('[DLNA] ✅ Detected local subnets via chrome.system.network:', result);
          return { subnets: result, isFallback: false };
        }
        console.log('[DLNA] No private subnets found from system.network');
      } else {
        console.log('[DLNA] chrome.system.network API not available');
      }
    } catch (error) {
      console.warn('[DLNA] Failed to get network interfaces:', error);
    }

    // Method 2: Probe gateway IPs on common subnets to detect which one is active
    try {
      const detectedSubnet = await this.probeLocalSubnet();
      if (detectedSubnet) {
        console.log(`[DLNA] ✅ Detected local subnet via gateway probe: ${detectedSubnet}`);
        return { subnets: [detectedSubnet], isFallback: false };
      }
      console.log('[DLNA] Gateway probe did not detect any active subnet');
    } catch (error) {
      console.warn('[DLNA] Gateway probe failed:', error);
    }

    // Method 3: Fallback to hardcoded common private subnets (sequential scan)
    console.log('[DLNA] Using fallback subnets:', FALLBACK_SUBNETS);
    return { subnets: [...FALLBACK_SUBNETS], isFallback: true };
  }

  /**
   * Detect local subnet by probing gateway IPs on common subnets.
   * Sends quick HTTP requests to .1 and .254 addresses (commonly routers/gateways).
   * The first subnet whose gateway responds is assumed to be our active subnet.
   * This works without any special Chrome API permissions.
   */
  private async probeLocalSubnet(): Promise<string | null> {
    // Candidate subnets to probe, ordered by probability
    const candidates = [
      '192.168.0.',
      '192.168.1.',
      '192.168.3.',
      '192.168.2.',
      '10.0.0.',
    ];

    // Gateway host addresses to probe on each subnet
    const gatewayHosts = [1, 254];

    // Gateway probe timeout (ms) — LAN gateways respond in <10ms if reachable
    const GATEWAY_PROBE_TIMEOUT = 300;

    return new Promise<string | null>((resolve) => {
      let pending = 0;
      let resolved = false;

      for (const subnet of candidates) {
        for (const host of gatewayHosts) {
          pending++;
          const ip = `${subnet}${host}`;
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), GATEWAY_PROBE_TIMEOUT);

          fetch(`http://${ip}/`, {
            signal: controller.signal,
            mode: 'no-cors',
          })
            .then(() => {
              clearTimeout(timer);
              if (!resolved) {
                resolved = true;
                resolve(subnet);
              }
            })
            .catch(() => {
              clearTimeout(timer);
              pending--;
              if (pending === 0 && !resolved) {
                resolve(null);
              }
            });
        }
      }

      // Safety timeout: resolve with null after all probes have had time to fail
      setTimeout(() => {
        if (!resolved) resolve(null);
      }, GATEWAY_PROBE_TIMEOUT + 200);
    });
  }

  /**
   * Probe a list of targets with concurrency control
   */
  private async probeTargets(
    targets: Array<{ ip: string; port: number }>
  ): Promise<void> {
    const totalBatches = Math.ceil(targets.length / PROBE_CONCURRENCY);
    let lastLogTime = Date.now();

    for (let i = 0; i < targets.length; i += PROBE_CONCURRENCY) {
      // Check if discovery was stopped
      if (!this.isDiscovering || this.abortController?.signal.aborted) {
        console.log('[DLNA] Probing aborted midway');
        return;
      }

      const batch = targets.slice(i, i + PROBE_CONCURRENCY);
      const batchNum = Math.floor(i / PROBE_CONCURRENCY) + 1;

      // Log progress every ~5 seconds or every 100 batches
      const now = Date.now();
      if (now - lastLogTime > 5000 || batchNum === 1 || batchNum % 100 === 0) {
        console.log(`[DLNA] Probing progress: batch ${batchNum}/${totalBatches} (${Math.round(batchNum / totalBatches * 100)}%), devices found: ${this.discoveredDevices.size}`);
        lastLogTime = now;
      }

      const results = await Promise.allSettled(
        batch.map(({ ip, port }) => this.probeDevice(ip, port))
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          const device = result.value;
          // Deduplicate by IP address
          if (!this.discoveredDevices.has(device.address)) {
            this.discoveredDevices.set(device.address, device);
            console.log('[DLNA] ✅ Device discovered via HTTP:', device.name, `(${device.address}:${device.port})`);
            this.onDeviceFoundCallback?.(device);
            this.scheduleFirstDeviceResolve();
          }
        }
      }
    }
  }

  /**
   * Return quickly after the first discovered device, while still allowing
   * current in-flight probes to surface nearby devices.
   */
  private scheduleFirstDeviceResolve(): void {
    if (!this.currentOptions.fastResolveOnFirstDevice) return;
    if (this.firstDeviceSettleTimer || !this.pendingResolve) return;

    this.firstDeviceSettleTimer = setTimeout(() => {
      if (this.pendingResolve) {
        const devices = Array.from(this.discoveredDevices.values());
        console.log(`[DLNA] Fast discovery result ready (${devices.length} found), continuing background scan`);
        this.pendingResolve(devices);
        this.pendingResolve = null;
      }
    }, FIRST_DEVICE_SETTLE_MS);
  }

  /**
   * Probe a single IP:port for UPnP device description
   * Tries multiple paths (e.g., /description.xml first, then /)
   */
  private async probeDevice(ip: string, port: number): Promise<CastingDevice | null> {
    for (const path of UPNP_DESCRIPTION_PATHS) {
      try {
        const url = `http://${ip}:${port}${path}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT);

        let response: Response;
        try {
          response = await fetch(url, {
            signal: this.abortController
              ? combineAbortSignals(this.abortController.signal, controller.signal)
              : controller.signal,
            headers: {
              // UPnP devices may filter requests by User-Agent
              'User-Agent': 'Microsoft-Windows/6.3 UPnP/1.0',
              // Standard UPnP content type expectations
              'Accept': 'text/xml, application/xml',
            },
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          // Silently skip non-OK responses (expected for non-UPnP devices)
          continue;
        }

        const xml = await response.text();
        if (!xml || xml.length < 50) {
          console.log(`[DLNA] Response too short (${xml?.length || 0} chars) from ${url}`);
          continue;
        }

        // Log any XML response for debugging (first 100 chars)
        console.log(`[DLNA] Got XML response (${xml.length} chars) from ${url}, trying to parse...`);

        const device = this.parseUPnPDescription(xml, ip, port);
        if (device) {
          console.log(`[DLNA] ✅ Successfully parsed device from ${url}: ${device.name}`);
          return device;
        } else {
          console.log(`[DLNA] ❌ Failed to parse XML from ${url} (first 100 chars: ${xml.substring(0, 100).replace(/\n/g, ' ')})`);
        }
      } catch (err) {
        // Log all probe errors with IP:port context for debugging
        // Previously only unexpected errors were logged, but we need visibility into
        // why known-good devices (e.g., MateTV 192.168.3.85:49152) are not responding
        const errMsg = err instanceof Error ? err.message : String(err);
        const errName = err instanceof Error ? err.name : 'Unknown';
        const targetLog = `${ip}:${port}${path}`;

        // Always log errors for common UPnP ports (helps diagnose discovery issues)
        if (port === 49152 || port === 1076 || port === 5000) {
          console.log(`[DLNA] Probe failed for ${targetLog}: [${errName}] ${errMsg.substring(0, 120)}`);
        }
        continue;
      }
    }
    return null;
  }

  /**
   * Parse UPnP device description XML into CastingDevice
   */
  private parseUPnPDescription(xml: string, ip: string, port: number): CastingDevice | null {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');

      // Check for parser error
      const parserError = doc.getElementsByTagName('parsererror');
      if (parserError.length > 0) return null;

      // Extract device info from XML (getElementsByTagName works across namespaces)
      const friendlyName =
        doc.getElementsByTagName('friendlyName')[0]?.textContent || '';
      const deviceType =
        doc.getElementsByTagName('deviceType')[0]?.textContent || '';
      const udn = doc.getElementsByTagName('UDN')[0]?.textContent || '';
      const modelName =
        doc.getElementsByTagName('modelName')[0]?.textContent || '';

      // Require at least a device name or type to consider this a valid UPnP device
      if (!friendlyName && !deviceType && !udn) return null;

      // Generate stable ID from UDN (unique device name)
      const stableId = udn
        ? `dlna-${udn.replace(/[^a-zA-Z0-9_-]/g, '_')}`
        : `dlna-http-${ip}-${port}`;

      // Use friendlyName, fallback to modelName, then generate generic name
      const name =
        friendlyName ||
        modelName ||
        `UPnP Device (${ip}:${port})`;

      return {
        id: stableId,
        name,
        type: this.detectDeviceTypeFromXml(deviceType),
        protocol: 'dlna' as const,
        address: ip,
        port: port,
        isOnline: true,
        lastSeen: Date.now(),
      };
    } catch (error) {
      console.warn('[DLNA] Failed to parse UPnP description XML:', error);
      return null;
    }
  }

  /**
   * Detect device type from UPnP device type string
   */
  private detectDeviceTypeFromXml(deviceType: string): DeviceType {
    if (!deviceType) return 'tv';

    const lower = deviceType.toLowerCase();

    if (
      lower.includes('mediarenderer') ||
      lower.includes('dmr') ||
      lower.includes('mediareceiver')
    ) {
      return 'tv';
    }

    if (lower.includes('avtransport') || lower.includes('renderer')) {
      return 'tv';
    }

    if (lower.includes('receiver')) {
      return 'receiver';
    }

    if (lower.includes('audio') || lower.includes('speaker')) {
      return 'speaker';
    }

    if (lower.includes('mediaserver') || lower.includes('dms')) {
      return 'other';
    }

    return 'tv';
  }

  // ============================================================
  // SSDP response handling (kept for backward compatibility)
  // ============================================================

  /**
   * Parse SSDP response and extract device info
   */
  parseSSDPResponse(response: string): CastingDevice | null {
    try {
      const lines = response.split('\r\n');
      const headers: Record<string, string> = {};

      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).toLowerCase();
          const value = line.substring(colonIndex + 1).trim();
          headers[key] = value;
        }
      }

      // Extract device information
      const location = headers['location'] || headers['al'] || '';
      const st = headers['st'] || headers['nt'] || '';

      if (!location) {
        return null;
      }

      // Parse URL to get device address
      const url = new URL(location);
      const deviceName = this.extractDeviceName(headers, st, url);
      const deviceType = this.detectDeviceType(st, headers);

      // Use USN (unique service name) for stable device identity across discoveries
      // Fall back to generateUUID() if no USN is available
      const usn = headers['usn'] || '';
      const stableId = usn
        ? `dlna-${usn.replace(/[^a-zA-Z0-9_-]/g, '_')}`
        : generateUUID();

      return {
        id: stableId,
        name: deviceName,
        type: deviceType,
        protocol: 'dlna',
        address: url.hostname,
        port: url.port ? parseInt(url.port, 10) : undefined,
        isOnline: true,
        lastSeen: Date.now(),
      };
    } catch (error) {
      console.error('[DLNA] Failed to parse SSDP response:', error);
      return null;
    }
  }

  /**
   * Extract device name from SSDP headers
   */
  private extractDeviceName(
    headers: Record<string, string>,
    st: string,
    url: URL
  ): string {
    // Try various headers for device name
    const nameHeaders = ['friendlyname', 'friendlyname', 'server', 'dc:title'];

    for (const header of nameHeaders) {
      if (headers[header]) {
        return headers[header];
      }
    }

    // Fallback to ST or URL hostname
    if (st && st !== 'ssdp:all') {
      return st.replace('urn:', '').replace(/:/g, ' ').replace(/-/g, ' ');
    }

    return `DLNA Device (${url.hostname})`;
  }

  /**
   * Detect device type from SSDP headers
   */
  private detectDeviceType(st: string, headers: Record<string, string>): DeviceType {
    const stLower = st.toLowerCase();
    const usnLower = (headers['usn'] || '').toLowerCase();

    // Check for specific device types
    if (
      stLower.includes('mediareceiver') ||
      stLower.includes('dmr') ||
      usnLower.includes('mediareceiver')
    ) {
      return 'tv';
    }

    if (stLower.includes('avtransport') || stLower.includes('renderer')) {
      return 'tv';
    }

    if (stLower.includes('receiver')) {
      return 'receiver';
    }

    if (stLower.includes('audio')) {
      return 'speaker';
    }

    // Default to TV for unknown types
    return 'tv';
  }

  /**
   * Handle incoming SSDP message
   */
  handleMessage(message: string, remoteAddress: string): void {
    const device = this.parseSSDPResponse(message);

    if (device) {
      // Use remoteAddress as the deduplication key (actual source IP)
      // This is more reliable than device.address (parsed from Location header)
      device.address = remoteAddress;
      if (!this.discoveredDevices.has(remoteAddress)) {
        this.discoveredDevices.set(remoteAddress, device);
        console.log('[DLNA] Device discovered:', device.name, device.address);
        this.onDeviceFoundCallback?.(device);
      }
    }
  }

  /**
   * Get all discovered devices
   */
  getDiscoveredDevices(): CastingDevice[] {
    return Array.from(this.discoveredDevices.values());
  }

  /**
   * Check if a device is currently being discovered
   */
  isCurrentlyDiscovering(): boolean {
    return this.isDiscovering;
  }
}

/**
 * Combine two AbortSignals into one (polyfill for environments without native support)
 */
function combineAbortSignals(
  signal1: AbortSignal,
  signal2: AbortSignal
): AbortSignal {
  // If either is already aborted, return it
  if (signal1.aborted) return signal1;
  if (signal2.aborted) return signal2;

  const controller = new AbortController();

  const onAbort1 = () => controller.abort();
  const onAbort2 = () => controller.abort();

  signal1.addEventListener('abort', onAbort1, { once: true });
  signal2.addEventListener('abort', onAbort2, { once: true });

  // Clean up to prevent memory leaks
  const cleanup = () => {
    signal1.removeEventListener('abort', onAbort1);
    signal2.removeEventListener('abort', onAbort2);
  };

  controller.signal.addEventListener('abort', cleanup, { once: true });

  return controller.signal;
}

function buildPortFirstTargets(
  ips: string[],
  ports: number[]
): Array<{ ip: string; port: number }> {
  const targets: Array<{ ip: string; port: number }> = [];
  for (const port of ports) {
    for (const ip of ips) {
      targets.push({ ip, port });
    }
  }
  return targets;
}

// Singleton instance
let discoveryService: DLNADiscoveryService | null = null;

/**
 * Get the singleton discovery service instance
 */
export function getDiscoveryService(): DLNADiscoveryService {
  if (!discoveryService) {
    discoveryService = new DLNADiscoveryService();
  }
  return discoveryService;
}

/**
 * Quick discover - single promise-based discovery
 */
export async function discoverDLNADevices(
  timeout: number = HTTP_DISCOVERY_TIMEOUT
): Promise<CastingDevice[]> {
  const service = getDiscoveryService();
  return service.startDiscovery({ timeout });
}

export default { DLNADiscoveryService, getDiscoveryService, discoverDLNADevices };
