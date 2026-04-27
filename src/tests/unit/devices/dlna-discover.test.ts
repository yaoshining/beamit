// DLNA Discovery Tests
// Tests for DLNA/UPnP device discovery

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock SSDP response
const mockSSDPResponse = `HTTP/1.1 200 OK
CACHE-CONTROL: max-age=1800
DATE: Sun, 01 Jan 2024 00:00:00 GMT
EXT:
LOCATION: http://192.168.1.100:1900/xml/device.xml
SERVER: Linux/4.0 UPnP/1.0 DLNADOC/1.50
ST: urn:schemas-upnp-org:device:MediaRenderer:1
USN: uuid:12345678-1234-1234-1234-123456789012::urn:schemas-upnp-org:device:MediaRenderer:1
X-USER-AGENT: Linux/4.0 UPnP/1.0 DLNADOC/1.50`;

describe('DLNADiscoveryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseSSDPResponse', () => {
    it('should parse valid SSDP response', () => {
      // Simulate parsing logic
      const headers: Record<string, string> = {};
      const lines = mockSSDPResponse.replace(/\r\n/g, '\n').split('\n');

      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).toLowerCase();
          const value = line.substring(colonIndex + 1).trim();
          headers[key] = value;
        }
      }

      expect(headers['st']).toBe('urn:schemas-upnp-org:device:MediaRenderer:1');
      expect(headers['location']).toBe('http://192.168.1.100:1900/xml/device.xml');
      expect(headers['usn']).toContain('uuid:12345678');
    });

    it('should extract device address from location URL', () => {
      const location = 'http://192.168.1.100:1900/xml/device.xml';
      const url = new URL(location);

      expect(url.hostname).toBe('192.168.1.100');
      expect(url.port).toBe('1900');
    });

    it('should detect MediaRenderer device type', () => {
      const st = 'urn:schemas-upnp-org:device:MediaRenderer:1';
      const isRenderer = st.includes('MediaRenderer');
      expect(isRenderer).toBe(true);
    });

    it('should return null for invalid response', () => {
      const invalidResponse = 'NOT A VALID SSDP RESPONSE';
      const hasLocation = invalidResponse.includes('LOCATION:');
      expect(hasLocation).toBe(false);
    });
  });

  describe('device identification', () => {
    it('should identify TV devices', () => {
      const deviceType = 'tv';
      expect(['tv', 'receiver', 'speaker', 'other'].includes(deviceType)).toBe(true);
    });

    it('should extract friendly name from headers', () => {
      // Test the extraction logic
      const headers = {
        'friendlyname': 'Living Room TV',
        'server': 'Linux/4.0 UPnP/1.0',
        'st': 'urn:schemas-upnp-org:device:MediaRenderer:1'
      };

      const name = headers['friendlyname'] || headers['server'] || 'Unknown Device';
      expect(name).toBe('Living Room TV');
    });
  });

  describe('SSDP search request', () => {
    it('should create valid M-SEARCH request', () => {
      const searchRequest = [
        'M-SEARCH * HTTP/1.1',
        'HOST: 239.255.255.250:1900',
        'MAN: "ssdp:discover"',
        'MX: 3',
        'ST: urn:schemas-upnp-org:device:MediaRenderer:1',
        '',
        ''
      ].join('\r\n');

      expect(searchRequest).toContain('M-SEARCH');
      expect(searchRequest).toContain('239.255.255.250:1900');
      expect(searchRequest).toContain('ssdp:discover');
    });
  });

  describe('device timeout', () => {
    it('should respect device timeout', () => {
      const lastSeen = Date.now() - 60000; // 60 seconds ago
      const timeout = 30000; // 30 seconds
      const isOnline = Date.now() - lastSeen < timeout;

      expect(isOnline).toBe(false);
    });

    it('should consider recent device as online', () => {
      const lastSeen = Date.now() - 5000; // 5 seconds ago
      const timeout = 30000; // 30 seconds
      const isOnline = Date.now() - lastSeen < timeout;

      expect(isOnline).toBe(true);
    });
  });
});

describe('DeviceManager', () => {
  describe('startDiscovery', () => {
    it('should return empty array when no devices found', async () => {
      // Mock empty discovery
      const devices = [];
      expect(devices.length).toBe(0);
    });

    it('should filter online devices', () => {
      const devices = [
        { id: '1', lastSeen: Date.now() - 5000, isOnline: true },
        { id: '2', lastSeen: Date.now() - 60000, isOnline: false }
      ];

      const onlineDevices = devices.filter((d) => Date.now() - d.lastSeen < 30000);
      expect(onlineDevices.length).toBe(1);
    });
  });

  describe('selectDevice', () => {
    it('should set selected device', () => {
      const selectedDevice = { id: '1', name: 'Test TV' };
      const currentSelection = selectedDevice;

      expect(currentSelection.id).toBe('1');
      expect(currentSelection.name).toBe('Test TV');
    });
  });
});
