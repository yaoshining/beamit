/**
 * Video Detector
 * Detects and extracts video sources from media elements, HLS/DASH streams,
 * iframe embeds, and raw URLs. Supports multiple stream URL patterns
 * including authentication tokens and proxy URLs.
 */

import type { VideoSource, VideoType } from '@shared/types';
import { generateUUID } from '@shared/utils';
import { VIDEO_PATTERNS } from '@shared/constants';

export interface DetectionOptions {
  /** Whether to include media elements (<video>/<audio>) */
  detectMediaElements?: boolean;
  /** Whether to detect HLS streams (.m3u8) */
  detectHLS?: boolean;
  /** Whether to detect DASH streams (.mpd) */
  detectDASH?: boolean;
  /** Whether to detect iframe embedded players */
  detectIframes?: boolean;
  /** Whether to scan <source> elements with MIME types */
  detectSourceElements?: boolean;
  /** Additional URLs to check */
  extraUrls?: string[];
}

const DEFAULT_OPTIONS: DetectionOptions = {
  detectMediaElements: true,
  detectHLS: true,
  detectDASH: true,
  detectIframes: true,
  detectSourceElements: true,
  extraUrls: [],
};

/**
 * Extended HLS pattern that matches:
 * - Standard .m3u8 files with optional query params
 * - m3u8 with authentication tokens in path (e.g., /hls/12345/index.m3u8?token=abc)
 * - Proxy URLs containing 'm3u8' in path
 */
