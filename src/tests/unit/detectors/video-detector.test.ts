/**
 * Video Detector Tests
 * Tests for video source detection, deduplication, and sorting logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectStreamUrls,
  detectStreamsFromNetworkRequests,
  detectVideoSources,
  deduplicateSources,
  sortSourcesByPriority,
  filterByType,
  isIframeVideoDomain,
  isVideoFileUrl,
  isValidVideoUrl,
} from '@shared/detectors/video-detector';
import type { VideoSource, VideoType } from '@shared/types';

// Helper: create a mock element getter for detectVideoSources
function createElementGetter(overrides?: Record<string, unknown>) {
  const defaults = {
    videos: [] as HTMLVideoElement[],
    audios: [] as HTMLAudioElement[],
    iframes: [] as HTMLIFrameElement[],
    sourceElements: [] as HTMLSourceElement[],
  };
  return () => ({ ...defaults, ...overrides } as unknown as {
    videos: HTMLVideoElement[];
    audios: HTMLAudioElement[];
    iframes: HTMLIFrameElement[];
    sourceElements?: HTMLSourceElement[];
  });
}

// Helper: create a minimal mock video element
function mockVideo(src: string, duration = 0, childSourceSrc?: string): HTMLVideoElement {
  return {
    src,
    duration,
    querySelector: (_sel: string) => childSourceSrc
      ? ({ getAttribute: (attr: string) => attr === 'src' ? childSourceSrc : null } as unknown as HTMLSourceElement)
      : null,
  } as unknown as HTMLVideoElement;
}

// Helper: create a minimal mock audio element
function mockAudio(src: string, duration = 0): HTMLAudioElement {
  return { src, duration } as unknown as HTMLAudioElement;
}

// Helper: create a minimal mock iframe element
function mockIframe(src: string): HTMLIFrameElement {
  return {
    src,
    getAttribute: (attr: string) => attr === 'src' ? src : null,
  } as unknown as HTMLIFrameElement;
}

// Helper: create a mock source element
function mockSourceElement(src: string, type: string): HTMLSourceElement {
  return {
    getAttribute: (attr: string) => {
      if (attr === 'src') return src;
      if (attr === 'type') return type;
      return null;
    },
  } as unknown as HTMLSourceElement;
}

function createMockSource(url: string, type: VideoType, detectedAt?: number): VideoSource {
  return {
    id: `test-${url}`,
    url,
    type,
    pageUrl: 'https://example.com',
    detectedAt: detectedAt ?? Date.now(),
  };
}

describe('VideoDetector', () => {
  describe('detectStreamUrls', () => {
    it('should detect standard HLS streams from .m3u8 URLs', () => {
      const urls = ['https://example.com/stream.m3u8'];
      const results = detectStreamUrls(urls);
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('hls');
    });

    it('should detect HLS streams with authentication tokens', () => {
      const urls = [
        'https://example.com/hls/12345/stream.m3u8?token=abc123&expires=9999999999',
      ];
      const results = detectStreamUrls(urls);
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('hls');
    });

    it('should detect DASH streams from .mpd URLs', () => {
      const urls = ['https://example.com/manifest.mpd'];
      const results = detectStreamUrls(urls);
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('dash');
    });

    it('should detect DASH streams with query params', () => {
      const urls = ['https://example.com/dash/manifest.mpd?token=xyz'];
      const results = detectStreamUrls(urls);
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('dash');
    });

    it('should detect video files from common extensions', () => {
      const urls = [
        'https://example.com/video.mp4',
        'https://example.com/video.webm',
        'https://example.com/video.flv',
        'https://example.com/video.mov',
        'https://example.com/video.avi',
        'https://example.com/video.mkv',
      ];
      const results = detectStreamUrls(urls);
      expect(results).toHaveLength(6);
      results.forEach((r) => expect(r.type).toBe('media'));
    });

    it('should ignore non-video URLs', () => {
      const urls = [
        'https://example.com/page.html',
        'https://example.com/image.jpg',
        'https://example.com/script.js',
      ];
      const results = detectStreamUrls(urls);
      expect(results).toHaveLength(0);
    });

    it('should handle mixed URL lists', () => {
      const urls = [
        'https://example.com/video.mp4',
        'https://example.com/stream.m3u8',
        'https://example.com/style.css',
        'https://example.com/manifest.mpd',
      ];
      const results = detectStreamUrls(urls);
      expect(results).toHaveLength(3);
      expect(results.map((r) => r.type).sort()).toEqual(['dash', 'hls', 'media']);
    });

    it('should handle empty URL list', () => {
      const results = detectStreamUrls([]);
      expect(results).toHaveLength(0);
    });
  });

  describe('detectStreamsFromNetworkRequests', () => {
    it('should detect streams from standard extensions', () => {
      const urls = ['https://example.com/stream.m3u8', 'https://example.com/video.mp4'];
      const results = detectStreamsFromNetworkRequests(urls);
      expect(results).toHaveLength(2);
    });

    it('should detect HLS/DASH streams from proxy/CDN URL patterns', () => {
      const urls = [
        'https://cdn.example.com/hls/12345/index',
        'https://cdn.example.com/dash/manifest',
        'https://cdn.example.com/live/stream1',
        'https://cdn.example.com/stream/chunklist.m3u8',
      ];
      const results = detectStreamsFromNetworkRequests(urls);
      expect(results.length).toBeGreaterThanOrEqual(3);
    });

    it('should not duplicate already detected URL patterns', () => {
      const urls = ['https://example.com/stream.m3u8', 'https://example.com/hls/stream'];
      const results = detectStreamsFromNetworkRequests(urls);
      expect(results).toHaveLength(2);
    });

    it('should return empty for non-stream URLs', () => {
      const urls = ['https://example.com/style.css', 'https://example.com/api/data.json'];
      const results = detectStreamsFromNetworkRequests(urls);
      expect(results).toHaveLength(0);
    });

    it('should detect /manifest/ proxy pattern', () => {
      const results = detectStreamsFromNetworkRequests([
        'https://cdn.example.com/manifest/stream1',
      ]);
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].type).toBe('hls');
    });

    it('should detect /segment pattern', () => {
      const results = detectStreamsFromNetworkRequests([
        'https://cdn.example.com/segment12345',
      ]);
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect /playlist. pattern', () => {
      const results = detectStreamsFromNetworkRequests([
        'https://cdn.example.com/playlist.m3u8',
      ]);
      // This has .m3u8 extension, caught by first pass
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('hls');
    });

    it('should skip URLs with non-video file extensions', () => {
      // .jpg has extension, not a video type, so first pass skips it,
      // second pass also skips because hasExtension is true
      const results = detectStreamsFromNetworkRequests([
        'https://example.com/image.jpg',
        'https://example.com/style.css',
      ]);
      expect(results).toHaveLength(0);
    });

    it('should handle empty URL list', () => {
      const results = detectStreamsFromNetworkRequests([]);
      expect(results).toHaveLength(0);
    });
  });

  describe('isVideoFileUrl', () => {
    it('should detect video file extensions', () => {
      expect(isVideoFileUrl('https://example.com/video.mp4')).toBe(true);
      expect(isVideoFileUrl('https://example.com/video.webm')).toBe(true);
      expect(isVideoFileUrl('https://example.com/video.flv')).toBe(true);
      expect(isVideoFileUrl('https://example.com/video.mov')).toBe(true);
    });

    it('should not detect non-video URLs', () => {
      expect(isVideoFileUrl('https://example.com/image.jpg')).toBe(false);
      expect(isVideoFileUrl('https://example.com/page.html')).toBe(false);
    });

    it('should handle query parameters', () => {
      expect(isVideoFileUrl('https://example.com/video.mp4?token=abc')).toBe(true);
    });
  });

  describe('isIframeVideoDomain', () => {
    it('should detect YouTube embeds', () => {
      expect(isIframeVideoDomain('https://www.youtube.com/embed/abc123')).toBe(true);
      expect(isIframeVideoDomain('https://youtube.com/watch?v=abc123')).toBe(true);
    });

    it('should detect Vimeo embeds', () => {
      expect(isIframeVideoDomain('https://player.vimeo.com/video/12345')).toBe(true);
    });

    it('should detect Twitch embeds', () => {
      expect(isIframeVideoDomain('https://player.twitch.tv/?channel=test')).toBe(true);
    });

    it('should detect youtu.be short URLs', () => {
      expect(isIframeVideoDomain('https://youtu.be/abc123')).toBe(true);
    });

    it('should detect dailymotion embeds', () => {
      expect(isIframeVideoDomain('https://www.dailymotion.com/video/xyz')).toBe(true);
    });

    it('should handle URL with subdomain containing known domain', () => {
      expect(isIframeVideoDomain('https://player.vimeo.com/video/12345')).toBe(true);
    });

    it('should return false for non-video domains', () => {
      expect(isIframeVideoDomain('https://example.com/page')).toBe(false);
      expect(isIframeVideoDomain('https://github.com')).toBe(false);
    });

    it('should return false for invalid URLs', () => {
      expect(isIframeVideoDomain('not-a-url')).toBe(false);
    });
  });

  describe('isValidVideoUrl', () => {
    it('should return true for valid absolute URLs', () => {
      expect(isValidVideoUrl('https://example.com/video.mp4')).toBe(true);
      expect(isValidVideoUrl('http://cdn.example.com/stream.m3u8')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(isValidVideoUrl('not-a-url')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidVideoUrl('')).toBe(false);
    });

    it('should consider file:// as valid', () => {
      expect(isValidVideoUrl('file:///path/to/video.mp4')).toBe(true);
    });
  });

  describe('detectVideoSources', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should return empty array with empty element getter and no extra URLs', () => {
      const results = detectVideoSources({}, createElementGetter());
      expect(results).toHaveLength(0);
    });

    it('should detect video elements with direct src', () => {
      const results = detectVideoSources(
        {},
        createElementGetter({ videos: [mockVideo('https://example.com/video.mp4', 120)] })
      );
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('media');
      expect(results[0].url).toBe('https://example.com/video.mp4');
      expect(results[0].duration).toBe(120);
    });

    it('should detect video elements with child source element', () => {
      const results = detectVideoSources(
        {},
        createElementGetter({ videos: [mockVideo('', 0, 'https://example.com/child.mp4')] })
      );
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('media');
      expect(results[0].url).toBe('https://example.com/child.mp4');
    });

    it('should skip video elements with empty src', () => {
      const video = { src: '', duration: 0, querySelector: () => null } as unknown as HTMLVideoElement;
      const results = detectVideoSources({}, createElementGetter({ videos: [video] }));
      expect(results).toHaveLength(0);
    });

    it('should detect audio elements', () => {
      const results = detectVideoSources(
        {},
        createElementGetter({ audios: [mockAudio('https://example.com/audio.mp3', 60)] })
      );
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('media');
      expect(results[0].url).toBe('https://example.com/audio.mp3');
    });

    it('should detect HLS from source element MIME type (x-mpegurl)', () => {
      const results = detectVideoSources(
        {},
        createElementGetter({ sourceElements: [mockSourceElement('https://example.com/stream.m3u8', 'application/x-mpegurl')] })
      );
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('hls');
    });

    it('should detect HLS from source element MIME type (mpegurl)', () => {
      const results = detectVideoSources(
        {},
        createElementGetter({ sourceElements: [mockSourceElement('https://example.com/stream.m3u8', 'application/mpegurl')] })
      );
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('hls');
    });

    it('should detect HLS from source element MIME type (hls)', () => {
      const results = detectVideoSources(
        {},
        createElementGetter({ sourceElements: [mockSourceElement('https://example.com/stream.m3u8', 'application/hls')] })
      );
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('hls');
    });

    it('should detect DASH from source element MIME type (dash)', () => {
      const results = detectVideoSources(
        {},
        createElementGetter({ sourceElements: [mockSourceElement('https://example.com/manifest.mpd', 'application/dash+xml')] })
      );
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('dash');
    });

    it('should detect DASH from source element MIME type (mpd)', () => {
      const results = detectVideoSources(
        {},
        createElementGetter({ sourceElements: [mockSourceElement('https://example.com/manifest.mpd', 'video/mpd')] })
      );
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('dash');
    });

    it('should detect media from source element with valid video URL but unknown type', () => {
      const results = detectVideoSources(
        {},
        createElementGetter({ sourceElements: [mockSourceElement('https://example.com/video.mp4', 'video/mp4')] })
      );
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('media');
    });

    it('should skip source element with empty src', () => {
      const results = detectVideoSources(
        {},
        createElementGetter({ sourceElements: [mockSourceElement('', 'video/mp4')] })
      );
      expect(results).toHaveLength(0);
    });

    it('should detect iframe embeds from known video domains', () => {
      const results = detectVideoSources(
        {},
        createElementGetter({ iframes: [mockIframe('https://www.youtube.com/embed/abc123')] })
      );
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('iframe');
      expect(results[0].url).toBe('https://www.youtube.com/embed/abc123');
    });

    it('should skip iframe embeds from unknown domains', () => {
      const results = detectVideoSources(
        {},
        createElementGetter({ iframes: [mockIframe('https://example.com/embed')] })
      );
      expect(results).toHaveLength(0);
    });

    it('should detect HLS from extra URLs', () => {
      const results = detectVideoSources({
        extraUrls: ['https://example.com/stream.m3u8'],
        detectMediaElements: false,
        detectIframes: false,
        detectSourceElements: false,
      });
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('hls');
    });

    it('should detect DASH from extra URLs', () => {
      const results = detectVideoSources({
        extraUrls: ['https://example.com/manifest.mpd'],
        detectMediaElements: false,
        detectIframes: false,
        detectSourceElements: false,
      });
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('dash');
    });

    it('should detect media from extra URLs with video extension', () => {
      const results = detectVideoSources({
        extraUrls: ['https://example.com/video.mp4'],
        detectIframes: false,
        detectSourceElements: false,
        // detectMediaElements left as default true so the guard condition passes
      });
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('media');
    });

    it('should skip non-video extra URLs', () => {
      const results = detectVideoSources({
        extraUrls: ['https://example.com/page.html'],
        detectMediaElements: false,
        detectIframes: false,
        detectSourceElements: false,
      });
      expect(results).toHaveLength(0);
    });

    it('should work without elementGetter (no DOM access)', () => {
      const results = detectVideoSources({ extraUrls: ['https://example.com/stream.m3u8'] });
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('hls');
    });

    it('should disable media element detection when detectMediaElements is false', () => {
      const results = detectVideoSources(
        { detectMediaElements: false, extraUrls: [] },
        createElementGetter({ videos: [mockVideo('https://example.com/video.mp4')] })
      );
      expect(results).toHaveLength(0);
    });

    it('should disable HLS detection when detectHLS is false', () => {
      const results = detectVideoSources({
        detectHLS: false,
        extraUrls: ['https://example.com/stream.m3u8'],
        detectMediaElements: false,
        detectIframes: false,
        detectSourceElements: false,
      });
      expect(results).toHaveLength(0);
    });

    it('should disable DASH detection when detectDASH is false', () => {
      const results = detectVideoSources({
        detectDASH: false,
        extraUrls: ['https://example.com/manifest.mpd'],
        detectMediaElements: false,
        detectIframes: false,
        detectSourceElements: false,
      });
      expect(results).toHaveLength(0);
    });

    it('should disable source element detection when detectSourceElements is false', () => {
      const results = detectVideoSources(
        { detectSourceElements: false },
        createElementGetter({ sourceElements: [mockSourceElement('https://example.com/stream.m3u8', 'application/x-mpegURL')] })
      );
      expect(results).toHaveLength(0);
    });

    it('should merge options with defaults and detect multiple source types', () => {
      const results = detectVideoSources(
        {},
        createElementGetter({
          videos: [mockVideo('https://example.com/video.mp4')],
          sourceElements: [mockSourceElement('https://example.com/stream.m3u8', 'application/x-mpegURL')],
          iframes: [mockIframe('https://www.youtube.com/embed/test')],
        })
      );
      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('deduplicateSources', () => {
    it('should remove duplicate URLs', () => {
      const sources = [
        createMockSource('https://example.com/video.mp4', 'media'),
        createMockSource('https://example.com/video.mp4', 'media'),
        createMockSource('https://example.com/other.mp4', 'media'),
      ];
      const result = deduplicateSources(sources);
      expect(result).toHaveLength(2);
    });

    it('should keep first occurrence of duplicate', () => {
      const sources = [
        createMockSource('https://example.com/video.mp4', 'media', 100),
        createMockSource('https://example.com/video.mp4', 'hls', 200),
      ];
      const result = deduplicateSources(sources);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('media');
    });

    it('should return empty array for empty input', () => {
      expect(deduplicateSources([])).toHaveLength(0);
    });
  });

  describe('sortSourcesByPriority', () => {
    it('should sort by type priority (media first)', () => {
      const sources = [
        createMockSource('https://example.com/stream.m3u8', 'hls'),
        createMockSource('https://example.com/video.mp4', 'media'),
        createMockSource('https://example.com/embed', 'iframe'),
      ];
      const sorted = sortSourcesByPriority(sources);
      expect(sorted[0].type).toBe('media');
      expect(sorted[1].type).toBe('hls');
      expect(sorted[2].type).toBe('iframe');
    });

    it('should include DASH in priority ordering', () => {
      const sources = [
        createMockSource('https://example.com/embed', 'iframe'),
        createMockSource('https://example.com/manifest.mpd', 'dash'),
        createMockSource('https://example.com/video.mp4', 'media'),
      ];
      const sorted = sortSourcesByPriority(sources);
      expect(sorted[0].type).toBe('media');
      expect(sorted[1].type).toBe('dash');
      expect(sorted[2].type).toBe('iframe');
    });

    it('should sort by detection time within same type (newest first)', () => {
      const sources = [
        createMockSource('https://example.com/old.mp4', 'media', 100),
        createMockSource('https://example.com/new.mp4', 'media', 300),
        createMockSource('https://example.com/mid.mp4', 'media', 200),
      ];
      const sorted = sortSourcesByPriority(sources);
      expect(sorted[0].detectedAt).toBe(300);
      expect(sorted[1].detectedAt).toBe(200);
      expect(sorted[2].detectedAt).toBe(100);
    });

    it('should not mutate original array', () => {
      const sources = [
        createMockSource('https://example.com/b.mp4', 'media', 200),
        createMockSource('https://example.com/a.mp4', 'media', 100),
      ];
      const originalOrder = sources.map((s) => s.url);
      sortSourcesByPriority(sources);
      expect(sources.map((s) => s.url)).toEqual(originalOrder);
    });
  });

  describe('filterByType', () => {
    it('should filter by single type', () => {
      const sources = [
        createMockSource('https://example.com/v.mp4', 'media'),
        createMockSource('https://example.com/s.m3u8', 'hls'),
        createMockSource('https://example.com/e', 'iframe'),
      ];
      const result = filterByType(sources, ['hls']);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('hls');
    });

    it('should filter by multiple types', () => {
      const sources = [
        createMockSource('https://example.com/v.mp4', 'media'),
        createMockSource('https://example.com/s.m3u8', 'hls'),
        createMockSource('https://example.com/e', 'iframe'),
      ];
      const result = filterByType(sources, ['media', 'hls']);
      expect(result).toHaveLength(2);
    });

    it('should return empty array for no matches', () => {
      const sources = [createMockSource('https://example.com/v.mp4', 'media')];
      const result = filterByType(sources, ['dash']);
      expect(result).toHaveLength(0);
    });

    it('should filter dash type', () => {
      const sources = [
        createMockSource('https://example.com/v.mp4', 'media'),
        createMockSource('https://example.com/m.mpd', 'dash'),
      ];
      const result = filterByType(sources, ['dash']);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('dash');
    });
  });
});
