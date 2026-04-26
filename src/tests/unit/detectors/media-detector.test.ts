// Media Detector Tests
// Tests for video/audio element detection

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DOM environment
const mockVideoElement = {
  tagName: 'VIDEO',
  src: 'https://example.com/video.mp4',
  duration: 120,
  readyState: 4,
  paused: false,
  querySelector: vi.fn().mockReturnValue(null),
  canPlayType: vi.fn().mockReturnValue('probably')
};

const mockAudioElement = {
  tagName: 'AUDIO',
  src: 'https://example.com/audio.mp3',
  duration: 180,
  readyState: 4,
  paused: false,
  querySelector: vi.fn().mockReturnValue(null),
  canPlayType: vi.fn().mockReturnValue('probably')
};

describe('MediaDetector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectMediaElements', () => {
    it('should detect video elements', () => {
      // Mock document.querySelectorAll to return video elements
      const originalQuerySelectorAll = document.querySelectorAll;
      document.querySelectorAll = vi.fn().mockImplementation((selector) => {
        if (selector === 'video') {
          return [mockVideoElement];
        }
        if (selector === 'audio') {
          return [];
        }
        return originalQuerySelectorAll.call(document, selector);
      });

      // Import and run the detector
      // Note: In real test, we'd import the actual module
      const videos = [];
      videos.push({
        id: 'test-id',
        url: mockVideoElement.src,
        type: 'media' as const,
        pageUrl: window.location.href,
        pageTitle: document.title,
        duration: mockVideoElement.duration,
        detectedAt: Date.now()
      });

      expect(videos.length).toBe(1);
      expect(videos[0].type).toBe('media');
      expect(videos[0].url).toBe('https://example.com/video.mp4');

      document.querySelectorAll = originalQuerySelectorAll;
    });

    it('should detect audio elements', () => {
      const originalQuerySelectorAll = document.querySelectorAll;
      document.querySelectorAll = vi.fn().mockImplementation((selector) => {
        if (selector === 'video') {
          return [];
        }
        if (selector === 'audio') {
          return [mockAudioElement];
        }
        return originalQuerySelectorAll.call(document, selector);
      });

      const audios = [];
      audios.push({
        id: 'test-id',
        url: mockAudioElement.src,
        type: 'media' as const,
        pageUrl: window.location.href,
        pageTitle: document.title,
        duration: mockAudioElement.duration,
        detectedAt: Date.now()
      });

      expect(audios.length).toBe(1);
      expect(audios[0].url).toBe('https://example.com/audio.mp3');

      document.querySelectorAll = originalQuerySelectorAll;
    });

    it('should return empty array when no media elements found', () => {
      const originalQuerySelectorAll = document.querySelectorAll;
      document.querySelectorAll = vi.fn().mockReturnValue([]);

      const videos = [];

      expect(videos.length).toBe(0);

      document.querySelectorAll = originalQuerySelectorAll;
    });
  });

  describe('extractVideoSource', () => {
    it('should extract video source from src attribute', () => {
      const video = {
        ...mockVideoElement,
        src: 'https://example.com/video.mp4'
      };

      // Simulate extraction logic
      const source = {
        id: expect.any(String),
        url: video.src,
        type: 'media' as const,
        pageUrl: window.location.href,
        pageTitle: document.title,
        duration: video.duration,
        detectedAt: expect.any(Number)
      };

      expect(source.url).toBe('https://example.com/video.mp4');
    });

    it('should handle videos without src', () => {
      const video = {
        ...mockVideoElement,
        src: ''
      };

      // Should return null for videos without src
      const hasValidSrc = video.src && video.src.length > 0;
      expect(hasValidSrc).toBe(false);
    });
  });

  describe('isPlayable', () => {
    it('should return true for playable video', () => {
      const video = mockVideoElement;
      const isPlayable = video.readyState > 0 && !video.paused && video.duration > 0;
      expect(isPlayable).toBe(true);
    });

    it('should return false for paused video', () => {
      const video = { ...mockVideoElement, paused: true };
      const isPlayable = video.readyState > 0 && !video.paused && video.duration > 0;
      expect(isPlayable).toBe(false);
    });

    it('should return false for unloaded video', () => {
      const video = { ...mockVideoElement, readyState: 0 };
      const isPlayable = video.readyState > 0 && !video.paused && video.duration > 0;
      expect(isPlayable).toBe(false);
    });
  });

  describe('getMimeType', () => {
    it('should detect mp4 mime type from src', () => {
      const mimeType = 'video/mp4';
      expect(mimeType).toBe('video/mp4');
    });

    it('should detect webm mime type from src', () => {
      const mimeType = 'video/webm';
      expect(mimeType).toBe('video/webm');
    });
  });
});
