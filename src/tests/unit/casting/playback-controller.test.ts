// Playback Controller Tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CastingDevice, CastingSession, VideoSource } from '@shared/types';

// Mock storage module
const mockGetCurrentSession = vi.fn();
const mockSetCurrentSession = vi.fn();

vi.mock('@shared/storage', () => ({
  getCurrentSession: mockGetCurrentSession,
  setCurrentSession: mockSetCurrentSession,
}));

// Mock dlna-player module
const mockStartCasting = vi.fn();
const mockStopCasting = vi.fn();
const mockPauseFn = vi.fn();
const mockPlayFn = vi.fn();
const mockSeekFn = vi.fn();
const mockGetPosition = vi.fn();
const mockSetVolumeFn = vi.fn();

vi.mock('@background-utils/casting/dlna-player', () => ({
  startCasting: mockStartCasting,
  stopCasting: mockStopCasting,
  pause: mockPauseFn,
  play: mockPlayFn,
  seek: mockSeekFn,
  getPosition: mockGetPosition,
  setVolume: mockSetVolumeFn,
}));

function createDevice(overrides: Partial<CastingDevice> = {}): CastingDevice {
  return {
    id: 'tv-1',
    name: 'Living Room TV',
    address: '192.168.1.100',
    port: 1900,
    type: 'tv',
    protocol: 'dlna',
    isOnline: true,
    lastSeen: Date.now(),
    ...overrides,
  } as CastingDevice;
}

function createVideoSource(overrides: Partial<VideoSource> = {}): VideoSource {
  return {
    id: 'video-1',
    url: 'https://example.com/video.mp4',
    type: 'media',
    pageUrl: 'https://example.com/page',
    detectedAt: Date.now(),
    pageTitle: 'My Video',
    ...overrides,
  } as VideoSource;
}

function createSession(overrides: Partial<CastingSession> = {}): CastingSession {
  return {
    id: 'session-1',
    deviceId: 'tv-1',
    deviceName: 'Living Room TV',
    videoId: 'video-1',
    videoTitle: 'My Video',
    videoUrl: 'https://example.com/video.mp4',
    status: 'playing',
    startedAt: Date.now(),
    ...overrides,
  } as CastingSession;
}

