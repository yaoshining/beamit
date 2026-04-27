// Background Service Worker
// Handles extension lifecycle, message routing, and session management

import { startDiscovery, stopDiscovery, clearState } from './background-utils/devices/device-manager';
import { restoreSession } from './background-utils/casting/playback-controller';

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

    default:
      console.warn('[Background] Unknown message type:', message.type);
      sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
      break;
  }
});

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
