/**
 * DLNA Player Tests
 * Tests for DLNA/UPnP AVTransport protocol media playback control
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CastingDevice, VideoSource } from '@shared/types';

// Mock storage module - use arrays to capture values at call time (before mutation)
const sessionStatusAtCall: string[] = [];
const mockSetCurrentSession = vi.fn((session: any) => {
  sessionStatusAtCall.push(session.status);
});
const mockGetCurrentSession = vi.fn();
const mockGetDiscoveredDevices = vi.fn();

vi.mock('@shared/storage', () => ({
  setCurrentSession: mockSetCurrentSession,
  getCurrentSession: mockGetCurrentSession,
  getDiscoveredDevices: mockGetDiscoveredDevices,
}));

// Helper to create a mock fetch Response
function mockFetchResponse(text: string, ok = true, status = 200, statusText = 'OK') {
  return Promise.resolve({
    ok,
    status,
    statusText,
    text: () => Promise.resolve(text),
  } as Response);
}

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

describe('DLNAPlayer', () => {
  let dlnaPlayer: typeof import('@background-utils/casting/dlna-player');

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    sessionStatusAtCall.length = 0;

    // Mock global.fetch
    global.fetch = vi.fn().mockResolvedValue(mockFetchResponse('OK'));

    // Mock crypto.randomUUID
    if (!global.crypto) {
      (global as any).crypto = {};
    }
    (global as any).crypto.randomUUID = vi.fn(() => 'test-uuid-12345');

    // Suppress console logs
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    dlnaPlayer = await import('@background-utils/casting/dlna-player');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPlaybackState', () => {
    it('should return default playback state', () => {
      const state = dlnaPlayer.getPlaybackState();
      expect(state).toEqual({
        isPlaying: false,
        position: 0,
        duration: 0,
        volume: 100,
        mute: false,
      });
    });

    it('should return a copy, not the original object', () => {
      const state = dlnaPlayer.getPlaybackState();
      state.isPlaying = true;
      const state2 = dlnaPlayer.getPlaybackState();
      expect(state2.isPlaying).toBe(false);
    });
  });

  describe('setMediaUrl', () => {
    it('should send SetAVTransportURI SOAP request', async () => {
      const device = createDevice();
      const source = createVideoSource();

      await dlnaPlayer.setMediaUrl(device, source);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const fetchCall = (global.fetch as any).mock.calls[0];
      const [url, options] = fetchCall;

      expect(url).toBe('http://192.168.1.100:1900/upnp/control/avtransport');

      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('text/xml; charset="utf-8"');
      expect(options.headers.SOAPACTION).toBe('"urn:schemas-upnp-org:service:AVTransport:1#SetAVTransportURI"');

      const body: string = options.body;
      expect(body).toContain('My Video');
      expect(body).toContain('<InstanceID>0</InstanceID>');
      expect(body).toContain('<CurrentURI>https://example.com/video.mp4</CurrentURI>');
      expect(body).toContain('My Video');
    });

    it('should handle devices with default port when port is not specified', async () => {
      const device = createDevice({ port: undefined });
      const source = createVideoSource();

      await dlnaPlayer.setMediaUrl(device, source);

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toBe('http://192.168.1.100:1900/upnp/control/avtransport');
    });

    it('should escape XML special characters in metadata (double-escaped for SOAP)', async () => {
      const source = createVideoSource({
        pageTitle: 'Video <Test> & "Fun"',
      });
      const device = createDevice();

      await dlnaPlayer.setMediaUrl(device, source);

      const body: string = (global.fetch as any).mock.calls[0][1].body;
      // XML is escaped twice: once in metadata DIDL-Lite, then again in SOAP envelope
      // Original: Video <Test> & "Fun"
      // After 1st escapeXml: Video <Test> & "Fun"
      // After 2nd escapeXml: Video &lt;Test&gt; &amp; &quot;Fun&quot;
      expect(body).toContain('Video &amp;lt;Test&amp;gt; &amp;amp; &amp;quot;Fun&amp;quot;');
    });
  });

  describe('play', () => {
    it('should send Play SOAP request', async () => {
      await dlnaPlayer.play(createDevice());

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const body: string = (global.fetch as any).mock.calls[0][1].body;

      expect(body).toContain('Play');
      expect(body).toContain('<InstanceID>0</InstanceID>');
      expect(body).toContain('<Speed>1</Speed>');

      const state = dlnaPlayer.getPlaybackState();
      expect(state.isPlaying).toBe(true);
    });

    it('should propagate fetch errors', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      await expect(dlnaPlayer.play(createDevice())).rejects.toThrow('Network error');
    });
  });

  describe('pause', () => {
    it('should send Pause SOAP request', async () => {
      (global.fetch as any).mockResolvedValue(mockFetchResponse('OK'));
      await dlnaPlayer.play(createDevice());
      expect(dlnaPlayer.getPlaybackState().isPlaying).toBe(true);

      await dlnaPlayer.pause(createDevice());

      const body: string = (global.fetch as any).mock.calls[1][1].body;
      expect(body).toContain('Pause');
      expect(body).toContain('<InstanceID>0</InstanceID>');

      expect(dlnaPlayer.getPlaybackState().isPlaying).toBe(false);
    });
  });

  describe('stop', () => {
    it('should send Stop SOAP request and reset position', async () => {
      await dlnaPlayer.stop(createDevice());

      const body: string = (global.fetch as any).mock.calls[0][1].body;
      expect(body).toContain('Stop');
      expect(body).toContain('<InstanceID>0</InstanceID>');

      const state = dlnaPlayer.getPlaybackState();
      expect(state.isPlaying).toBe(false);
      expect(state.position).toBe(0);
    });
  });

  describe('seek', () => {
    it('should send Seek SOAP request with formatted time', async () => {
      await dlnaPlayer.seek(createDevice(), 125);

      const body: string = (global.fetch as any).mock.calls[0][1].body;
      expect(body).toContain('Seek');
      expect(body).toContain('<InstanceID>0</InstanceID>');
      expect(body).toContain('<Unit>REL_TIME</Unit>');
      expect(body).toContain('<Target>00:02:05</Target>');

      expect(dlnaPlayer.getPlaybackState().position).toBe(125);
    });

    it('should format large time values correctly', async () => {
      await dlnaPlayer.seek(createDevice(), 3661);

      const body: string = (global.fetch as any).mock.calls[0][1].body;
      expect(body).toContain('<Target>01:01:01</Target>');
    });
  });

  describe('getPosition', () => {
    it('should parse RelTime from response', async () => {
      (global.fetch as any).mockResolvedValue(
        mockFetchResponse('<?xml version="1.0"?><Result><RelTime>00:05:30</RelTime></Result>')
      );

      const position = await dlnaPlayer.getPosition(createDevice());

      expect(position).toBe(330);
      expect(dlnaPlayer.getPlaybackState().position).toBe(330);
    });

    it('should handle namespace-prefixed RelTime', async () => {
      (global.fetch as any).mockResolvedValue(
        mockFetchResponse('<?xml version="1.0"?><Result><ns:RelTime>01:00:00</ns:RelTime></Result>')
      );

      const position = await dlnaPlayer.getPosition(createDevice());
      expect(position).toBe(3600);
    });

    it('should return current position when no RelTime found', async () => {
      (global.fetch as any).mockResolvedValue(
        mockFetchResponse('<Result></Result>')
      );

      const position = await dlnaPlayer.getPosition(createDevice());
      expect(position).toBe(0);
    });
  });

  describe('setVolume', () => {
    it('should send SetVolume SOAP request', async () => {
      await dlnaPlayer.setVolume(createDevice(), 75);

      const url: string = (global.fetch as any).mock.calls[0][0];
      expect(url).toContain('/upnp/control/renderingcontrol');

      const body: string = (global.fetch as any).mock.calls[0][1].body;
      expect(body).toContain('SetVolume');
      expect(body).toContain('<Channel>Master</Channel>');
      expect(body).toContain('<DesiredVolume>75</DesiredVolume>');

      expect(dlnaPlayer.getPlaybackState().volume).toBe(75);
    });

    it('should clamp volume to 0-100 range', async () => {
      await dlnaPlayer.setVolume(createDevice(), 150);
      const body1: string = (global.fetch as any).mock.calls[0][1].body;
      expect(body1).toContain('<DesiredVolume>100</DesiredVolume>');

      (global.fetch as any).mockClear();

      await dlnaPlayer.setVolume(createDevice(), -10);
      const body2: string = (global.fetch as any).mock.calls[0][1].body;
      expect(body2).toContain('<DesiredVolume>0</DesiredVolume>');
    });

    it('should round volume to integer', async () => {
      await dlnaPlayer.setVolume(createDevice(), 33.7);
      const body: string = (global.fetch as any).mock.calls[0][1].body;
      expect(body).toContain('<DesiredVolume>34</DesiredVolume>');
    });
  });

  describe('startCasting', () => {
    it('should start a casting session successfully', async () => {
      (global.fetch as any).mockResolvedValue(mockFetchResponse('OK'));

      const device = createDevice();
      const source = createVideoSource();

      const session = await dlnaPlayer.startCasting(device, source);

      expect(session.id).toBe('test-uuid-12345');
      expect(session.deviceId).toBe('tv-1');
      expect(session.videoSourceId).toBe('video-1');
      expect(session.status).toBe('playing');

      // Should persist session (connecting then playing)
      expect(mockSetCurrentSession).toHaveBeenCalledTimes(2);
      // Use sessionStatusAtCall to check status values at time of each call
      expect(sessionStatusAtCall[0]).toBe('connecting');
      expect(sessionStatusAtCall[1]).toBe('playing');

      // Should send SetAVTransportURI and Play
      expect(global.fetch).toHaveBeenCalledTimes(2);
      const firstBody: string = (global.fetch as any).mock.calls[0][1].body;
      expect(firstBody).toContain('SetAVTransportURI');
      const secondBody: string = (global.fetch as any).mock.calls[1][1].body;
      expect(secondBody).toContain('Play');
    });

    it('should handle errors during casting setup', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Device unreachable'));

      await expect(
        dlnaPlayer.startCasting(createDevice(), createVideoSource())
      ).rejects.toThrow('Device unreachable');

      expect(mockSetCurrentSession).toHaveBeenCalledTimes(2);
      expect(sessionStatusAtCall[0]).toBe('connecting');
      expect(sessionStatusAtCall[1]).toBe('error');
      expect(mockSetCurrentSession.mock.calls[1][0].error).toBe('Device unreachable');
    });

    it('should handle non-Error exceptions', async () => {
      (global.fetch as any).mockRejectedValue('String error');

      await expect(
        dlnaPlayer.startCasting(createDevice(), createVideoSource())
      ).rejects.toBe('String error');

      expect(sessionStatusAtCall[1]).toBe('error');
      expect(mockSetCurrentSession.mock.calls[1][0].error).toBe('Unknown error');
    });
  });

  describe('stopCasting', () => {
    it('should stop a casting session successfully', async () => {
      mockGetCurrentSession.mockResolvedValue({
        id: 'session-1',
        deviceId: 'tv-1',
        status: 'playing',
        startedAt: Date.now(),
      });
      mockGetDiscoveredDevices.mockResolvedValue([createDevice()]);
      (global.fetch as any).mockResolvedValue(mockFetchResponse('OK'));

      await dlnaPlayer.stopCasting('session-1');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const body: string = (global.fetch as any).mock.calls[0][1].body;
      expect(body).toContain('Stop');

      expect(mockSetCurrentSession).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'stopped' })
      );

      expect(dlnaPlayer.getPlaybackState().isPlaying).toBe(false);
      expect(dlnaPlayer.getPlaybackState().position).toBe(0);
    });

    it('should do nothing if session not found', async () => {
      mockGetCurrentSession.mockResolvedValue(null);

      await dlnaPlayer.stopCasting('non-existent-session');

      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockSetCurrentSession).not.toHaveBeenCalled();
    });

    it('should handle session ID mismatch', async () => {
      mockGetCurrentSession.mockResolvedValue({
        id: 'session-2',
        deviceId: 'tv-1',
        status: 'playing',
      });

      await dlnaPlayer.stopCasting('session-1');

      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockSetCurrentSession).not.toHaveBeenCalled();
    });

    it('should continue when device not found in discovered list', async () => {
      mockGetCurrentSession.mockResolvedValue({
        id: 'session-1',
        deviceId: 'tv-1',
        status: 'playing',
      });
      mockGetDiscoveredDevices.mockResolvedValue([]);

      await dlnaPlayer.stopCasting('session-1');

      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockSetCurrentSession).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'stopped' })
      );
    });

    it('should propagate stop errors', async () => {
      mockGetCurrentSession.mockResolvedValue({
        id: 'session-1',
        deviceId: 'tv-1',
        status: 'playing',
      });
      mockGetDiscoveredDevices.mockResolvedValue([createDevice()]);
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      await expect(dlnaPlayer.stopCasting('session-1')).rejects.toThrow('Network error');
    });
  });
});
