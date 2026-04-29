/**
 * DLNA Discovery Tests
 * Tests for DLNA/UPnP device discovery service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DLNADiscoveryService, getDiscoveryService, discoverDLNADevices } from '@background-utils/devices/dlna-discover';

describe('DLNADiscoveryService', () => {
  let service: DLNADiscoveryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DLNADiscoveryService();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    service.stopDiscovery();
  });

  describe('parseSSDPResponse', () => {
    const validResponse = [
      'HTTP/1.1 200 OK',
      'CACHE-CONTROL: max-age=1800',
      'DATE: Sun, 01 Jan 2024 00:00:00 GMT',
      'EXT:',
      'LOCATION: http://192.168.1.100:1900/xml/device.xml',
      'SERVER: Linux/4.0 UPnP/1.0 DLNADOC/1.50',
      'ST: urn:schemas-upnp-org:device:MediaRenderer:1',
      'USN: uuid:12345678-1234-1234-1234-123456789012::urn:schemas-upnp-org:device:MediaRenderer:1',
      'X-USER-AGENT: Linux/4.0 UPnP/1.0 DLNADOC/1.50',
    ].join('\r\n');

    it('should parse valid SSDP response and return device', () => {
      const device = service.parseSSDPResponse(validResponse);
      expect(device).not.toBeNull();
      expect(device!.name).toBe('Linux/4.0 UPnP/1.0 DLNADOC/1.50');
      expect(device!.type).toBe('tv');
      expect(device!.protocol).toBe('dlna');
      expect(device!.address).toBe('192.168.1.100');
      expect(device!.port).toBe(1900);
      expect(device!.isOnline).toBe(true);
      expect(device!.id).toContain('dlna-');
    });

    it('should return null for empty response', () => {
      const device = service.parseSSDPResponse('');
      expect(device).toBeNull();
    });

    it('should return null for response without location', () => {
      const response = 'SOME: header\r\nOTHER: value';
      const device = service.parseSSDPResponse(response);
      expect(device).toBeNull();
    });

    it('should handle SSDP response with AL header instead of LOCATION', () => {
      const response = [
        'HTTP/1.1 200 OK',
        'AL: http://192.168.1.200:1900/xml/device.xml',
        'ST: urn:schemas-upnp-org:device:MediaRenderer:1',
      ].join('\r\n');
      const device = service.parseSSDPResponse(response);
      expect(device).not.toBeNull();
      expect(device!.address).toBe('192.168.1.200');
    });

    it('should generate stable ID from USN', () => {
      const device = service.parseSSDPResponse(validResponse);
      // Colons are replaced with underscores by the sanitization regex
      expect(device!.id).toBe('dlna-uuid_12345678-1234-1234-1234-123456789012__urn_schemas-upnp-org_device_MediaRenderer_1');
    });

    it('should generate UUID when no USN is available', () => {
      const responseNoUSN = [
        'HTTP/1.1 200 OK',
        'LOCATION: http://192.168.1.100:1900/xml/device.xml',
        'ST: urn:schemas-upnp-org:device:MediaRenderer:1',
      ].join('\r\n');
      const device = service.parseSSDPResponse(responseNoUSN);
      expect(device).not.toBeNull();
      expect(device!.id).not.toContain('dlna-');
      // Should be a UUID format
      expect(device!.id).toMatch(/^[0-9a-f-]+$/);
    });
  });

  describe('device type detection', () => {
    it('should detect MediaRenderer as tv type', () => {
      const response = [
        'HTTP/1.1 200 OK',
        'LOCATION: http://192.168.1.100:1900/xml/device.xml',
        'ST: urn:schemas-upnp-org:device:MediaRenderer:1',
      ].join('\r\n');
      const device = service.parseSSDPResponse(response);
      expect(device!.type).toBe('tv');
    });

    it('should detect DMR as tv type', () => {
      const response = [
        'HTTP/1.1 200 OK',
        'LOCATION: http://192.168.1.100:1900/xml/device.xml',
        'ST: urn:schemas-upnp-org:device:DMR:1',
      ].join('\r\n');
      const device = service.parseSSDPResponse(response);
      expect(device!.type).toBe('tv');
    });

    it('should detect MediaReceiver as tv type (mediareceiver check takes priority)', () => {
      const response = [
        'HTTP/1.1 200 OK',
        'LOCATION: http://192.168.1.100:1900/xml/device.xml',
        'ST: urn:schemas-upnp-org:device:MediaReceiver:1',
      ].join('\r\n');
      const device = service.parseSSDPResponse(response);
      // mediareceiver contains 'mediareceiver' which matches before 'receiver'
      expect(device!.type).toBe('tv');
    });

    it('should detect AudioReceiver as receiver type (receiver check takes priority over audio)', () => {
      const response = [
        'HTTP/1.1 200 OK',
        'LOCATION: http://192.168.1.100:1900/xml/device.xml',
        'ST: urn:schemas-upnp-org:device:AudioReceiver:1',
      ].join('\r\n');
      const device = service.parseSSDPResponse(response);
      // AudioReceiver contains 'receiver' which matches before 'audio'
      expect(device!.type).toBe('receiver');
    });

    it('should detect speaker type from audio ST header', () => {
      const response = [
        'HTTP/1.1 200 OK',
        'LOCATION: http://192.168.1.100:1900/xml/device.xml',
        'ST: urn:schemas-upnp-org:device:AudioPlayer:1',
      ].join('\r\n');
      const device = service.parseSSDPResponse(response);
      expect(device!.type).toBe('speaker');
    });

    it('should default to tv for unknown device types', () => {
      const response = [
        'HTTP/1.1 200 OK',
        'LOCATION: http://192.168.1.100:1900/xml/device.xml',
        'ST: urn:schemas-upnp-org:device:UnknownType:1',
      ].join('\r\n');
      const device = service.parseSSDPResponse(response);
      expect(device!.type).toBe('tv');
    });
  });

  describe('device name extraction', () => {
    it('should extract friendlyname from headers', () => {
      const response = [
        'HTTP/1.1 200 OK',
        'LOCATION: http://192.168.1.100:1900/xml/device.xml',
        'friendlyName: Living Room TV',
        'ST: urn:schemas-upnp-org:device:MediaRenderer:1',
      ].join('\r\n');
      const device = service.parseSSDPResponse(response);
      expect(device!.name).toBe('Living Room TV');
    });

    it('should fallback to server header for name', () => {
      const response = [
        'HTTP/1.1 200 OK',
        'LOCATION: http://192.168.1.100:1900/xml/device.xml',
        'SERVER: Linux/4.0 UPnP/1.0',
        'ST: urn:schemas-upnp-org:device:MediaRenderer:1',
      ].join('\r\n');
      const device = service.parseSSDPResponse(response);
      expect(device!.name).toBe('Linux/4.0 UPnP/1.0');
    });

    it('should fallback to ST for name when no name headers exist', () => {
      const response = [
        'HTTP/1.1 200 OK',
        'LOCATION: http://192.168.1.100:1900/xml/device.xml',
        'ST: urn:schemas-upnp-org:device:MediaRenderer:1',
      ].join('\r\n');
      const device = service.parseSSDPResponse(response);
      expect(device!.name).toContain('MediaRenderer');
    });

    it('should fallback to hostname for ssdp:all search target', () => {
      const response = [
        'HTTP/1.1 200 OK',
        'LOCATION: http://192.168.1.100:1900/xml/device.xml',
        'ST: ssdp:all',
      ].join('\r\n');
      const device = service.parseSSDPResponse(response);
      expect(device!.name).toBe('DLNA Device (192.168.1.100)');
    });

    it('should handle dc:title header (parsing splits on first colon, so key becomes "dc")', () => {
      const response = [
        'HTTP/1.1 200 OK',
        'LOCATION: http://192.168.1.100:1900/xml/device.xml',
        'friendlyName.myhome: My Living Room TV',
        'ST: urn:schemas-upnp-org:device:MediaRenderer:1',
      ].join('\r\n');
      const device = service.parseSSDPResponse(response);
      // The response parser lowercases the key, so 'friendlyname.myhome' is the header key
      // Since it doesn't match exact keys in nameHeaders, falls back to ST
      expect(device!.name).toContain('MediaRenderer');
    });
  });

  describe('handleMessage', () => {
    it('should discover device from valid SSDP message', () => {
      const response = [
        'HTTP/1.1 200 OK',
        'LOCATION: http://192.168.1.100:1900/xml/device.xml',
        'ST: urn:schemas-upnp-org:device:MediaRenderer:1',
      ].join('\r\n');

      service.handleMessage(response, '192.168.1.100');
      const devices = service.getDiscoveredDevices();
      expect(devices).toHaveLength(1);
      expect(devices[0].address).toBe('192.168.1.100');
      expect(devices[0].name).toContain('MediaRenderer');
    });

    it('should deduplicate devices by remote address', () => {
      const response = [
        'HTTP/1.1 200 OK',
        'LOCATION: http://192.168.1.100:1900/xml/device.xml',
        'ST: urn:schemas-upnp-org:device:MediaRenderer:1',
      ].join('\r\n');

      // Same device discovered twice from same address
      service.handleMessage(response, '192.168.1.100');
      service.handleMessage(response, '192.168.1.100');
      const devices = service.getDiscoveredDevices();
      expect(devices).toHaveLength(1);
    });

    it('should discover multiple devices from different addresses', () => {
      const response1 = [
        'HTTP/1.1 200 OK',
        'LOCATION: http://192.168.1.100:1900/xml/device.xml',
        'ST: urn:schemas-upnp-org:device:MediaRenderer:1',
      ].join('\r\n');
      const response2 = [
        'HTTP/1.1 200 OK',
        'LOCATION: http://192.168.1.200:1900/xml/device.xml',
        'ST: urn:schemas-upnp-org:device:MediaRenderer:1',
      ].join('\r\n');

      service.handleMessage(response1, '192.168.1.100');
      service.handleMessage(response2, '192.168.1.200');
      const devices = service.getDiscoveredDevices();
      expect(devices).toHaveLength(2);
    });

    it('should not add device for invalid SSDP message', () => {
      service.handleMessage('INVALID MESSAGE', '192.168.1.100');
      const devices = service.getDiscoveredDevices();
      expect(devices).toHaveLength(0);
    });

    it('should call onDeviceFound callback when set', () => {
      const onDeviceFound = vi.fn();
      // Create a new service to set the callback through startDiscovery
      const cbService = new DLNADiscoveryService();

      const response = [
        'HTTP/1.1 200 OK',
        'LOCATION: http://192.168.1.100:1900/xml/device.xml',
        'ST: urn:schemas-upnp-org:device:MediaRenderer:1',
      ].join('\r\n');

      // Start discovery with onDeviceFound callback, then simulate message
      // We need to call startDiscovery which sets onDeviceFoundCallback
      // But startDiscovery also does async operations
      // Just test handleMessage separately - the callback is set via startDiscovery
      // Let's use a different approach - call startDiscovery and stop it quickly
      const promise = cbService.startDiscovery({
        timeout: 50,
        onDeviceFound,
      });

      cbService.handleMessage(response, '192.168.1.100');
      expect(onDeviceFound).toHaveBeenCalledTimes(1);
      expect(onDeviceFound).toHaveBeenCalledWith(
        expect.objectContaining({ address: '192.168.1.100' })
      );

      // Wait for discovery to finish cleanly
      return promise.then(() => {});
    });
  });

  describe('startDiscovery / stopDiscovery', () => {
    it('should start and stop discovery', async () => {
      const promise = service.startDiscovery({ timeout: 100 });
      expect(service.isCurrentlyDiscovering()).toBe(true);
      service.stopDiscovery();
      expect(service.isCurrentlyDiscovering()).toBe(false);
      const devices = await promise;
      expect(devices).toHaveLength(0);
    });

    it('should return already discovered devices if already discovering', async () => {
      // Start discovery first
      service.startDiscovery({ timeout: 200 });
      // Try starting again
      const result = await service.startDiscovery({ timeout: 200 });
      expect(result).toHaveLength(0);
      service.stopDiscovery();
    });

    it('should fire onDiscoveryStart callback', async () => {
      const onStart = vi.fn();
      const promise = service.startDiscovery({
        timeout: 50,
        onDiscoveryStart: onStart,
      });
      expect(onStart).toHaveBeenCalledTimes(1);
      service.stopDiscovery();
      await promise;
    });

    it('should fire onDiscoveryEnd callback with devices', async () => {
      const onEnd = vi.fn();
      const response = [
        'HTTP/1.1 200 OK',
        'LOCATION: http://192.168.1.100:1900/xml/device.xml',
        'ST: urn:schemas-upnp-org:device:MediaRenderer:1',
      ].join('\r\n');

      const promise = service.startDiscovery({
        timeout: 50,
        onDiscoveryEnd: onEnd,
      });

      // Simulate discovering a device during the discovery window
      service.handleMessage(response, '192.168.1.100');

      await promise;
      expect(onEnd).toHaveBeenCalledTimes(1);
      expect(onEnd).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ address: '192.168.1.100' }),
        ])
      );
    });

    it('should fire onError callback on failure', async () => {
      const onError = vi.fn();
      // startDiscovery in test env won't actually throw (UDP socket doesn't exist),
      // so we test the error handling path differently
      const errService = new DLNADiscoveryService();

      // Mock httpProbeSubnets to throw
      vi.spyOn(errService as any, 'httpProbeSubnets').mockRejectedValue(new Error('Network error'));

      const devices = await errService.startDiscovery({
        timeout: 50,
        onError,
      });

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(new Error('Network error'));
      expect(devices).toHaveLength(0);
    });

    it('should prioritize high-probability ports and resolve shortly after first HTTP device', async () => {
      const upnpXml = `<?xml version="1.0"?>
        <root>
          <device>
            <deviceType>urn:schemas-upnp-org:device:MediaRenderer:1</deviceType>
            <friendlyName>Fast Living Room TV</friendlyName>
            <UDN>uuid:fast-tv</UDN>
          </device>
        </root>`;

      (global.chrome as any).system = {
        network: {
          getNetworkInterfaces: vi.fn(async () => [
            { address: '192.168.3.22', name: 'en0', prefixLength: 24 },
          ]),
        },
      };

      const requestedUrls: string[] = [];
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        requestedUrls.push(url);

        if (url === 'http://192.168.3.85:49152/description.xml') {
          return new Response(upnpXml, {
            status: 200,
            headers: { 'Content-Type': 'text/xml' },
          });
        }

        throw new DOMException('Connection failed', 'AbortError');
      });

      const startedAt = Date.now();
      try {
        const devices = await service.startDiscovery({ timeout: 5000 });
        const elapsed = Date.now() - startedAt;

        expect(devices).toHaveLength(1);
        expect(devices[0]).toMatchObject({
          name: 'Fast Living Room TV',
          address: '192.168.3.85',
          port: 49152,
        });
        expect(elapsed).toBeLessThan(2500);
        expect(requestedUrls.slice(0, 128).every((url) => url.includes(':49152/'))).toBe(true);
      } finally {
        service.stopDiscovery();
        fetchSpy.mockRestore();
        delete (global.chrome as any).system;
      }
    });
  });

  describe('getDiscoveredDevices', () => {
    it('should return empty array initially', () => {
      expect(service.getDiscoveredDevices()).toHaveLength(0);
    });

    it('should return discovered devices', () => {
      const response = [
        'HTTP/1.1 200 OK',
        'LOCATION: http://192.168.1.100:1900/xml/device.xml',
        'ST: urn:schemas-upnp-org:device:MediaRenderer:1',
      ].join('\r\n');
      service.handleMessage(response, '192.168.1.100');
      expect(service.getDiscoveredDevices()).toHaveLength(1);
    });
  });
});

describe('getDiscoveryService', () => {
  it('should return singleton instance', () => {
    const instance1 = getDiscoveryService();
    const instance2 = getDiscoveryService();
    expect(instance1).toBe(instance2);
  });
});

describe('discoverDLNADevices', () => {
  it('should return devices after timeout', async () => {
    const service = getDiscoveryService();
    vi.spyOn(service, 'startDiscovery').mockResolvedValue([]);
    const devices = await discoverDLNADevices(50);
    expect(devices).toEqual([]);
  });
});
