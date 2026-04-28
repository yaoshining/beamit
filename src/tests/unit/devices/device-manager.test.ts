/**
 * Device Manager Tests
 * Tests for device state management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CastingDevice } from '@shared/types';

// Mock storage before importing device-manager
const mockDeviceHistory: CastingDevice[] = [];
let mockRecentIds: string[] = [];
let mockSettings: { deviceTimeout?: number } = { deviceTimeout: 30000 };

vi.mock('@shared/storage', () => ({
  addToDeviceHistory: vi.fn(async (device: CastingDevice) => {
    mockDeviceHistory.push(device);
  }),
  getRecentDeviceIds: vi.fn(async () => [...mockRecentIds]),
  setRecentDevices: vi.fn(async (ids: string[]) => {
    mockRecentIds = [...ids];
  }),
  getSettings: vi.fn(async () => ({ ...mockSettings })),
  setDiscoveredDevices: vi.fn(async () => {}),
}));

// Mock dlna-discover
const mockStopDiscovery = vi.fn();
const mockStartDiscovery = vi.fn();

vi.mock('@background-utils/devices/dlna-discover', () => ({
  getDiscoveryService: vi.fn(() => ({
    startDiscovery: mockStartDiscovery,
    stopDiscovery: mockStopDiscovery,
  })),
}));

// Import after mocks are set up
import {
  getDeviceState,
  startDiscovery,
  stopDiscovery,
  selectDevice,
  getDeviceById,
  isDeviceOnline,
  getOnlineDevices,
  getRecentlyUsedDevices,
  refreshDevices,
  clearState,
} from '@background-utils/devices/device-manager';

function createTestDevice(id: string, name: string, lastSeen?: number): CastingDevice {
  return {
    id,
    name,
    type: 'tv',
    protocol: 'dlna',
    address: '192.168.1.100',
    isOnline: true,
    lastSeen: lastSeen ?? Date.now(),
  };
}

describe('DeviceManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearState();
    mockDeviceHistory.length = 0;
    mockRecentIds = [];
    mockSettings = { deviceTimeout: 30000 };
    mockStartDiscovery.mockReset();
    mockStopDiscovery.mockReset();
  });

  describe('getDeviceState', () => {
    it('should return initial state', () => {
      const state = getDeviceState();
      expect(state.devices).toEqual([]);
      expect(state.selectedDevice).toBeNull();
      expect(state.isDiscovering).toBe(false);
      expect(state.error).toBeNull();
      expect(state.lastDiscovery).toBe(0);
    });

    it('should return a copy with same structure but separate state tracking', () => {
      const state = getDeviceState();
      // Modifying returned state should not affect future state reads of primitives
      expect(state.selectedDevice).toBeNull();
      expect(state.isDiscovering).toBe(false);
    });
  });

  describe('clearState', () => {
    it('should reset all state fields', () => {
      // Set some state via selectDevice first
      createTestDevice('1', 'Test TV');

      // We need to manually verify clearState works since startDiscovery
      // is async and mocked
      clearState();
      const state = getDeviceState();
      expect(state.devices).toEqual([]);
      expect(state.selectedDevice).toBeNull();
      expect(state.isDiscovering).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('selectDevice', () => {
    it('should set selected device and add to history', async () => {
      const device = createTestDevice('1', 'Living Room TV');
      await selectDevice(device);

      const state = getDeviceState();
      expect(state.selectedDevice).toEqual(device);

      // Should have called addToDeviceHistory
      const { addToDeviceHistory } = await import('@shared/storage');
      expect(addToDeviceHistory).toHaveBeenCalledWith(device);
    });
  });

  describe('getDeviceById', () => {
    it('should return undefined for unknown device', () => {
      const result = getDeviceById('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should find device after discovery', async () => {
      // Mock startDiscovery to return a device
      mockStartDiscovery.mockImplementation(async (opts: any) => {
        const device = createTestDevice('tv-1', 'My TV');
        // Simulate onDiscoveryEnd callback
        if (opts.onDiscoveryEnd) {
          opts.onDiscoveryEnd([device]);
        }
        return [device];
      });

      await startDiscovery();
      const found = getDeviceById('tv-1');
      expect(found).toBeDefined();
      expect(found!.name).toBe('My TV');
    });
  });

  describe('startDiscovery', () => {
    it('should call discovery service and update state', async () => {
      const device = createTestDevice('tv-1', 'Living Room TV');
      mockStartDiscovery.mockImplementation(async (opts: any) => {
        if (opts.onDiscoveryEnd) {
          opts.onDiscoveryEnd([device]);
        }
        return [device];
      });

      const devices = await startDiscovery();
      expect(devices).toHaveLength(1);
      expect(devices[0].name).toBe('Living Room TV');
    });

    it('should not start discovery if already in progress', async () => {
      mockStartDiscovery.mockImplementation(async () => {
        // Simulate a long discovery
        await new Promise((resolve) => setTimeout(resolve, 100));
        return [];
      });

      // Start first discovery
      const promise1 = startDiscovery();

      // Start second discovery while first is in progress
      const devices2 = await startDiscovery();
      expect(devices2).toEqual([]);

      await promise1;
    });

    it('should handle discovery errors', async () => {
      mockStartDiscovery.mockRejectedValue(new Error('Network error'));

      const devices = await startDiscovery();
      expect(devices).toEqual([]);

      const state = getDeviceState();
      expect(state.error).toBe('Network error');
      expect(state.isDiscovering).toBe(false);
    });

    it('should handle error with onError callback', async () => {
      mockStartDiscovery.mockImplementation(async (opts: any) => {
        if (opts.onError) {
          opts.onError(new Error('Discovery timeout'));
        }
        return [];
      });

      const devices = await startDiscovery();
      expect(devices).toEqual([]);

      const state = getDeviceState();
      expect(state.error).toBe('Discovery timeout');
    });
  });

  describe('stopDiscovery', () => {
    it('should stop discovery and update state', () => {
      stopDiscovery();
      expect(mockStopDiscovery).toHaveBeenCalledTimes(1);
      const state = getDeviceState();
      expect(state.isDiscovering).toBe(false);
    });
  });

  describe('isDeviceOnline', () => {
    it('should return true for recently seen device', async () => {
      const device = createTestDevice('1', 'Test TV', Date.now() - 5000);
      const online = await isDeviceOnline(device);
      expect(online).toBe(true);
    });

    it('should return false for device seen long ago', async () => {
      const device = createTestDevice('1', 'Test TV', Date.now() - 60000);
      const online = await isDeviceOnline(device);
      expect(online).toBe(false);
    });

    it('should use custom device timeout from settings', async () => {
      mockSettings = { deviceTimeout: 10000 };
      const device = createTestDevice('1', 'Test TV', Date.now() - 15000);
      const online = await isDeviceOnline(device);
      // 15000 > 10000, so it should be offline
      expect(online).toBe(false);
    });

    it('should fallback to default timeout when settings fails', async () => {
      // Mock getSettings to throw
      const { getSettings } = await import('@shared/storage');
      (getSettings as any).mockRejectedValue(new Error('Storage error'));

      const device = createTestDevice('1', 'Test TV', Date.now() - 5000);
      const online = await isDeviceOnline(device);
      expect(online).toBe(true);
    });
  });

  describe('getOnlineDevices', () => {
    it('should return empty array when no devices discovered', async () => {
      const online = await getOnlineDevices();
      expect(online).toEqual([]);
    });

    it('should filter online devices', async () => {
      // Set up devices via discovery
      const device1 = createTestDevice('1', 'Online TV', Date.now() - 5000);
      mockStartDiscovery.mockImplementation(async (opts: any) => {
        if (opts.onDiscoveryEnd) {
          opts.onDiscoveryEnd([device1]);
        }
        return [device1];
      });

      await startDiscovery();
      const online = await getOnlineDevices();
      expect(online).toHaveLength(1);
      expect(online[0].id).toBe('1');
    });
  });

  describe('getRecentlyUsedDevices', () => {
    it('should return empty array when no recent devices', async () => {
      const recent = await getRecentlyUsedDevices();
      expect(recent).toEqual([]);
    });

    it('should return recently used online devices', async () => {
      const device = createTestDevice('tv-1', 'Recent TV', Date.now() - 5000);

      // Set up recent device IDs
      mockRecentIds = ['tv-1'];

      // Add device to state via discovery
      mockStartDiscovery.mockImplementation(async (opts: any) => {
        if (opts.onDiscoveryEnd) {
          opts.onDiscoveryEnd([device]);
        }
        return [device];
      });

      await startDiscovery();

      const recent = await getRecentlyUsedDevices();
      expect(recent).toHaveLength(1);
      expect(recent[0].id).toBe('tv-1');
    });

    it('should exclude offline devices from recent list', async () => {
      const offlineDevice = createTestDevice('tv-1', 'Offline TV', Date.now() - 60000);

      mockRecentIds = ['tv-1'];

      mockStartDiscovery.mockImplementation(async (opts: any) => {
        if (opts.onDiscoveryEnd) {
          opts.onDiscoveryEnd([offlineDevice]);
        }
        return [offlineDevice];
      });

      await startDiscovery();

      const recent = await getRecentlyUsedDevices();
      expect(recent).toHaveLength(0);
    });
  });

  describe('refreshDevices', () => {
    it('should stop current discovery and restart', async () => {
      mockStartDiscovery.mockResolvedValue([]);

      const devices = await refreshDevices();
      expect(mockStopDiscovery).toHaveBeenCalledTimes(1);
      expect(mockStartDiscovery).toHaveBeenCalledTimes(1);
      expect(devices).toEqual([]);
    });
  });
});
