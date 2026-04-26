// Iframe Detector
// Detects embedded video players in iframes

import { VideoSource } from '@shared/types';
import { generateUUID } from '@shared/utils';
import { VIDEO_PATTERNS } from '@shared/constants';

interface IframeMatch {
  url: string;
  platform: string;
}

/**
 * Detect iframe-embedded video players (YouTube, Vimeo, etc.)
 */
export function detectIframeVideos(): VideoSource[] {
  const videos: VideoSource[] = [];
  const currentPageUrl = window.location.href;
  const currentPageTitle = document.title || '';

  // Get all iframes
  const iframes = document.querySelectorAll('iframe');

  iframes.forEach((iframe) => {
    const match = detectIframeVideo(iframe);
    if (match) {
      videos.push(createIframeSource(match.url, match.platform, currentPageUrl, currentPageTitle));
    }
  });

  return videos;
}

/**
 * Detect if an iframe contains a video player
 */
function detectIframeVideo(iframe: HTMLIFrameElement): IframeMatch | null {
  const src = iframe.src || '';

  if (!src) return null;

  // YouTube
  if (src.includes('youtube.com') || src.includes('youtu.be')) {
    const videoId = extractYouTubeVideoId(src);
    if (videoId) {
      return {
        url: `https://www.youtube.com/watch?v=${videoId}`,
        platform: 'YouTube'
      };
    }
  }

  // YouTube Embed (already embed URL)
  if (src.includes('youtube.com/embed/')) {
    return {
      url: src.replace('/embed/', '/watch?v='),
      platform: 'YouTube'
    };
  }

  // Vimeo
  if (src.includes('vimeo.com')) {
    const videoId = extractVimeoVideoId(src);
    if (videoId) {
      return {
        url: `https://vimeo.com/${videoId}`,
        platform: 'Vimeo'
      };
    }
  }

  // Dailymotion
  if (src.includes('dailymotion.com')) {
    const videoId = extractDailymotionVideoId(src);
    if (videoId) {
      return {
        url: `https://www.dailymotion.com/video/${videoId}`,
        platform: 'Dailymotion'
      };
    }
  }

  // Twitch
  if (src.includes('twitch.tv')) {
    return {
      url: src,
      platform: 'Twitch'
    };
  }

  // Generic iframe with video-like dimensions
  if (isLikelyVideoIframe(iframe)) {
    return {
      url: src,
      platform: 'Unknown'
    };
  }

  return null;
}

/**
 * Extract YouTube video ID from URL
 */
function extractYouTubeVideoId(url: string): string | null {
  // youtu.be short URL
  if (url.includes('youtu.be')) {
    const match = url.match(/\/([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }

  // youtube.com/watch?v=...
  if (url.includes('watch?v=')) {
    const match = url.match(/v=([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }

  // youtube.com/embed/...
  if (url.includes('/embed/')) {
    const match = url.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }

  return null;
}

/**
 * Extract Vimeo video ID from URL
 */
function extractVimeoVideoId(url: string): string | null {
  // vimeo.com/{id}
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Extract Dailymotion video ID from URL
 */
function extractDailymotionVideoId(url: string): string | null {
  // dailymotion.com/video/{id}
  const match = url.match(/video\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

/**
 * Check if iframe is likely to be a video player based on dimensions
 */
function isLikelyVideoIframe(iframe: HTMLIFrameElement): boolean {
  const width = Number(iframe.width) || iframe.clientWidth || 0;
  const height = Number(iframe.height) || iframe.clientHeight || 0;

  // Common video aspect ratio (16:9)
  const aspectRatio = width / height;
  const is16x9 = Math.abs(aspectRatio - 16 / 9) < 0.2;

  // Check if dimensions suggest a video player
  return (width >= 320 && height >= 180) || (is16x9 && width >= 160);
}

/**
 * Create iframe VideoSource
 */
function createIframeSource(
  url: string,
  platform: string,
  pageUrl: string,
  pageTitle: string
): VideoSource {
  return {
    id: generateUUID(),
    url,
    type: 'iframe',
    pageUrl,
    pageTitle,
    detectedAt: Date.now()
  };
}

/**
 * Main detection function
 */
export function detect(): VideoSource[] {
  try {
    return detectIframeVideos();
  } catch (error) {
    console.error('[IframeDetector] Error detecting iframes:', error);
    return [];
  }
}

export default { detect };