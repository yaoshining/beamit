// Content Script Entry Point
// Handles video detection on web pages

import { detectAllVideos, detectWithReport } from './detectors';
import type { DetectionReport } from './detectors';
import type { VideoSource } from '@shared/types';

// Re-export for external use
export type { DetectionReport };
export { detectAllVideos, detectWithReport };

/**
 * Send message to background script
 */
function sendToBackground(message: { type: string; payload?: unknown }): Promise<unknown> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Handle messages from the background script
 */
chrome.runtime.onMessage.addListener(
  (message: { type: string; payload?: unknown }, _sender, sendResponse) => {
    console.log('[ContentScript] Received message:', message);

    try {
      switch (message.type) {
        case 'DETECT_VIDEOS': {
          const videos = detectAllVideos();
          sendResponse({ success: true, data: videos });
          break;
        }

        case 'GET_DETECTION_REPORT': {
          const report = detectWithReport();
          sendResponse({ success: true, data: report });
          break;
        }

        default:
          sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
      }
    } catch (error) {
      console.error('[ContentScript] Error handling message:', error);
      sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }

    // Return true to indicate async response
    return true;
  }
);

/**
 * Initialize content script
 */
function initialize(): void {
  console.log('[ContentScript] Initializing on:', window.location.href);

  // Set up mutation observer to detect dynamically added videos
  setupMutationObserver();

  // Initial detection
  const videos = detectAllVideos();
  if (videos.length > 0) {
    console.log(`[ContentScript] Detected ${videos.length} video(s)`);

    // Notify background script about detected videos
    sendToBackground({
      type: 'VIDEOS_DETECTED',
      payload: { videos, pageUrl: window.location.href }
    }).catch((error) => {
      console.error('[ContentScript] Failed to notify background:', error);
    });
  }
}

/**
 * Set up MutationObserver to detect dynamically added video elements
 */
function setupMutationObserver(): void {
  const observer = new MutationObserver((mutations) => {
    let shouldRescan = false;

    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (
            node instanceof HTMLVideoElement ||
            node instanceof HTMLAudioElement ||
            node instanceof HTMLIFrameElement ||
            (node instanceof Element && node.querySelector('video, audio, iframe'))
          ) {
            shouldRescan = true;
            break;
          }
        }
      }
      if (shouldRescan) break;
    }

    if (shouldRescan) {
      console.log('[ContentScript] DOM changed, rescanning for videos...');
      const videos = detectAllVideos();
      console.log(`[ContentScript] Found ${videos.length} video(s) after rescan`);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  console.log('[ContentScript] MutationObserver set up');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Export for testing
export { initialize };
