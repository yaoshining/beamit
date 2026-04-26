// Media Element Detector
// Detects <video> and <audio> elements on the page

import { VideoSource } from '@shared/types';
import { generateUUID, isVideoUrl } from '@shared/utils';
import { VIDEO_PATTERNS } from '@shared/constants';

/**
 * Detect video/audio elements on the page
 */
export function detectMediaElements(): VideoSource[] {
  const videos: VideoSource[] = [];
  const currentPageUrl = window.location.href;
  const currentPageTitle = document.title || '';

  // Find all video elements
  const videoElements = document.querySelectorAll('video');
  videoElements.forEach((video) => {
    const source = extractVideoSource(video, currentPageUrl, currentPageTitle);
    if (source) {
      videos.push(source);
    }
  });

  // Find all audio elements
  const audioElements = document.querySelectorAll('audio');
  audioElements.forEach((audio) => {
    const source = extractAudioSource(audio, currentPageUrl, currentPageTitle);
    if (source) {
      videos.push(source);
    }
  });

  return videos;
}

/**
 * Extract video source from <video> element
 */
function extractVideoSource(
  video: HTMLVideoElement,
  pageUrl: string,
  pageTitle: string
): VideoSource | null {
  // Try src attribute first
  const src = video.src || video.currentSrc || '';

  if (!src || src === window.location.href) {
    // Check for source children
    const sourceElement = video.querySelector('source');
    if (sourceElement && sourceElement.src) {
      return createVideoSource(sourceElement.src, 'media', pageUrl, pageTitle, video);
    }
    return null;
  }

  if (!isVideoUrl(src)) {
    return null;
  }

  return createVideoSource(src, 'media', pageUrl, pageTitle, video);
}

/**
 * Extract audio source from <audio> element
 */
function extractAudioSource(
  audio: HTMLAudioElement,
  pageUrl: string,
  pageTitle: string
): VideoSource | null {
  const src = audio.src || audio.currentSrc || '';

  if (!src) {
    return null;
  }

  return createVideoSource(src, 'media', pageUrl, pageTitle, audio);
}

/**
 * Create VideoSource object with metadata
 */
function createVideoSource(
  url: string,
  type: 'media',
  pageUrl: string,
  pageTitle: string,
  element: HTMLVideoElement | HTMLAudioElement
): VideoSource {
  const duration = !isNaN(element.duration) ? element.duration : undefined;
  const mimeType = getMimeType(element);

  return {
    id: generateUUID(),
    url,
    type,
    pageUrl,
    pageTitle,
    duration,
    mimeType,
    detectedAt: Date.now()
  };
}

/**
 * Get MIME type from element
 */
function getMimeType(element: HTMLVideoElement | HTMLAudioElement): string | undefined {
  // Try from source element
  const source = element.querySelector('source');
  if (source && source.type) {
    return source.type;
  }

  // Try from element
  if (element.duration && !!element.canPlayType) {
    // Heuristic based on extension
    if (element.src.includes('.mp4')) return 'video/mp4';
    if (element.src.includes('.webm')) return 'video/webm';
    if (element.src.includes('.m3u8')) return 'application/x-mpegURL';
  }

  return undefined;
}

/**
 * Check if video is actually playable (not just has src)
 */
export function isPlayable(video: HTMLVideoElement): boolean {
  return video.readyState > 0 && !video.paused && video.duration > 0;
}

/**
 * Main detection function
 */
export function detect(): VideoSource[] {
  try {
    return detectMediaElements();
  } catch (error) {
    console.error('[MediaDetector] Error detecting media:', error);
    return [];
  }
}

// Export for use in content script
export default { detect, detectMediaElements };