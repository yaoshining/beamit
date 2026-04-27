// DLNA/UPnP Device Discovery Service
// Implements SSDP (Simple Service Discovery Protocol) for device discovery

import { CastingDevice, DeviceType } from '@shared/types';
import { SSDP_MULTICAST_ADDRESS, SSDP_PORT, SSDP_TIMEOUT } from '@shared/constants';
import { generateUUID } from '@shared/utils';

export interface DiscoveryOptions {
  timeout?: number;
  searchTarget?: string;
  onDeviceFound?: (device: CastingDevice) => void;
  onDiscoveryStart?: () => void;
  onDiscoveryEnd?: (devices: CastingDevice[]) => void;
  onError?: (error: Error) => void;
}

/**
 * DLNA Device Discovery using SSDP
 */
export class DLNADiscoveryService {
  private socketId: number | null = null;
  private discoveredDevices: Map<string, CastingDevice> = new Map();
  private isDiscovering: boolean = false;
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Start device discovery
   */
  async startDiscovery(options: DiscoveryOptions = {}): Promise<CastingDevice[]> {
    if (this.isDiscovering) {
      console.warn('[DLNA] Discovery already in progress');
      return Array.from(this.discoveredDevices.values());
    }

    const timeout = options.timeout || SSDP_TIMEOUT;
    this.isDiscovering = true;
    this.discoveredDevices.clear();

    options.onDiscoveryStart?.();

    try {
      // Send SSDP M-SEARCH request
      await this.sendSSDPSearch(options.searchTarget);

      // Set up receive handler
      this.startListening();

      // Set timeout to stop discovery
      this.searchTimeout = setTimeout(() => {
        this.stopDiscovery();
        options.onDiscoveryEnd?.(Array.from(this.discoveredDevices.values()));
      }, timeout);

      return Array.from(this.discoveredDevices.values());
    } catch (error) {
      this.isDiscovering = false;
      options.onError?.(error as Error);
      return [];
    }
  }

  /**
   * Stop device discovery
   */
  stopDiscovery(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = null;
    }

    if (this.socketId !== null) {
      // In Chrome extension, we would call chrome.sockets.udp.close(this.socketId)
      // For now, we just reset the ID
      this.socketId = null;
    }

    this.isDiscovering = false;
  }

  /**
   * Send SSDP M-SEARCH request
   */
  private async sendSSDPSearch(searchTarget?: string): Promise<void> {
    const target = searchTarget || 'ssdp:all';
    const searchRequest = [
      'M-SEARCH * HTTP/1.1',
      `HOST: ${SSDP_MULTICAST_ADDRESS}:${SSDP_PORT}`,
      'MAN: "ssdp:discover"',
      `ST: ${target}`,
      'MX: 3',
      '',
      ''
    ].join('\r\n');

    // Note: In Chrome extension, we use chrome.sockets.udp
    // This is a simplified implementation
    try {
      const buffer = new ArrayBuffer(searchRequest.length);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < searchRequest.length; i++) {
        view[i] = searchRequest.charCodeAt(i);
      }

      // Chrome extension UDP socket implementation would go here
      // For now, we'll use a placeholder that logs the request
      console.log('[DLNA] Sending SSDP M-SEARCH:', searchRequest);
    } catch (error) {
      console.error('[DLNA] Failed to send SSDP search:', error);
      throw error;
    }
  }

  /**
   * Start listening for SSDP responses
   */
  private startListening(): void {
    // Chrome extension socket implementation
    // This would set up chrome.sockets.udp.create and chrome.sockets.udp.bind
    console.log('[DLNA] Started listening for SSDP responses');
  }

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

      return {
        id: generateUUID(),
        name: deviceName,
        type: deviceType,
        protocol: 'dlna',
        address: url.hostname,
        port: url.port ? parseInt(url.port, 10) : undefined,
        isOnline: true,
        lastSeen: Date.now()
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
    // Standard SSDP headers per UPnP spec: friendlyName, server, dc:title
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

    if (stLower.includes('receiver') || stLower.includes('audio')) {
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
  timeout: number = SSDP_TIMEOUT
): Promise<CastingDevice[]> {
  const service = getDiscoveryService();
  return service.startDiscovery({ timeout });
}

export default { DLNADiscoveryService, getDiscoveryService, discoverDLNADevices };
