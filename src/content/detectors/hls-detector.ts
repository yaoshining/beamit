// HLS/m3u8 Stream Detector
// Detects HLS streams by finding .m3u8 URLs in scripts and network requests

import { VideoSource } from '@shared/types';
import { generateUUID, extractDomain } from '@shared/utils';
import { VIDEO_PATTERNS } from '@shared/constants';

/**
 * Detect HLS streams by scanning scripts and video elements
 */
export function detectHLSStreams(): VideoSource[] {
  const videos: VideoSource[] = [];
  const currentPageUrl = window.location.href;
  const currentPageTitle = document.title || '';

  // 1. Scan script tags for .m3u8 URLs
  const scriptVideos = scanScriptTags(currentPageUrl, currentPageTitle);
  videos.push(...scriptVideos);

  // 2. Scan video elements that might have HLS src
  const videoElementVideos = scanVideoElements(currentPageUrl, currentPageTitle);
  videos.push(...videoElementVideos);

  // 3. Scan for Blob URLs that might be HLS
  const blobVideos = scanBlobUrls(currentPageUrl, currentPageTitle);
  videos.push(...blobVideos);

  return videos;
}

/**
 * Scan all script tags for .m3u8 URLs
 */
function scanScriptTags(pageUrl: string, pageTitle: string): VideoSource[] {
  const videos: VideoSource[] = [];
  const scripts = document.querySelectorAll('script');

  scripts.forEach((script) => {
    // Check src attribute
    if (script.src && VIDEO_PATTERNS.HLS_MANIFEST.test(script.src)) {
      videos.push(createHLSSource(script.src, pageUrl, pageTitle));
      return;
    }

    // Check inline content for m3u8 URLs
    if (script.textContent) {
      const matches = script.textContent.match(/\S+\.m3u8[^\s"']*/g);
      if (matches) {
        matches.forEach((url) => {
          // Clean URL (remove quotes, etc.)
          const cleanUrl = url.replace(/["']/g, '');
          if (isValidHlsUrl(cleanUrl)) {
            videos.push(createHLSSource(cleanUrl, pageUrl, pageTitle));
          }
        });
      }
    }
  });

  return videos;
}

/**
 * Scan video elements for HLS sources
 */
function scanVideoElements(pageUrl: string, pageTitle: string): VideoSource[] {
  const videos: VideoSource[] = [];
  const videoElements = document.querySelectorAll('video');

  videoElements.forEach((video) => {
    // Check src
    if (video.src && VIDEO_PATTERNS.HLS_MANIFEST.test(video.src)) {
      videos.push(createHLSSource(video.src, pageUrl, pageTitle));
    }

    // Check source children
    const sources = video.querySelectorAll('source');
    sources.forEach((source) => {
      if (source.src && VIDEO_PATTERNS.HLS_MANIFEST.test(source.src)) {
        videos.push(createHLSSource(source.src, pageUrl, pageTitle));
      }
    });

    // Check for HLS in canPlayType
    if (video.canPlayType && video.canPlayType('application/x-mpegURL')) {
      // This element supports HLS even if src is different
    }
  });

  return videos;
}

/**
 * Scan for Blob URLs that might be HLS
 */
function scanBlobUrls(pageUrl: string, pageTitle: string): VideoSource[] {
  const videos: VideoSource[] = [];
  const videoElements = document.querySelectorAll('video');

  videoElements.forEach((video) => {
    if (video.src && video.src.startsWith('blob:')) {
      // This might be a HLS stream loaded via blob
      // For now, we'll not detect blob URLs as they're harder to track
    }
  });

  return videos;
}

/**
 * Create HLS VideoSource
 */
function createHLSSource(url: string, pageUrl: string, pageTitle: string): VideoSource {
  return {
    id: generateUUID(),
    url,
    type: 'hls',
    pageUrl,
    pageTitle,
    mimeType: 'application/x-mpegURL',
    detectedAt: Date.now()
  };
}

/**
 * Validate HLS URL
 */
function isValidHlsUrl(url: string): boolean {
  if (!url) return false;
  
  // Check pattern
  if (!VIDEO_PATTERNS.HLS_MANIFEST.test(url)) return false;
  
  // Check for valid scheme
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Main detection function
 */
export function detect(): VideoSource[] {
  try {
    return detectHLSStreams();
  } catch (error) {
    console.error('[HlsDetector] Error detecting HLS streams:', error);
    return [];
  }
}

export default { detect };