describe('PlaybackController', () => {
  let playbackController: typeof import('@background-utils/casting/playback-controller');

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.useFakeTimers();

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Reset all mock implementations to prevent leakage between tests
    mockGetCurrentSession.mockReset();
    mockSetCurrentSession.mockReset();
    mockStartCasting.mockReset();
    mockStopCasting.mockReset();
    mockPauseFn.mockReset();
    mockPlayFn.mockReset();
    mockSeekFn.mockReset();
    mockGetPosition.mockReset();
    mockSetVolumeFn.mockReset();

    // Set default successful implementations
    mockGetCurrentSession.mockResolvedValue(null);
    mockSetCurrentSession.mockResolvedValue(undefined);
    mockStartCasting.mockResolvedValue(createSession());
    mockStopCasting.mockResolvedValue(undefined);
    mockPauseFn.mockResolvedValue(undefined);
    mockPlayFn.mockResolvedValue(undefined);
    mockSeekFn.mockResolvedValue(undefined);
    mockGetPosition.mockResolvedValue(0);
    mockSetVolumeFn.mockResolvedValue(undefined);

    playbackController = await import('@background-utils/casting/playback-controller');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('subscribe / getState', () => {
    it('should return initial state', () => {
      const state = playbackController.getState();
      expect(state.session).toBeNull();
      expect(state.isPlaying).toBe(false);
      expect(state.position).toBe(0);
      expect(state.duration).toBe(0);
      expect(state.volume).toBe(100);
      expect(state.error).toBeNull();
    });

    it('should return a copy of state, not the original object', () => {
      const state1 = playbackController.getState();
      state1.isPlaying = true;
      const state2 = playbackController.getState();
      expect(state2.isPlaying).toBe(false);
    });

    it('should notify subscribers on state change', async () => {
      const callback = vi.fn();
      playbackController.subscribe(callback);

      mockStartCasting.mockResolvedValue(createSession());
      await playbackController.startPlayback(createDevice(), createVideoSource());

      expect(callback).toHaveBeenCalled();
      const calledState = callback.mock.calls[0][0];
      expect(calledState.isPlaying).toBe(true);
      expect(calledState.session).not.toBeNull();
    });

    it('should unsubscribe correctly', () => {
      const callback = vi.fn();
      const unsubscribe = playbackController.subscribe(callback);
      unsubscribe();
      // Trigger a state change via clearError
      playbackController.clearError();
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('startPlayback', () => {
    it('should start playback successfully', async () => {
      const session = createSession();
      mockStartCasting.mockResolvedValue(session);
      const device = createDevice();
      const source = createVideoSource();

      const result = await playbackController.startPlayback(device, source);

      expect(mockStartCasting).toHaveBeenCalledWith(device, source);
      expect(mockSetCurrentSession).toHaveBeenCalledWith(session);
      expect(result).toEqual(session);

      const state = playbackController.getState();
      expect(state.session).toEqual(session);
      expect(state.isPlaying).toBe(true);
      expect(state.position).toBe(0);
      expect(state.error).toBeNull();
    });

    it('should stop existing session before starting new one', async () => {
      const session1 = createSession({ id: 'session-1' });
      const session2 = createSession({ id: 'session-2' });
      mockStartCasting.mockResolvedValueOnce(session1).mockResolvedValueOnce(session2);

      const device = createDevice();
      const source = createVideoSource();

      // Start first playback
      await playbackController.startPlayback(device, source);
      // Start second playback (should stop first)
      await playbackController.startPlayback(device, source);

      // stopCasting should have been called for the first session
      expect(mockStopCasting).toHaveBeenCalled();
    });

    it('should handle errors during start', async () => {
      mockStartCasting.mockRejectedValue(new Error('Device unreachable'));
      const device = createDevice();
      const source = createVideoSource();

      await expect(playbackController.startPlayback(device, source)).rejects.toThrow('Device unreachable');

      const state = playbackController.getState();
      expect(state.session).toBeNull();
      expect(state.isPlaying).toBe(false);
      expect(state.error).toBe('Device unreachable');
    });

    it('should handle non-Error exceptions', async () => {
      mockStartCasting.mockRejectedValue('string error');
      const device = createDevice();
      const source = createVideoSource();

      await expect(playbackController.startPlayback(device, source)).rejects.toBe('string error');

      const state = playbackController.getState();
      expect(state.error).toBe('Failed to start playback');
    });
  });

  describe('stopPlayback', () => {
    it('should stop playback with active session', async () => {
      mockStartCasting.mockResolvedValue(createSession());
      const device = createDevice();
      const source = createVideoSource();

      await playbackController.startPlayback(device, source);
      await playbackController.stopPlayback();

      expect(mockStopCasting).toHaveBeenCalled();
      expect(mockSetCurrentSession).toHaveBeenCalledWith(null);

      const state = playbackController.getState();
      expect(state.session).toBeNull();
      expect(state.isPlaying).toBe(false);
      expect(state.position).toBe(0);
    });

    it('should do nothing without active session', async () => {
      await playbackController.stopPlayback();
      expect(mockStopCasting).not.toHaveBeenCalled();
      expect(mockSetCurrentSession).toHaveBeenCalledTimes(0);
    });

    it('should handle errors from dlnaPlayer.stopCasting gracefully', async () => {
      mockStartCasting.mockResolvedValue(createSession());
      mockStopCasting.mockRejectedValue(new Error('Network error'));

      await playbackController.startPlayback(createDevice(), createVideoSource());
      // Should not throw - error is caught and logged
      await expect(playbackController.stopPlayback()).resolves.not.toThrow();

      // Session should still be cleared
      const state = playbackController.getState();
      expect(state.session).toBeNull();
      expect(state.isPlaying).toBe(false);
    });
  });

  describe('pausePlayback', () => {
    it('should pause when playing', async () => {
      mockStartCasting.mockResolvedValue(createSession());
      const device = createDevice();

      await playbackController.startPlayback(device, createVideoSource());
      await playbackController.pausePlayback(device);

      expect(mockPauseFn).toHaveBeenCalledWith(device);
      expect(playbackController.getState().isPlaying).toBe(false);
    });

    it('should do nothing when not playing', async () => {
      const device = createDevice();
      await playbackController.pausePlayback(device);

      expect(mockPauseFn).not.toHaveBeenCalled();
    });

    it('should propagate pause errors', async () => {
      mockStartCasting.mockResolvedValue(createSession());
      mockPauseFn.mockRejectedValue(new Error('Pause failed'));
      const device = createDevice();

      await playbackController.startPlayback(device, createVideoSource());
      await expect(playbackController.pausePlayback(device)).rejects.toThrow('Pause failed');

      expect(playbackController.getState().error).toBe('Pause failed');
    });
  });

  describe('resumePlayback', () => {
    it('should resume when paused', async () => {
      mockStartCasting.mockResolvedValue(createSession());
      const device = createDevice();

      await playbackController.startPlayback(device, createVideoSource());
      await playbackController.pausePlayback(device);
      expect(playbackController.getState().isPlaying).toBe(false);

      await playbackController.resumePlayback(device);

      expect(mockPlayFn).toHaveBeenCalledWith(device);
      expect(playbackController.getState().isPlaying).toBe(true);
    });

    it('should do nothing when already playing', async () => {
      mockStartCasting.mockResolvedValue(createSession());
      const device = createDevice();

      await playbackController.startPlayback(device, createVideoSource());
      await playbackController.resumePlayback(device);

      expect(mockPlayFn).not.toHaveBeenCalled();
    });

    it('should propagate resume errors', async () => {
      mockStartCasting.mockResolvedValue(createSession());
      mockPlayFn.mockRejectedValue(new Error('Resume failed'));
      const device = createDevice();

      await playbackController.startPlayback(device, createVideoSource());
      await playbackController.pausePlayback(device);
      await expect(playbackController.resumePlayback(device)).rejects.toThrow('Resume failed');

      expect(playbackController.getState().error).toBe('Resume failed');
    });
  });

  describe('seekTo', () => {
    it('should seek to position', async () => {
      mockStartCasting.mockResolvedValue(createSession());
      mockSeekFn.mockResolvedValue(undefined);
      const device = createDevice();

      await playbackController.startPlayback(device, createVideoSource());
      await playbackController.seekTo(device, 65);

      expect(mockSeekFn).toHaveBeenCalledWith(device, 65);
      expect(playbackController.getState().position).toBe(65);
    });

    it('should propagate seek errors', async () => {
      mockSeekFn.mockRejectedValue(new Error('Seek failed'));
      const device = createDevice();

      await expect(playbackController.seekTo(device, 30)).rejects.toThrow('Seek failed');
      expect(playbackController.getState().error).toBe('Seek failed');
    });
  });

  describe('getCurrentPosition', () => {
    it('should return current position', async () => {
      mockGetPosition.mockResolvedValue(120);
      const device = createDevice();
      mockStartCasting.mockResolvedValue(createSession());
      await playbackController.startPlayback(device, createVideoSource());

      const position = await playbackController.getCurrentPosition(device);
      expect(position).toBe(120);
      expect(playbackController.getState().position).toBe(120);
    });

    it('should return last known position on error', async () => {
      mockGetPosition.mockRejectedValue(new Error('Network error'));
      const device = createDevice();

      // Set initial position
      const controller = playbackController;
      controller.getState(); // Just to reference

      // Position starts at 0
      const position = await controller.getCurrentPosition(device);
      expect(position).toBe(0);
    });
  });

  describe('setVolume', () => {
    it('should set volume', async () => {
      mockSetVolumeFn.mockResolvedValue(undefined);
      const device = createDevice();

      await playbackController.setVolume(device, 75);

      expect(mockSetVolumeFn).toHaveBeenCalledWith(device, 75);
      expect(playbackController.getState().volume).toBe(75);
    });

    it('should clamp volume to 0-100', async () => {
      mockSetVolumeFn.mockResolvedValue(undefined);
      const device = createDevice();

      await playbackController.setVolume(device, 150);
      expect(mockSetVolumeFn).toHaveBeenCalledWith(device, 100);
      expect(playbackController.getState().volume).toBe(100);

      await playbackController.setVolume(device, -10);
      expect(mockSetVolumeFn).toHaveBeenCalledWith(device, 0);
      expect(playbackController.getState().volume).toBe(0);
    });

    it('should propagate volume errors', async () => {
      mockSetVolumeFn.mockRejectedValue(new Error('Volume failed'));
      const device = createDevice();

      await expect(playbackController.setVolume(device, 50)).rejects.toThrow('Volume failed');
      expect(playbackController.getState().error).toBe('Volume failed');
    });
  });

  describe('restoreSession', () => {
    it('should restore a playing session', async () => {
      const session = createSession({ status: 'playing' });
      mockGetCurrentSession.mockResolvedValue(session);

      const result = await playbackController.restoreSession();

      expect(result).toEqual(session);
      expect(playbackController.getState().session).toEqual(session);
      expect(playbackController.getState().isPlaying).toBe(true);
    });

    it('should not restore a non-playing session', async () => {
      const session = createSession({ status: 'stopped' });
      mockGetCurrentSession.mockResolvedValue(session);

      const result = await playbackController.restoreSession();

      expect(result).toEqual(session);
      expect(playbackController.getState().session).toBeNull();
      expect(playbackController.getState().isPlaying).toBe(false);
    });

    it('should handle no session', async () => {
      mockGetCurrentSession.mockResolvedValue(null);

      const result = await playbackController.restoreSession();

      expect(result).toBeNull();
      expect(playbackController.getState().session).toBeNull();
    });
  });

  describe('clearError', () => {
    it('should clear error state', async () => {
      mockStartCasting.mockRejectedValue(new Error('Test error'));

      // startPlayback will reject and set the error state
      await expect(playbackController.startPlayback(createDevice(), createVideoSource())).rejects.toThrow('Test error');

      expect(playbackController.getState().error).toBe('Test error');

      playbackController.clearError();
      expect(playbackController.getState().error).toBeNull();
    });
  });

  describe('state transitions', () => {
    it('should transition through play-pause-resume-stop lifecycle', async () => {
      mockStartCasting.mockResolvedValue(createSession());
      const device = createDevice();
      const source = createVideoSource();

      // Idle → Playing
      await playbackController.startPlayback(device, source);
      expect(playbackController.getState().isPlaying).toBe(true);

      // Playing → Paused
      await playbackController.pausePlayback(device);
      expect(playbackController.getState().isPlaying).toBe(false);

      // Paused → Playing
      await playbackController.resumePlayback(device);
      expect(playbackController.getState().isPlaying).toBe(true);

      // Playing → Stopped (Idle)
      await playbackController.stopPlayback();
      expect(playbackController.getState().session).toBeNull();
      expect(playbackController.getState().isPlaying).toBe(false);
    });
  });
});
