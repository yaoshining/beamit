/**
 * Device Recommender Tests
 * Tests for device ranking, recommendation, and sorting logic.
 * 
 * @file src/tests/unit/devices/device-recommender.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CastingDevice } from '@shared/types';

// Mock chrome.storage
const mockStorage: Record<string, any> = {};
vi.mock('@plasmohq/storage', () => ({
  Storage: vi.fn().mockImplementation(() => ({
    get: vi.fn(async (key: string) => mockStorage[key] ?? null),
    set: vi.fn(async (key: string, value: any) => {
      mockStorage[key] = value;
    }),
  })),
}));

// Mock isDeviceOnline from device-manager
vi.mock('@background-utils/devices/device-manager', () => ({
  isDeviceOnline: vi.fn(async (device: CastingDevice) => device.isOnline),
}));

function createDevice(
  id: string,
  name: string,
  overrides: Partial<CastingDevice> = {}
): CastingDevice {
  return {
    id,
    name,
    type: 'tv',
    protocol: 'dlna',
    address: '192.168.1.100',
    isOnline: true,
    lastSeen: Date.now(),
    ...overrides,
  };
}

describe('DeviceRecommender', () => {
  let recommender: typeof import('@background-utils/devices/device-recommender');

  beforeEach(async () => {
    vi.clearAllMocks();
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    recommender = await import('@background-utils/devices/device-recommender');
  });

  describe('getRecommendedDevices', () => {
    it('should return devices sorted by hybrid score', async () => {
      const devices = [
        createDevice('tv-1', 'Living Room TV', { isOnline: true }),
        createDevice('tv-2', 'Bedroom TV', { isOnline: false }),
      ];

      mockStorage['deviceHistory'] = [
        { deviceId: 'tv-1', lastUsed: Date.now(), useCount: 10 },
        { deviceId: 'tv-2', lastUsed: Date.now() - 86400000, useCount: 2 },
      ];

      const recommendations = await recommender.getRecommendedDevices(devices);
      expect(recommendations).toHaveLength(2);
      // Online device should be ranked first
      expect(recommendations[0].device.id).toBe('tv-1');
      expect(recommendations[0].score).toBeGreaterThan(recommendations[1].score);
    });

    it('should return empty array for empty input', async () => {
      const result = await recommender.getRecommendedDevices([]);
      expect(result).toHaveLength(0);
    });

    it('should include reasons in recommendation', async () => {
      const devices = [createDevice('tv-1', 'Living Room TV', { isOnline: true })];
      mockStorage['deviceHistory'] = [
        { deviceId: 'tv-1', lastUsed: Date.now(), useCount: 5 },
      ];

      const [rec] = await recommender.getRecommendedDevices(devices);
      expect(rec.reasons.length).toBeGreaterThan(0);
      expect(rec.reasons.some((r) => r.includes('使用'))).toBe(true);
    });
  });

  describe('sortDevices', () => {
    it('should sort by frequency strategy', async () => {
      const devices = [
        createDevice('a', 'Device A'),
        createDevice('b', 'Device B'),
      ];

      mockStorage['deviceHistory'] = [
        { deviceId: 'a', lastUsed: Date.now(), useCount: 1 },
        { deviceId: 'b', lastUsed: Date.now(), useCount: 10 },
      ];

      const sorted = await recommender.sortDevices(devices, 'frequency');
      expect(sorted[0].id).toBe('b'); // Higher frequency first
    });

    it('should sort by recency strategy', async () => {
      const devices = [
        createDevice('old', 'Old Device'),
        createDevice('new', 'New Device'),
      ];

      mockStorage['deviceHistory'] = [
        { deviceId: 'old', lastUsed: Date.now() - 86400000, useCount: 1 },
        { deviceId: 'new', lastUsed: Date.now(), useCount: 1 },
      ];

      const sorted = await recommender.sortDevices(devices, 'recency');
      expect(sorted[0].id).toBe('new'); // More recent first
    });

    it('should sort by availability strategy', async () => {
      const devices = [
        createDevice('offline', 'Offline TV', { isOnline: false }),
        createDevice('online', 'Online TV', { isOnline: true }),
      ];

      const sorted = await recommender.sortDevices(devices, 'availability');
      expect(sorted[0].id).toBe('online'); // Online first
    });

    it('should sort by hybrid strategy (online + recency)', async () => {
      const devices = [
        createDevice('offline-recent', 'Offline Recent', {
          isOnline: false,
          lastSeen: Date.now(),
        }),
        createDevice('online-old', 'Online Old', {
          isOnline: true,
          lastSeen: Date.now() - 86400000,
        }),
      ];

      const sorted = await recommender.sortDevices(devices, 'hybrid');
      expect(sorted[0].id).toBe('online-old'); // Online trumps recency
    });

    it('should not mutate original array', async () => {
      const devices = [
        createDevice('b', 'Device B'),
        createDevice('a', 'Device A'),
      ];
      const originalOrder = devices.map((d) => d.id);

      await recommender.sortDevices(devices, 'frequency');
      expect(devices.map((d) => d.id)).toEqual(originalOrder);
    });
  });

  describe('getBestDevice', () => {
    it('should return the highest ranked device', async () => {
      const devices = [
        createDevice('low', 'Low Priority', { isOnline: false }),
        createDevice('high', 'High Priority', { isOnline: true }),
      ];

      mockStorage['deviceHistory'] = [
        { deviceId: 'high', lastUsed: Date.now(), useCount: 10 },
        { deviceId: 'low', lastUsed: Date.now(), useCount: 1 },
      ];

      const best = await recommender.getBestDevice(devices);
      expect(best?.device.id).toBe('high');
    });

    it('should return null for empty devices', async () => {
      const best = await recommender.getBestDevice([]);
      expect(best).toBeNull();
    });
  });

  describe('filterRecommendedDevices', () => {
    it('should only return online recommended devices', async () => {
      const devices = [
        createDevice('online-used', 'Online Used', { isOnline: true }),
        createDevice('offline-used', 'Offline Used', { isOnline: false }),
      ];

      mockStorage['deviceHistory'] = [
        { deviceId: 'online-used', lastUsed: Date.now(), useCount: 5 },
        { deviceId: 'offline-used', lastUsed: Date.now(), useCount: 3 },
      ];

      const filtered = await recommender.filterRecommendedDevices(devices);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('online-used');
    });
  });

  describe('getDeviceUsageSummary', () => {
    it('should return usage summary for known device', async () => {
      mockStorage['deviceHistory'] = [
        { deviceId: 'tv-1', lastUsed: Date.now(), useCount: 5 },
      ];

      const summary = await recommender.getDeviceUsageSummary('tv-1');
      expect(summary.useCount).toBe(5);
      expect(summary.lastUsed).toBe('今天');
      expect(summary.isFrequent).toBe(true);
    });

    it('should return default for unknown device', async () => {
      mockStorage['deviceHistory'] = [];
      const summary = await recommender.getDeviceUsageSummary('unknown');
      expect(summary.useCount).toBe(0);
      expect(summary.lastUsed).toBe('从未使用');
      expect(summary.isFrequent).toBe(false);
    });

    it('should show "昨天" for device used yesterday', async () => {
      mockStorage['deviceHistory'] = [
        {
          deviceId: 'tv-1',
          lastUsed: Date.now() - 86400000,
          useCount: 2,
        },
      ];

      const summary = await recommender.getDeviceUsageSummary('tv-1');
      expect(summary.lastUsed).toBe('昨天');
      expect(summary.isFrequent).toBe(false);
    });
  });
});
