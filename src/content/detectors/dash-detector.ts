// DASH/mpd Stream Detector
// Detects DASH streams by finding .mpd URLs

import { VideoSource } from '@shared/types';
import { generateUUID } from '@shared/utils';
import { VIDEO_PATTERNS } from '@shared/constants';

/**
 * Detect DASH streams by scanning for .mpd URLs
 */
export function detectDASHStreams(): VideoSource[] {
  const videos: VideoSource[] = [];
  const currentPageUrl = window.location.href;
  const currentPageTitle = document.title || '';

  // 1. Scan script tags for .mpd URLs
  const scriptVideos = scanScriptsForMpd(currentPageUrl, currentPageTitle);
  videos.push(...scriptVideos);

  // 2. Scan video elements for DASH
  const videoElementVideos = scanVideoElementsForDash(currentPageUrl, currentPageTitle);
  videos.push(...videoElementVideos);

  return videos;
}

/**
 * Scan script tags for .mpd URLs
 */
function scanScriptsForMpd(pageUrl: string, pageTitle: string): VideoSource[] {
  const videos: VideoSource[] = [];
  const scripts = document.querySelectorAll('script');

  scripts.forEach((script) => {
    if (script.src && VIDEO_PATTERNS.DASH_MANIFEST.test(script.src)) {
      videos.push(createDASHSource(script.src, pageUrl, pageTitle));
      return;
    }

    if (script.textContent) {
      // Look for .mpd URLs in script content
      const matches = script.textContent.match(/\S+\.mpd[^\s"']*/g);
      if (matches) {
        matches.forEach((url) => {
          const cleanUrl = url.replace(/["']/g, '');
          if (isValidDashUrl(cleanUrl)) {
            videos.push(createDASHSource(cleanUrl, pageUrl, pageTitle));
          }
        });
      }
    }
  });

  return videos;
}

/**
 * Scan video elements for DASH sources
 */
function scanVideoElementsForDash(pageUrl: string, pageTitle: string): VideoSource[] {
  const videos: VideoSource[] = [];
  const videoElements = document.querySelectorAll('video');

  videoElements.forEach((video) => {
    // Check src attribute
    if (video.src && VIDEO_PATTERNS.DASH_MANIFEST.test(video.src)) {
      videos.push(createDASHSource(video.src, pageUrl, pageTitle));
    }

    // Check source elements
    const sources = video.querySelectorAll('source');
    sources.forEach((source) => {
      if (source.src && VIDEO_PATTERNS.DASH_MANIFEST.test(source.src)) {
        videos.push(createDASHSource(source.src, pageUrl, pageTitle));
      }
    });
  });

  return videos;
}

/**
 * Create DASH VideoSource
 */
function createDASHSource(url: string, pageUrl: string, pageTitle: string): VideoSource {
  return {
    id: generateUUID(),
    url,
    type: 'dash',
    pageUrl,
    pageTitle,
    mimeType: 'application/dash+xml',
    detectedAt: Date.now()
  };
}

/**
 * Validate DASH URL
 */
function isValidDashUrl(url: string): boolean {
  if (!url) return false;
  
  if (!VIDEO_PATTERNS.DASH_MANIFEST.test(url)) return false;
  
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
    return detectDASHStreams();
  } catch (error) {
    console.error('[DashDetector] Error detecting DASH streams:', error);
    return [];
  }
}

export default { detect };