/**
 * Device History Tests
 * Tests for device history storage, retrieval, and cleanup logic.
 * 
 * @file src/tests/unit/devices/device-history.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DeviceHistory, CastingDevice } from '@shared/types';

// Reference to the shared mock storage (initialized in setup.ts)
const mockStorage = (global as any).__mockStorageData as Record<string, any>;

const sampleDevice: CastingDevice = {
  id: 'dlna-uuid_test_device',
  name: 'Living Room TV',
  type: 'tv',
  protocol: 'dlna',
  address: '192.168.1.100',
  port: 1900,
  isOnline: true,
  lastSeen: Date.now(),
};

const sampleDevice2: CastingDevice = {
  id: 'dlna-uuid_speaker',
  name: 'Kitchen Speaker',
  type: 'speaker',
  protocol: 'dlna',
  address: '192.168.1.101',
  isOnline: true,
  lastSeen: Date.now(),
};

describe('DeviceHistory', () => {
  // Import after mocks are set up
  let deviceHistory: typeof import('@background-utils/devices/device-history');

  beforeEach(async () => {
    vi.clearAllMocks();
    // Clear mock storage
    (global as any).__clearMockStorage();
    deviceHistory = await import('@background-utils/devices/device-history');
  });

  describe('recordDeviceUsage', () => {
    it('should record first usage of a device', async () => {
      mockStorage['deviceHistory'] = [];
      await deviceHistory.recordDeviceUsage(sampleDevice);

      const history = mockStorage['deviceHistory'] as DeviceHistory[];
      expect(history).toHaveLength(1);
      expect(history[0].deviceId).toBe(sampleDevice.id);
      expect(history[0].useCount).toBe(1);
    });

    it('should increment use count for existing device', async () => {
      mockStorage['deviceHistory'] = [
        { deviceId: sampleDevice.id, lastUsed: Date.now() - 1000, useCount: 3 },
      ];
      await deviceHistory.recordDeviceUsage(sampleDevice);

      const history = mockStorage['deviceHistory'] as DeviceHistory[];
      expect(history).toHaveLength(1);
      expect(history[0].useCount).toBe(4);
      expect(history[0].lastUsed).toBeGreaterThan(Date.now() - 100);
    });

    it('should track multiple devices', async () => {
      mockStorage['deviceHistory'] = [];
      await deviceHistory.recordDeviceUsage(sampleDevice);
      await deviceHistory.recordDeviceUsage(sampleDevice2);

      const history = mockStorage['deviceHistory'] as DeviceHistory[];
      expect(history).toHaveLength(2);
    });

    it('should not exceed MAX_HISTORY_SIZE', async () => {
      const entries: DeviceHistory[] = Array.from({ length: 10 }, (_, i) => ({
        deviceId: `device-${i}`,
        lastUsed: Date.now() - i * 1000,
        useCount: 1,
      }));
      mockStorage['deviceHistory'] = entries;

      const newDevice: CastingDevice = {
        ...sampleDevice,
        id: 'device-new',
      };
      await deviceHistory.recordDeviceUsage(newDevice);

      const history = mockStorage['deviceHistory'] as DeviceHistory[];
      expect(history.length).toBeLessThanOrEqual(10);
    });
  });

  describe('getAllHistory', () => {
    it('should return history sorted by last used (newest first)', async () => {
      mockStorage['deviceHistory'] = [
        { deviceId: 'old', lastUsed: 100, useCount: 1 },
        { deviceId: 'new', lastUsed: 300, useCount: 1 },
        { deviceId: 'mid', lastUsed: 200, useCount: 1 },
      ];

      const history = await deviceHistory.getAllHistory();
      expect(history[0].deviceId).toBe('new');
      expect(history[1].deviceId).toBe('mid');
      expect(history[2].deviceId).toBe('old');
    });

    it('should return empty array when no history', async () => {
      mockStorage['deviceHistory'] = [];
      const history = await deviceHistory.getAllHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('getMostUsedDevice', () => {
    it('should return device with highest use count', async () => {
      mockStorage['deviceHistory'] = [
        { deviceId: 'a', lastUsed: 100, useCount: 5 },
        { deviceId: 'b', lastUsed: 200, useCount: 10 },
        { deviceId: 'c', lastUsed: 300, useCount: 3 },
      ];

      const mostUsed = await deviceHistory.getMostUsedDevice();
      expect(mostUsed?.deviceId).toBe('b');
      expect(mostUsed?.useCount).toBe(10);
    });

    it('should return null for empty history', async () => {
      mockStorage['deviceHistory'] = [];
      const mostUsed = await deviceHistory.getMostUsedDevice();
      expect(mostUsed).toBeNull();
    });
  });

  describe('removeDeviceFromHistory', () => {
    it('should remove a specific device from history', async () => {
      mockStorage['deviceHistory'] = [
        { deviceId: 'a', lastUsed: 100, useCount: 1 },
        { deviceId: 'b', lastUsed: 200, useCount: 1 },
      ];
      mockStorage['recentDevices'] = ['a', 'b'];

      await deviceHistory.removeDeviceFromHistory('a');

      const history = mockStorage['deviceHistory'] as DeviceHistory[];
      expect(history).toHaveLength(1);
      expect(history[0].deviceId).toBe('b');

      const recentIds = mockStorage['recentDevices'] as string[];
      expect(recentIds).not.toContain('a');
    });
  });

  describe('cleanStaleEntries', () => {
    it('should remove entries older than MAX_HISTORY_AGE_MS', async () => {
      const staleDate = Date.now() - 31 * 24 * 60 * 60 * 1000; // 31 days ago
      mockStorage['deviceHistory'] = [
        { deviceId: 'stale', lastUsed: staleDate, useCount: 1 },
        { deviceId: 'fresh', lastUsed: Date.now(), useCount: 1 },
      ];

      const removed = await deviceHistory.cleanStaleEntries();
      expect(removed).toBe(1);

      const history = mockStorage['deviceHistory'] as DeviceHistory[];
      expect(history).toHaveLength(1);
      expect(history[0].deviceId).toBe('fresh');
    });
  });

  describe('getHistoryStats', () => {
    it('should return correct statistics', async () => {
      mockStorage['deviceHistory'] = [
        { deviceId: 'a', lastUsed: Date.now(), useCount: 10 },
        { deviceId: 'b', lastUsed: Date.now(), useCount: 5 },
      ];

      const stats = await deviceHistory.getHistoryStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.uniqueDevices).toBe(2);
      expect(stats.mostUsedDevice?.deviceId).toBe('a');
    });
  });

  describe('getDeviceUsageCount', () => {
    it('should return usage count for existing device', async () => {
      mockStorage['deviceHistory'] = [
        { deviceId: 'a', lastUsed: Date.now(), useCount: 7 },
      ];

      const count = await deviceHistory.getDeviceUsageCount('a');
      expect(count).toBe(7);
    });

    it('should return 0 for non-existent device', async () => {
      mockStorage['deviceHistory'] = [];
      const count = await deviceHistory.getDeviceUsageCount('nonexistent');
      expect(count).toBe(0);
    });
  });

  describe('clearAllHistory', () => {
    it('should clear all history and recent devices', async () => {
      mockStorage['deviceHistory'] = [
        { deviceId: 'a', lastUsed: 100, useCount: 1 },
      ];
      mockStorage['recentDevices'] = ['a'];

      await deviceHistory.clearAllHistory();

      expect(mockStorage['deviceHistory']).toEqual([]);
      expect(mockStorage['recentDevices']).toEqual([]);
    });
  });
});
