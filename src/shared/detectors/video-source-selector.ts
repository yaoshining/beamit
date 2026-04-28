/**
 * Video Source Selector
 * Provides video source selection, deduplication, and ranking logic.
 */

import type { VideoSource, VideoType } from '@shared/types';
import {
  deduplicateSources,
  sortSourcesByPriority,
  filterByType,
  detectStreamUrls,
} from './video-detector';

export interface VideoSourceGroup {
  type: VideoType;
  label: string;
  sources: VideoSource[];
}

const TYPE_LABELS: Record<VideoType, string> = {
  media: 'HTML5 视频',
  hls: 'HLS 流 (m3u8)',
  dash: 'DASH 流 (mpd)',
  iframe: '内嵌播放器',
};

/**
 * Group video sources by type for UI display.
 */
export function groupByType(sources: VideoSource[]): VideoSourceGroup[] {
  const grouped: Record<VideoType, VideoSource[]> = {
    media: [],
    hls: [],
    dash: [],
    iframe: [],
  };

  for (const source of sources) {
    if (grouped[source.type]) {
      grouped[source.type].push(source);
    }
  }

  return (Object.entries(grouped) as [VideoType, VideoSource[]][])
    .filter(([, srcs]) => srcs.length > 0)
    .map(([type, srcs]) => ({
      type,
      label: TYPE_LABELS[type] || type,
      sources: srcs,
    }));
}

/**
 * Get best video source recommendation.
 * Prioritizes: media > hls > dash > iframe
 * Within same type: longest duration first, then most recently detected.
 */
export function getRecommendedSource(sources: VideoSource[]): VideoSource | null {
  const sorted = sortSourcesByPriority(sources);
  return sorted[0] ?? null;
}

/**
 * Select the best video source from a set of candidates.
 */
export function selectBestSource(
  urls: string[],
  preferType?: VideoType
): VideoSource | null {
  const candidates = detectStreamUrls(urls);
  if (candidates.length === 0) return null;

  if (preferType) {
    const filtered = filterByType(candidates, [preferType]);
    if (filtered.length > 0) return getRecommendedSource(filtered);
  }

  return getRecommendedSource(candidates);
}

export interface DetectionSummary {
  total: number;
  byType: Record<VideoType, number>;
  groups: VideoSourceGroup[];
  recommended: VideoSource | null;
}

/**
 * Generate a full detection summary from raw sources.
 */
export function summarize(sources: VideoSource[]): DetectionSummary {
  const deduped = deduplicateSources(sources);
  const sorted = sortSourcesByPriority(deduped);
  const groups = groupByType(sorted);

  const byType: Record<VideoType, number> = {
    media: 0,
    hls: 0,
    dash: 0,
    iframe: 0,
  };
  for (const source of sorted) {
    byType[source.type] = (byType[source.type] || 0) + 1;
  }

  return {
    total: sorted.length,
    byType,
    groups,
    recommended: getRecommendedSource(sorted),
  };
}

export default {
  groupByType,
  getRecommendedSource,
  selectBestSource,
  summarize,
};
