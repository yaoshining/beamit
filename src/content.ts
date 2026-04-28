/**
 * Content Script
 * Injected into web pages to detect video sources from the DOM.
 * Communicates with the background service worker via runtime messaging.
 *
 * Plasmo configuration:
 * - Auto-injected into all pages (matches: ["<all_urls>"])
 * - Runs at document_idle (default)
 */

import type { VideoSource } from '@shared/types';
import { detectVideoSources } from '@shared/detectors/video-detector';

/**
 * Plasmo content script configuration
 * Overrides default matches to only run on HTTP/HTTPS pages for better performance.
 */
export const config = {
  matches: ['http://*/*', 'https://*/*'],
};

/**
 * Create an element getter that extracts media elements from the current page DOM.
 */
function createPageElementGetter() {
  const videos = Array.from(document.querySelectorAll('video'));
  const audios = Array.from(document.querySelectorAll('audio'));
  const iframes = Array.from(document.querySelectorAll('iframe'));
  const sourceElements = Array.from(document.querySelectorAll('source'));

  return { videos, audios, iframes, sourceElements };
}

/**
 * Listen for DETECT_VIDEOS messages from the background service worker.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'DETECT_VIDEOS') {
    try {
      const sources: VideoSource[] = detectVideoSources(
        {
          detectMediaElements: true,
          detectHLS: true,
          detectDASH: true,
          detectIframes: true,
          detectSourceElements: true,
          extraUrls: [],
        },
        createPageElementGetter
      );

      sendResponse({ success: true, videos: sources });
    } catch (error) {
      const msg = error instanceof Error ? error.message : '未知错误';
      sendResponse({ success: false, error: msg });
    }
    return true; // Keep channel open for async response
  }
});