const EXTENDED_HLS_PATTERN = /\.m3u8(?:\?.*)?$|[/=]m3u8[/?#&]|m3u8\?/i;

/**
 * Extended DASH pattern that matches:
 * - Standard .mpd files with optional query params
 * - Proxy URLs containing 'mpd' in path
 */
const EXTENDED_DASH_PATTERN = /\.mpd(?:\?.*)?$|[/=]mpd[/?#&]/i;

/**
 * Stream proxy / CDN patterns commonly used for delivering video streams
 * without exposing the actual file extension.
 */
const STREAM_PROXY_PATTERNS = [
  /\/hls\//i,
  /\/dash\//i,
  /\/live\//i,
  /\/stream\//i,
  /\/manifest\//i,
  /\/chunklist/i,
  /\/segment\d+/i,
  /\/playlist\./i,
];

/**
 * Detect video sources from the current page context.
 * Works with both DOM elements and URL-based detection.
 */
export function detectVideoSources(
  options: DetectionOptions = DEFAULT_OPTIONS,
  elementGetter?: () => {
    videos: HTMLVideoElement[];
    audios: HTMLAudioElement[];
    iframes: HTMLIFrameElement[];
    sourceElements?: HTMLSourceElement[];
  }
): VideoSource[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const sources: VideoSource[] = [];
  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
  const pageTitle = typeof document !== 'undefined' ? document.title : undefined;

  // Detect from DOM elements
  if (typeof document !== 'undefined' && elementGetter) {
    const elements = elementGetter();

    if (opts.detectMediaElements) {
      for (const video of elements.videos) {
        const src = video.src || video.querySelector('source')?.getAttribute('src') || '';
        if (src && isValidVideoUrl(src)) {
          sources.push(createVideoSource(src, 'media', pageUrl, pageTitle, video.duration));
        }
      }
      for (const audio of elements.audios) {
        const src = audio.src || audio.querySelector('source')?.getAttribute('src') || '';
        if (src) {
          sources.push(createVideoSource(src, 'media', pageUrl, pageTitle, audio.duration));
        }
      }
    }

    // Detect from <source> elements with MIME type hints
    if (opts.detectSourceElements && elements.sourceElements) {
      for (const sourceEl of elements.sourceElements) {
        const src = sourceEl.getAttribute('src') || '';
        const type = sourceEl.getAttribute('type') || '';
        if (!src) continue;

        if (type.includes('x-mpegurl') || type.includes('mpegurl') || type.includes('hls')) {
          sources.push(createVideoSource(src, 'hls', pageUrl, pageTitle));
        } else if (type.includes('dash') || type.includes('mpd')) {
          sources.push(createVideoSource(src, 'dash', pageUrl, pageTitle));
        } else if (isValidVideoUrl(src)) {
          sources.push(createVideoSource(src, 'media', pageUrl, pageTitle));
        }
      }
    }

    if (opts.detectIframes) {
      for (const iframe of elements.iframes) {
        const src = iframe.src || iframe.getAttribute('src') || '';
        if (src && isIframeVideoDomain(src)) {
          sources.push(createVideoSource(src, 'iframe', pageUrl, pageTitle));
        }
      }
    }
  }

  // Detect from URL patterns (works without DOM access)
  if (opts.detectHLS || opts.detectDASH || opts.detectMediaElements) {
    const urlsToCheck = [...(opts.extraUrls || [])];

    for (const url of urlsToCheck) {
      if (opts.detectHLS && EXTENDED_HLS_PATTERN.test(url)) {
        sources.push(createVideoSource(url, 'hls', pageUrl, pageTitle));
      } else if (opts.detectDASH && EXTENDED_DASH_PATTERN.test(url)) {
        sources.push(createVideoSource(url, 'dash', pageUrl, pageTitle));
      } else if (opts.detectMediaElements && isVideoFileUrl(url)) {
        sources.push(createVideoSource(url, 'media', pageUrl, pageTitle));
      }
    }
  }

  return sources;
}

/**
 * Detect HLS/DASH/media streams from a list of URLs.
 * Uses enhanced regex patterns for broader matching.
 */
export function detectStreamUrls(urls: string[]): VideoSource[] {
  const sources: VideoSource[] = [];
  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';

  for (const url of urls) {
    if (EXTENDED_HLS_PATTERN.test(url)) {
      sources.push(createVideoSource(url, 'hls', pageUrl));
    } else if (EXTENDED_DASH_PATTERN.test(url)) {
      sources.push(createVideoSource(url, 'dash', pageUrl));
    } else if (isVideoFileUrl(url)) {
      sources.push(createVideoSource(url, 'media', pageUrl));
    }
  }

  return sources;
}

/**
 * Detect video streams from a collection of network request URLs.
 * Scans for stream proxy/CDN patterns even without file extensions.
 */
export function detectStreamsFromNetworkRequests(urls: string[]): VideoSource[] {
  const sources: VideoSource[] = [];
  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';

  // First pass: detect by file extension (most reliable)
  const standardDetections = detectStreamUrls(urls);
  sources.push(...standardDetections);
  const detectedUrls = new Set(standardDetections.map((s) => s.url));

  // Second pass: detect by proxy/CDN patterns for URLs without extensions
  for (const url of urls) {
    if (detectedUrls.has(url)) continue;

    // Check if URL has a file extension already
    const pathname = extractPath(url);
    const hasExtension = /\.[a-zA-Z0-9]{2,4}(?:\?.*)?$/.test(pathname);
    if (hasExtension) continue; // Already checked by detectStreamUrls

    // Check against proxy/stream patterns
    for (const pattern of STREAM_PROXY_PATTERNS) {
      if (pattern.test(url)) {
        sources.push(createVideoSource(url, 'hls', pageUrl));
        break;
      }
    }
  }

  return sources;
}

/**
 * Extract pathname from a URL string.
 */
function extractPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/**
 * Check if a URL is a video file based on its extension.
 * Supports: mp4, webm, flv, mov, avi, mkv
 */
export function isVideoFileUrl(url: string): boolean {
  return VIDEO_PATTERNS.VIDEO_EXTENSIONS.test(url);
}

/**
 * Check if a URL is an iframe embed from a known video platform.
 */
export function isIframeVideoDomain(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return VIDEO_PATTERNS.IFRAME_VIDEO_DOMAINS.some(
      (domain) => urlObj.hostname.includes(domain) || urlObj.hostname === domain
    );
  } catch {
    return false;
  }
}

/**
 * Check if a URL is a valid video URL.
 */
export function isValidVideoUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Deduplicate video sources by URL.
 * When multiple sources share the same URL, keeps the first occurrence.
 */
export function deduplicateSources(sources: VideoSource[]): VideoSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = source.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Sort video sources by priority:
 * 1. Media elements (video/audio) first
 * 2. HLS streams
 * 3. DASH streams
 * 4. Iframe embeds
 */
export function sortSourcesByPriority(sources: VideoSource[]): VideoSource[] {
  const priority: Record<VideoType, number> = {
    media: 0,
    hls: 1,
    dash: 2,
    iframe: 3,
  };

  return [...sources].sort((a, b) => {
    const pA = priority[a.type] ?? 99;
    const pB = priority[b.type] ?? 99;
    if (pA !== pB) return pA - pB;
    // Within same type, sort by detection time (newest first)
    return b.detectedAt - a.detectedAt;
  });
}

/**
 * Filter video sources by type.
 */
export function filterByType(sources: VideoSource[], types: VideoType[]): VideoSource[] {
  return sources.filter((s) => types.includes(s.type));
}

/**
 * Create a VideoSource object from detection data.
 */
function createVideoSource(
  url: string,
  type: VideoType,
  pageUrl: string,
  pageTitle?: string,
  duration?: number
): VideoSource {
  return {
    id: generateUUID(),
    url,
    type,
    pageUrl,
    pageTitle,
    duration,
    detectedAt: Date.now(),
  };
}

export default {
  detectVideoSources,
  detectStreamUrls,
  detectStreamsFromNetworkRequests,
  isIframeVideoDomain,
  isValidVideoUrl,
  isVideoFileUrl,
  deduplicateSources,
  sortSourcesByPriority,
  filterByType,
};
