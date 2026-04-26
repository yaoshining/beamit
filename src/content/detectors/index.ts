// Video Detectors Index
// Aggregates all video detection methods

import { VideoSource } from '@shared/types';
import { detectMediaElements } from './media-detector';
import { detectHLSStreams } from './hls-detector';
import { detectDASHStreams } from './dash-detector';
import { detectIframeVideos } from './iframe-detector';

export { detectMediaElements } from './media-detector';
export { detectHLSStreams } from './hls-detector';
export { detectDASHStreams } from './dash-detector';
export { detectIframeVideos } from './iframe-detector';

export interface DetectorResult {
  sources: VideoSource[];
  detector: string;
  duration: number;
}

export interface DetectionReport {
  totalSources: number;
  detectors: DetectorResult[];
  timestamp: number;
  pageUrl: string;
  pageTitle: string;
}

/**
 * Detect all video sources on the page using multiple detection methods
 */
export function detectAllVideos(): VideoSource[] {
  const sources: VideoSource[] = [];

  try {
    // Detect native media elements
    sources.push(...detectMediaElements());
  } catch (error) {
    console.error('[Detectors] Error detecting media videos:', error);
  }

  try {
    // Detect HLS streams
    sources.push(...detectHLSStreams());
  } catch (error) {
    console.error('[Detectors] Error detecting HLS videos:', error);
  }

  try {
    // Detect DASH streams
    sources.push(...detectDASHStreams());
  } catch (error) {
    console.error('[Detectors] Error detecting DASH videos:', error);
  }

  try {
    // Detect iframe-embedded videos
    sources.push(...detectIframeVideos());
  } catch (error) {
    console.error('[Detectors] Error detecting iframe videos:', error);
  }

  return deduplicateSources(sources);
}

/**
 * Detect videos with detailed report
 */
export function detectWithReport(): DetectionReport {
  const detectors: DetectorResult[] = [];
  const pageUrl = window.location.href;
  const pageTitle = document.title || '';

  const detectorsToRun = [
    { name: 'media', fn: detectMediaElements },
    { name: 'hls', fn: detectHLSStreams },
    { name: 'dash', fn: detectDASHStreams },
    { name: 'iframe', fn: detectIframeVideos }
  ];

  for (const detector of detectorsToRun) {
    const startTime = performance.now();
    try {
      const sources = detector.fn();
      const duration = performance.now() - startTime;
      detectors.push({
        sources,
        detector: detector.name,
        duration
      });
    } catch (error) {
      console.error(`[Detectors] Error in ${detector.name} detector:`, error);
      detectors.push({
        sources: [],
        detector: detector.name,
        duration: performance.now() - startTime
      });
    }
  }

  const allSources = detectors.flatMap((d) => d.sources);
  const uniqueSources = deduplicateSources(allSources);

  return {
    totalSources: uniqueSources.length,
    detectors,
    timestamp: Date.now(),
    pageUrl,
    pageTitle
  };
}

/**
 * Remove duplicate video sources based on URL
 */
function deduplicateSources(sources: VideoSource[]): VideoSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (seen.has(source.url)) {
      return false;
    }
    seen.add(source.url);
    return true;
  });
}

/**
 * Main detection function for content script
 */
export function detect(): VideoSource[] {
  return detectAllVideos();
}

export default { detect, detectAllVideos, detectWithReport };
