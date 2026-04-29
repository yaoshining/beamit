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
import {
  deduplicateSources,
  detectVideoSources,
  sortSourcesByPriority
} from '@shared/detectors/video-detector';

/**
 * Plasmo content script configuration
 * Overrides default matches to only run on HTTP/HTTPS pages for better performance.
 */
export const config = {
  matches: ['http://*/*', 'https://*/*'],
  run_at: 'document_start',
};

const MAX_CAPTURED_REQUEST_URLS = 300;
const capturedRequestUrls = new Set<string>();
let performanceObserver: PerformanceObserver | null = null;

function rememberRequestUrl(url: string): void {
  if (!url || !isProbablyHttpUrl(url)) return;

  if (capturedRequestUrls.size >= MAX_CAPTURED_REQUEST_URLS) {
    const oldest = capturedRequestUrls.values().next().value;
    if (oldest) capturedRequestUrls.delete(oldest);
  }

  capturedRequestUrls.add(url);
}

function isProbablyHttpUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//');
}

function readPerformanceEntries(): void {
  if (typeof performance === 'undefined' || !performance.getEntriesByType) return;

  for (const entry of performance.getEntriesByType('resource')) {
    rememberRequestUrl(entry.name);
  }
}

function startNetworkRequestCapture(): void {
  readPerformanceEntries();

  if (typeof PerformanceObserver === 'undefined') return;

  try {
    performanceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        rememberRequestUrl(entry.name);
      }
    });
    performanceObserver.observe({ type: 'resource', buffered: true });
  } catch (error) {
    console.warn('[BeamIt] Failed to observe network resources:', error);
  }
}

function getCapturedRequestUrls(): string[] {
  readPerformanceEntries();
  return Array.from(capturedRequestUrls);
}

function getMessageRequestUrls(message: unknown): string[] {
  if (
    typeof message === 'object' &&
    message !== null &&
    Array.isArray((message as { extraUrls?: unknown }).extraUrls)
  ) {
    return (message as { extraUrls: unknown[] }).extraUrls.filter(
      (url): url is string => typeof url === 'string'
    );
  }

  return [];
}

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
          extraUrls: [
            ...getCapturedRequestUrls(),
            ...getMessageRequestUrls(message)
          ],
        },
        createPageElementGetter
      );

      sendResponse({
        success: true,
        videos: sortSourcesByPriority(deduplicateSources(sources))
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : '未知错误';
      sendResponse({ success: false, error: msg });
    }
    return true; // Keep channel open for async response
  }
});

startNetworkRequestCapture();
