/**
 * Unit tests for shared storage functions.
 *
 * @file src/tests/unit/shared/storage.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CastingDevice, VideoSource, DeviceHistory, CastingSession } from '@shared/types';

// Mock @plasmohq/storage - use inline vi.fn() inside mock callback
// to avoid hoisting issues with let/const variables
const mockStorage = new Map<string, any>();

vi.mock('@plasmohq/storage', () => ({
  Storage: vi.fn().mockImplementation(() => ({
    set: vi.fn(async (key: string, value: any) => {
      mockStorage.set(key, value);
    }),
    get: vi.fn(async (key: string) => mockStorage.get(key)),
    remove: vi.fn(async (key: string) => mockStorage.delete(key)),
    clear: vi.fn(async () => mockStorage.clear())
  }))
}));

// Now import the functions after mocking
import {
  setDeviceHistory,
  getDeviceHistory,
  addToDeviceHistory,
  getRecentDeviceIds,
  setRecentDevices,
  getRecentDevices,
  setCurrentSession,
  getCurrentSession,
  setDetectedVideos,
  getDetectedVideos,
  setDiscoveredDevices,
  getDiscoveredDevices,
  clearSessionStorage,
  getSettings,
  setSettings,
  Settings
} from '@shared/storage';

describe('Storage Functions', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  describe('device history', () => {
    it('should set and get device history', async () => {
      const history: DeviceHistory[] = [
        { deviceId: 'dev-1', lastUsed: Date.now(), useCount: 5 }
      ];

      await setDeviceHistory(history);
      const result = await getDeviceHistory();

      expect(result).toEqual(history);
    });

    it('should return empty array when no history exists', async () => {
      const result = await getDeviceHistory();
      expect(result).toEqual([]);
    });

    it('should add new device to history', async () => {
      const device: CastingDevice = {
        id: 'dev-1',
        name: 'TV',
        type: 'tv',
        protocol: 'dlna',
        address: '192.168.1.100',
        port: 8080,
        lastSeen: Date.now(),
        isOnline: true
      };

      await addToDeviceHistory(device);
      const history = await getDeviceHistory();

      expect(history).toHaveLength(1);
      expect(history[0].deviceId).toBe('dev-1');
      expect(history[0].useCount).toBe(1);
    });

    it('should increment use count for existing device', async () => {
      const device: CastingDevice = {
        id: 'dev-1',
        name: 'TV',
        type: 'tv',
        protocol: 'dlna',
        address: '192.168.1.100',
        port: 8080,
        lastSeen: Date.now(),
        isOnline: true
      };

      await addToDeviceHistory(device);
      await addToDeviceHistory(device);
      const history = await getDeviceHistory();

      expect(history[0].useCount).toBe(2);
    });

    it('should cap history at 10 entries', async () => {
      for (let i = 0; i < 15; i++) {
        const device: CastingDevice = {
          id: `dev-${i}`,
          name: `Device ${i}`,
          type: 'tv',
          protocol: 'dlna',
          address: `192.168.1.${i + 1}`,
          port: 8080,
          lastSeen: Date.now(),
          isOnline: true
        };
        await addToDeviceHistory(device);
      }

      const history = await getDeviceHistory();
      expect(history.length).toBeLessThanOrEqual(10);
    });

    it('should get recent device IDs sorted by last used', async () => {
      const device1: CastingDevice = {
        id: 'dev-old',
        name: 'Old TV',
        type: 'tv',
        protocol: 'dlna',
        address: '192.168.1.100',
        port: 8080,
        lastSeen: Date.now() - 3600000, // 1 hour ago
        isOnline: false
      };
      const device2: CastingDevice = {
        id: 'dev-new',
        name: 'New TV',
        type: 'tv',
        protocol: 'dlna',
        address: '192.168.1.101',
        port: 8080,
        lastSeen: Date.now(),
        isOnline: true
      };

      await addToDeviceHistory(device1);
      await addToDeviceHistory(device2);
      const ids = await getRecentDeviceIds();

      expect(ids[0]).toBe('dev-new'); // most recent first
      expect(ids[1]).toBe('dev-old');
    });
  });

  describe('recent devices', () => {
    it('should set and get recent devices', async () => {
      await setRecentDevices(['dev-1', 'dev-2']);
      const result = await getRecentDevices();
      expect(result).toEqual(['dev-1', 'dev-2']);
    });

    it('should return empty array when no recent devices', async () => {
      const result = await getRecentDevices();
      expect(result).toEqual([]);
    });
  });

  describe('session management', () => {
    it('should set and get current session', async () => {
      const session: CastingSession = {
        id: 'session-1',
        deviceId: 'dev-1',
        videoSourceId: 'src-1',
        status: 'playing',
        startedAt: Date.now()
      };

      await setCurrentSession(session);
      const result = await getCurrentSession();
      expect(result).toEqual(session);
    });

    it('should remove session when null is passed', async () => {
      const session: CastingSession = {
        id: 'session-1',
        deviceId: 'dev-1',
        videoSourceId: 'src-1',
        status: 'playing',
        startedAt: Date.now()
      };

      await setCurrentSession(session);
      await setCurrentSession(null);
      const result = await getCurrentSession();
      expect(result).toBeNull();
    });

    it('should return null when no session exists', async () => {
      const result = await getCurrentSession();
      expect(result).toBeNull();
    });
  });

  describe('detected videos', () => {
    it('should set and get detected videos', async () => {
      const videos: VideoSource[] = [
        {
          id: 'vid-1',
          url: 'https://example.com/video.mp4',
          type: 'media',
          pageUrl: 'https://example.com',
          pageTitle: 'Test',
          duration: 120,
          detectedAt: Date.now()
        }
      ];

      await setDetectedVideos(videos);
      const result = await getDetectedVideos();
      expect(result).toEqual(videos);
    });

    it('should return empty array when no videos', async () => {
      const result = await getDetectedVideos();
      expect(result).toEqual([]);
    });
  });

  describe('discovered devices', () => {
    it('should set and get discovered devices', async () => {
      const devices: CastingDevice[] = [
        {
          id: 'dev-1',
          name: 'TV',
          type: 'tv',
          protocol: 'dlna',
          address: '192.168.1.100',
          port: 8080,
          lastSeen: Date.now(),
          isOnline: true
        }
      ];

      await setDiscoveredDevices(devices);
      const result = await getDiscoveredDevices();
      expect(result).toEqual(devices);
    });

    it('should return empty array when no devices', async () => {
      const result = await getDiscoveredDevices();
      expect(result).toEqual([]);
    });
  });

  describe('session storage', () => {
    it('should clear session storage', async () => {
      await clearSessionStorage();
    });
  });

  describe('settings', () => {
    it('should return default settings when none stored', async () => {
      const settings = await getSettings();
      expect(settings).toEqual({
        autoPlay: true,
        deviceTimeout: 5000,
        showNotifications: true
      });
    });

    it('should set and get custom settings', async () => {
      const customSettings: Settings = {
        autoPlay: false,
        deviceTimeout: 10000,
        showNotifications: false
      };

      await setSettings(customSettings);
      const result = await getSettings();
      expect(result).toEqual(customSettings);
    });

    it('should not mutate default settings', async () => {
      const settings = await getSettings();
      settings.autoPlay = false;

      // Get again - should still be defaults
      const settings2 = await getSettings();
      expect(settings2.autoPlay).toBe(true);
    });
  });
});
