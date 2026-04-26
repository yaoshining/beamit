// Background Service Worker Entry Point
// Handles communication between content scripts and popup

import { CastingDevice, CastingSession, VideoSource } from '@shared/types';
import { getDiscoveryService, discoverDLNADevices } from './devices/dlna-discover';
import { getDiscoveredDevices, setDiscoveredDevices, setCurrentSession, getCurrentSession } from '@shared/storage';

// Message types
type BackgroundMessage =
  | { type: 'DISCOVER_DEVICES' }
  | { type: 'GET_DEVICES' }
  | { type: 'START_CASTING'; payload: { videoSource: VideoSource; device: CastingDevice } }
  | { type: 'STOP_CASTING'; payload: { sessionId: string } }
  | { type: 'GET_SESSION' }
  | { type: 'VIDEOS_DETECTED'; payload: { videos: VideoSource[]; pageUrl: string } };

type MessageResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener(
  (message: BackgroundMessage, _sender, sendResponse) => {
    console.log('[Background] Received message:', message);

    handleMessage(message)
      .then((response) => {
        sendResponse(response);
      })
      .catch((error) => {
        console.error('[Background] Error handling message:', error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        } as MessageResponse<never>);
      });

    // Return true to indicate async response
    return true;
  }
);

/**
 * Process messages
 */
async function handleMessage(
  message: BackgroundMessage
): Promise<MessageResponse<unknown>> {
  switch (message.type) {
    case 'DISCOVER_DEVICES': {
      const devices = await discoverDLNADevices();
      await setDiscoveredDevices(devices);
      return { success: true, data: devices };
    }

    case 'GET_DEVICES': {
      const devices = await getDiscoveredDevices();
      return { success: true, data: devices };
    }

    case 'START_CASTING': {
      const { videoSource, device } = message.payload;
      const session = await startCasting(videoSource, device);
      return { success: true, data: session };
    }

    case 'STOP_CASTING': {
      const { sessionId } = message.payload;
      await stopCasting(sessionId);
      return { success: true, data: { sessionId } };
    }

    case 'GET_SESSION': {
      const session = await getCurrentSession();
      return { success: true, data: session };
    }

    case 'VIDEOS_DETECTED': {
      console.log('[Background] Videos detected:', message.payload);
      // Store detected videos for popup to access
      return { success: true, data: { count: message.payload.videos.length } };
    }

    default:
      return { success: false, error: `Unknown message type` };
  }
}

/**
 * Start casting session
 */
async function startCasting(
  videoSource: VideoSource,
  device: CastingDevice
): Promise<CastingSession> {
  const session: CastingSession = {
    id: crypto.randomUUID(),
    deviceId: device.id,
    videoSourceId: videoSource.id,
    status: 'connecting',
    startedAt: Date.now()
  };

  await setCurrentSession(session);

  // TODO: Implement actual DLNA casting logic
  // This would involve:
  // 1. Parsing the video URL
  // 2. Setting up the AVTransport SOAP action
  // 3. Sending the video URL to the device
  // 4. Starting playback

  console.log('[Background] Starting casting session:', session);

  // Simulate successful connection after a short delay
  setTimeout(() => {
    updateSessionStatus(session.id, 'playing');
  }, 1000);

  return session;
}

/**
 * Stop casting session
 */
async function stopCasting(sessionId: string): Promise<void> {
  const session = await getCurrentSession();
  if (session && session.id === sessionId) {
    session.status = 'stopped';
    session.endedAt = Date.now();
    await setCurrentSession(session);
    console.log('[Background] Stopped casting session:', sessionId);
  }
}

/**
 * Update session status
 */
async function updateSessionStatus(
  sessionId: string,
  status: CastingSession['status']
): Promise<void> {
  const session = await getCurrentSession();
  if (session && session.id === sessionId) {
    session.status = status;
    await setCurrentSession(session);
    console.log('[Background] Updated session status:', sessionId, status);
  }
}

/**
 * Send message to content script
 */
export async function sendToContentScript(
  tabId: number,
  message: unknown
): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    console.error('[Background] Failed to send message to tab:', tabId, error);
    throw error;
  }
}

/**
 * Send message to background (for content scripts)
 */
export function sendToBackground(message: unknown): Promise<unknown> {
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

// Initialize background service
console.log('[Background] Service worker initialized');

// Export for testing
export { handleMessage, startCasting, stopCasting };
