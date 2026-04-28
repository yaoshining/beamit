/**
 * Video Source Selector Tests
 * Tests for source grouping, recommendation, and summary logic.
 */

import { describe, it, expect } from 'vitest';
import {
  groupByType,
  getRecommendedSource,
  selectBestSource,
  summarize,
} from '@shared/detectors/video-source-selector';
import type { VideoSource, VideoType } from '@shared/types';

function createSource(url: string, type: VideoType, detectedAt?: number): VideoSource {
  return {
    id: url,
    url,
    type,
    pageUrl: 'https://example.com',
    detectedAt: detectedAt ?? Date.now(),
  };
}

describe('VideoSourceSelector', () => {
  describe('groupByType', () => {
    it('should group sources by type', () => {
      const sources = [
        createSource('https://example.com/v.mp4', 'media'),
        createSource('https://example.com/s.m3u8', 'hls'),
        createSource('https://example.com/v2.mp4', 'media'),
      ];
      const groups = groupByType(sources);
      expect(groups).toHaveLength(2);

      const mediaGroup = groups.find((g) => g.type === 'media');
      const hlsGroup = groups.find((g) => g.type === 'hls');
      expect(mediaGroup?.sources).toHaveLength(2);
      expect(hlsGroup?.sources).toHaveLength(1);
    });

    it('should return empty array for no sources', () => {
      expect(groupByType([])).toHaveLength(0);
    });

    it('should include labels in groups', () => {
      const sources = [createSource('https://example.com/v.mp4', 'media')];
      const groups = groupByType(sources);
      expect(groups[0].label).toBe('HTML5 视频');
    });

    it('should handle single source per type', () => {
      const sources = [
        createSource('https://example.com/v.mp4', 'media'),
        createSource('https://example.com/s.m3u8', 'hls'),
        createSource('https://example.com/m.mpd', 'dash'),
        createSource('https://example.com/e', 'iframe'),
      ];
      const groups = groupByType(sources);
      expect(groups).toHaveLength(4);
    });
  });

  describe('getRecommendedSource', () => {
    it('should return the highest priority source', () => {
      const sources = [
        createSource('https://example.com/s.m3u8', 'hls'),
        createSource('https://example.com/v.mp4', 'media'),
      ];
      const recommended = getRecommendedSource(sources);
      expect(recommended?.type).toBe('media');
    });

    it('should return null for empty array', () => {
      expect(getRecommendedSource([])).toBeNull();
    });

    it('should return the only source when single', () => {
      const sources = [createSource('https://example.com/v.mp4', 'media')];
      const recommended = getRecommendedSource(sources);
      expect(recommended?.url).toBe('https://example.com/v.mp4');
    });
  });

  describe('selectBestSource', () => {
    it('should select best source from URLs', () => {
      const urls = [
        'https://example.com/style.css',
        'https://example.com/video.mp4',
        'https://example.com/stream.m3u8',
      ];
      const selected = selectBestSource(urls);
      expect(selected).not.toBeNull();
      expect(selected?.type).toBe('media');
      expect(selected?.url).toBe('https://example.com/video.mp4');
    });

    it('should return null for non-video URLs', () => {
      const urls = ['https://example.com/page.html', 'https://example.com/style.css'];
      expect(selectBestSource(urls)).toBeNull();
    });

    it('should prefer specified type when available', () => {
      const urls = [
        'https://example.com/video.mp4',
        'https://example.com/stream.m3u8',
      ];
      const selected = selectBestSource(urls, 'hls');
      expect(selected?.type).toBe('hls');
    });

    it('should return null for empty URL list', () => {
      expect(selectBestSource([])).toBeNull();
    });
  });

  describe('summarize', () => {
    it('should produce correct summary counts', () => {
      const sources = [
        createSource('https://example.com/v1.mp4', 'media'),
        createSource('https://example.com/v2.mp4', 'media'),
        createSource('https://example.com/s.m3u8', 'hls'),
      ];
      const summary = summarize(sources);
      expect(summary.total).toBe(3);
      expect(summary.byType.media).toBe(2);
      expect(summary.byType.hls).toBe(1);
      expect(summary.groups).toHaveLength(2);
    });

    it('should deduplicate in summary', () => {
      const sources = [
        createSource('https://example.com/v.mp4', 'media'),
        createSource('https://example.com/v.mp4', 'media'),
      ];
      const summary = summarize(sources);
      expect(summary.total).toBe(1);
    });

    it('should include recommended source', () => {
      const sources = [
        createSource('https://example.com/s.m3u8', 'hls'),
        createSource('https://example.com/v.mp4', 'media'),
      ];
      const summary = summarize(sources);
      expect(summary.recommended).not.toBeNull();
      expect(summary.recommended?.type).toBe('media');
    });
  });
});
