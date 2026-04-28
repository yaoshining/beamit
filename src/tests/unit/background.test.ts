/**
 * Background Service Worker Tests
 * Tests for extension lifecycle, message routing, and session restoration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Must set up mocks BEFORE importing background.ts
const mockStartDiscovery = vi.fn();
const mockStopDiscovery = vi.fn();
const mockClearState = vi.fn();
const mockRestoreSession = vi.fn();

vi.mock('@background-utils/devices/device-manager', () => ({
  startDiscovery: mockStartDiscovery,
  stopDiscovery: mockStopDiscovery,
  clearState: mockClearState,
}));

vi.mock('@background-utils/casting/playback-controller', () => ({
  restoreSession: mockRestoreSession,
}));

// Capture listener callbacks
let onInstalledCallback: ((details: any) => void) | null = null;
let onMessageCallback: ((message: any, sender: any, sendResponse: any) => void) | null = null;

// Override chrome.runtime and chrome.tabs mocks to capture callbacks
beforeEach(() => {
  onInstalledCallback = null;
  onMessageCallback = null;

  // Restore default mocks
  vi.clearAllMocks();

  // Set up chrome.runtime with proper listener capture
  (global as any).chrome = {
    ...(global as any).chrome,
    runtime: {
      ...(global as any).chrome?.runtime,
      onInstalled: {
        addListener: vi.fn((cb: any) => { onInstalledCallback = cb; }),
      },
      onMessage: {
        addListener: vi.fn((cb: any) => { onMessageCallback = cb; }),
      },
      // lastError is used by chrome.tabs.sendMessage callback pattern
      lastError: undefined as chrome.runtime.LastError | undefined,
    },
    tabs: {
      onActivated: {
        addListener: vi.fn(),
      },
      query: vi.fn(),
      sendMessage: vi.fn(),
    },
  };
});

describe('Background Service Worker', () => {
  beforeEach(async () => {
    // Reset mocks
    mockStartDiscovery.mockReset();
    mockStopDiscovery.mockReset();
    mockClearState.mockReset();
    mockRestoreSession.mockReset();
    mockRestoreSession.mockResolvedValue(null);

    // Dynamic import to trigger module execution each time
    vi.resetModules();
  });

  describe('onInstalled', () => {
    it('should register onInstalled listener on import', async () => {
      await import('../../background');
      expect(onInstalledCallback).not.toBeNull();
    });

    it('should restore session on install', async () => {
      const mockSession = { id: 'session-1', deviceId: 'tv-1' };
      mockRestoreSession.mockResolvedValue(mockSession);

      await import('../../background');

      // Trigger the onInstalled callback
      await onInstalledCallback!({ reason: 'install' });
      expect(mockRestoreSession).toHaveBeenCalled();
    });

    it('should not throw when no session to restore', async () => {
      mockRestoreSession.mockResolvedValue(null);

      await import('../../background');

      await expect(
        onInstalledCallback!({ reason: 'update' })
      ).resolves.toBeUndefined();
    });
  });

  describe('onMessage', () => {
    it('should register onMessage listener on import', async () => {
      await import('../../background');
      expect(onMessageCallback).not.toBeNull();
    });

    it('should handle START_DISCOVERY message', async () => {
      const devices = [{ id: 'tv-1', name: 'Living Room TV' }];
      mockStartDiscovery.mockResolvedValue(devices);

      await import('../../background');

      const sendResponse = vi.fn();
      onMessageCallback!({ type: 'START_DISCOVERY' }, {}, sendResponse);

      // Should return true to keep channel open
      // Wait for async response
      await new Promise(process.nextTick);
      expect(sendResponse).toHaveBeenCalledWith({ success: true, devices });
    });

    it('should handle START_DISCOVERY error', async () => {
      mockStartDiscovery.mockRejectedValue(new Error('Discovery failed'));

      await import('../../background');

      const sendResponse = vi.fn();
      onMessageCallback!({ type: 'START_DISCOVERY' }, {}, sendResponse);

      await new Promise(process.nextTick);
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Discovery failed',
      });
    });

    it('should handle STOP_DISCOVERY message', async () => {
      await import('../../background');

      const sendResponse = vi.fn();
      onMessageCallback!({ type: 'STOP_DISCOVERY' }, {}, sendResponse);

      expect(mockStopDiscovery).toHaveBeenCalledTimes(1);
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('should handle CLEAR_STATE message', async () => {
      await import('../../background');

      const sendResponse = vi.fn();
      onMessageCallback!({ type: 'CLEAR_STATE' }, {}, sendResponse);

      expect(mockClearState).toHaveBeenCalledTimes(1);
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('should handle unknown message type', async () => {
      await import('../../background');

      const sendResponse = vi.fn();
      onMessageCallback!({ type: 'UNKNOWN_TYPE' }, {}, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Unknown message type: UNKNOWN_TYPE',
      });
    });

    it('should handle DETECT_VIDEOS via tracked activeTabId (from onActivated)', async () => {
      const mockVideos = [{ id: 'v1', url: 'https://example.com/video.mp4', type: 'media' }];
      const mockTabId = 123;

      // Setup onActivated listener to capture callback
      let onActivatedCallback: ((info: any) => void) | null = null;
      (global as any).chrome.tabs.onActivated.addListener.mockImplementation(
        (cb: any) => { onActivatedCallback = cb; }
      );

      // Mock chrome.tabs.sendMessage to return video sources
      (global as any).chrome.tabs.sendMessage.mockImplementation(
        (_tabId: number, _message: any, callback: (response: any) => void) => {
          callback({ success: true, videos: mockVideos });
        }
      );

      await import('../../background');

      // Simulate onActivated event to set activeTabId
      onActivatedCallback!({ tabId: mockTabId, windowId: 1 });

      const sendResponse = vi.fn();
      onMessageCallback!({ type: 'DETECT_VIDEOS' }, {}, sendResponse);

      // Wait for async processing
      await new Promise(process.nextTick);

      // Should use tracked tab ID, not fallback to query
      expect(global.chrome.tabs.query).not.toHaveBeenCalled();
      expect(global.chrome.tabs.sendMessage).toHaveBeenCalledWith(
        mockTabId,
        { type: 'DETECT_VIDEOS' },
        expect.any(Function)
      );
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        videos: mockVideos,
      });
    });

    it('should handle DETECT_VIDEOS via fallback chrome.tabs.query (no onActivated yet)', async () => {
      const mockVideos = [{ id: 'v1', url: 'https://example.com/video.mp4', type: 'media' }];
      const mockTabId = 456;

      // Mock chrome.tabs.query (fallback path when activeTabId is null)
      (global as any).chrome.tabs.query.mockImplementation(
        (_queryInfo: any, callback: (tabs: any[]) => void) => {
          callback([{ id: mockTabId, url: 'https://example.com' }]);
        }
      );

      // Mock chrome.tabs.sendMessage to return video sources
      (global as any).chrome.tabs.sendMessage.mockImplementation(
        (_tabId: number, _message: any, callback: (response: any) => void) => {
          callback({ success: true, videos: mockVideos });
        }
      );

      await import('../../background');

      const sendResponse = vi.fn();
      onMessageCallback!({ type: 'DETECT_VIDEOS' }, {}, sendResponse);

      // Wait for async processing (chrome.tabs.query callback)
      await new Promise(process.nextTick);

      expect(global.chrome.tabs.query).toHaveBeenCalledWith(
        { active: true, currentWindow: true },
        expect.any(Function)
      );
      expect(global.chrome.tabs.sendMessage).toHaveBeenCalledWith(
        mockTabId,
        { type: 'DETECT_VIDEOS' },
        expect.any(Function)
      );
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        videos: mockVideos,
      });
    });

    it('should handle DETECT_VIDEOS when content script is not loaded', async () => {
      const mockTabId = 789;

      // Setup onActivated to set a tracked tab ID
      let onActivatedCallback: ((info: any) => void) | null = null;
      (global as any).chrome.tabs.onActivated.addListener.mockImplementation(
        (cb: any) => { onActivatedCallback = cb; }
      );

      // Mock chrome.tabs.sendMessage to simulate content script not available
      (global as any).chrome.tabs.sendMessage.mockImplementation(
        (_tabId: number, _message: any, callback: (response?: any) => void) => {
          (global as any).chrome.runtime.lastError = {
            message: 'Could not establish connection. Receiving end does not exist.',
          };
          callback();
          (global as any).chrome.runtime.lastError = undefined;
        }
      );

      await import('../../background');

      // Simulate onActivated to set tracked tab
      onActivatedCallback!({ tabId: mockTabId, windowId: 1 });

      const sendResponse = vi.fn();
      onMessageCallback!({ type: 'DETECT_VIDEOS' }, {}, sendResponse);

      await new Promise(process.nextTick);

      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: '内容脚本未加载: Could not establish connection. Receiving end does not exist.',
      });
    });

    it('should handle DETECT_VIDEOS when no active tab (fallback fails)', async () => {
      // Mock chrome.tabs.query to return no tabs (fallback path)
      (global as any).chrome.tabs.query.mockImplementation(
        (_queryInfo: any, callback: (tabs: any[]) => void) => {
          callback([]);
        }
      );

      await import('../../background');

      const sendResponse = vi.fn();
      onMessageCallback!({ type: 'DETECT_VIDEOS' }, {}, sendResponse);

      await new Promise(process.nextTick);

      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: '无法获取当前标签页',
      });
    });
  });

  describe('IIFE bootstrap', () => {
    it('should restore session on import', async () => {
      mockRestoreSession.mockResolvedValue({ id: 'session-1' });

      await import('../../background');

      expect(mockRestoreSession).toHaveBeenCalled();
    });

    it('should handle session restoration errors gracefully', async () => {
      mockRestoreSession.mockRejectedValue(new Error('Storage error'));

      // Should not throw
      await expect(import('../../background')).resolves.toBeDefined();
    });
  });
});
