// Background Service Worker
// Handles extension lifecycle, message routing, and session management

import { startDiscovery, stopDiscovery, clearState } from './background-utils/devices/device-manager';
import { restoreSession } from './background-utils/casting/playback-controller';

/**
 * Track the currently active tab ID.
 * Uses chrome.tabs.onActivated which does NOT require the "tabs" permission.
 * This is used to forward messages (e.g., DETECT_VIDEOS) to the content script
 * in the active tab without needing chrome.tabs.query (which requires permissions).
 */
let activeTabId: number | null = null;

chrome.tabs.onActivated.addListener((activeInfo) => {
  activeTabId = activeInfo.tabId;
});

/**
 * Initialize the extension on install / update
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Background] Extension installed:', details.reason);

  // Restore any active casting session from storage
  const session = await restoreSession();
  if (session) {
    console.log('[Background] Restored active session:', session.id);
  }
});

/**
 * Handle messages from popup and content scripts
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'START_DISCOVERY':
      startDiscovery()
        .then((devices) => sendResponse({ success: true, devices }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true; // Keep channel open for async response

    case 'STOP_DISCOVERY':
      stopDiscovery();
      sendResponse({ success: true });
      break;

    case 'CLEAR_STATE':
      clearState();
      sendResponse({ success: true });
      break;

    case 'DETECT_VIDEOS':
      forwardToContentScript(sendResponse);
      return true; // Keep channel open for async response

    default:
      console.warn('[Background] Unknown message type:', message.type);
      sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
      break;
  }
});

/**
 * Forward a DETECT_VIDEOS message to the content script in the active tab.
 * Uses the tracked activeTabId from onActivated event.
 * Falls back to chrome.tabs.query if no tab ID is tracked yet.
 */
function forwardToContentScript(
  sendResponse: (response: any) => void
): void {
  const tabId = activeTabId;

  if (tabId === null) {
    // Fallback: try chrome.tabs.query if onActivated hasn't fired yet
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        sendResponse({ success: false, error: '无法获取当前标签页' });
        return;
      }
      activeTabId = tab.id;
      sendToContentScript(tab.id, sendResponse);
    });
    return;
  }

  sendToContentScript(tabId, sendResponse);
}

/**
 * Send DETECT_VIDEOS to the content script in the given tab.
 */
function sendToContentScript(
  tabId: number,
  sendResponse: (response: any) => void
): void {
  chrome.tabs.sendMessage(tabId, { type: 'DETECT_VIDEOS' }, (response) => {
    if (chrome.runtime.lastError) {
      sendResponse({
        success: false,
        error: `内容脚本未加载: ${chrome.runtime.lastError.message}`
      });
    } else {
      sendResponse(response);
    }
  });
}

/**
 * Bootstrap on every service worker start
 * MV3 service workers can be terminated when idle and restarted on events.
 * onInstalled only fires on install/update, so we must also restore
 * sessions here to survive worker cycling.
 */
(async () => {
  console.log('[Background] Service worker started');
  try {
    const session = await restoreSession();
    if (session) {
      console.log('[Background] Restored session on startup:', session.id);
    }
  } catch (error) {
    console.warn('[Background] Failed to restore session on startup:', error);
  }
})();
