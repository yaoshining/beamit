// Playback Controller
// Manages playback state machine and coordinates between UI and DLNA player

import { CastingSession, CastingDevice, VideoSource } from '@shared/types';
import { getCurrentSession, setCurrentSession } from '@shared/storage';
import * as dlnaPlayer from './dlna-player';

export interface PlaybackControllerState {
  session: CastingSession | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  volume: number;
  error: string | null;
}

type StateChangeCallback = (state: PlaybackControllerState) => void;

const state: PlaybackControllerState = {
  session: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  volume: 100,
  error: null
};

const listeners: StateChangeCallback[] = [];

// Polling interval for position updates
let positionPollInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Subscribe to state changes
 */
export function subscribe(callback: StateChangeCallback): () => void {
  listeners.push(callback);
  return () => {
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
}

/**
 * Notify all listeners of state change
 */
function notifyListeners(): void {
  const currentState = getState();
  listeners.forEach((callback) => callback(currentState));
}

/**
 * Get current state
 */
export function getState(): PlaybackControllerState {
  return { ...state };
}

/**
 * Start a new playback session
 */
export async function startPlayback(
  device: CastingDevice,
  videoSource: VideoSource
): Promise<CastingSession> {
  // Clear any existing session
  await stopPlayback();

  state.error = null;

  try {
    // Start casting on DLNA device
    const session = await dlnaPlayer.startCasting(device, videoSource);

    state.session = session;
    state.isPlaying = true;
    state.position = 0;

    // Persist the session to storage
    await setCurrentSession(session);

    // Start polling for position updates
    startPositionPolling(device);

    notifyListeners();
    console.log('[PlaybackController] Playback started:', session.id);

    return session;
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Failed to start playback';
    state.session = null;
    state.isPlaying = false;
    notifyListeners();
    throw error;
  }
}

/**
 * Stop current playback
 */
export async function stopPlayback(): Promise<void> {
  // Stop polling
  stopPositionPolling();

  const session = state.session;
  if (!session) {
    console.log('[PlaybackController] No active session to stop');
    return;
  }

  try {
    await dlnaPlayer.stopCasting(session.id);
  } catch (error) {
    console.error('[PlaybackController] Error stopping playback:', error);
  }

  // Clear the persisted session
  await setCurrentSession(null);

  state.session = null;
  state.isPlaying = false;
  state.position = 0;
  notifyListeners();

  console.log('[PlaybackController] Playback stopped');
}

/**
 * Pause playback
 */
export async function pausePlayback(device: CastingDevice): Promise<void> {
  if (!state.isPlaying) {
    console.log('[PlaybackController] Not playing');
    return;
  }

  try {
    await dlnaPlayer.pause(device);
    state.isPlaying = false;
    notifyListeners();
    console.log('[PlaybackController] Playback paused');
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Failed to pause';
    notifyListeners();
    throw error;
  }
}

/**
 * Resume playback
 */
export async function resumePlayback(device: CastingDevice): Promise<void> {
  if (state.isPlaying) {
    console.log('[PlaybackController] Already playing');
    return;
  }

  try {
    await dlnaPlayer.play(device);
    state.isPlaying = true;
    notifyListeners();
    console.log('[PlaybackController] Playback resumed');
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Failed to resume';
    notifyListeners();
    throw error;
  }
}

/**
 * Seek to position
 */
export async function seekTo(device: CastingDevice, position: number): Promise<void> {
  try {
    await dlnaPlayer.seek(device, position);
    state.position = position;
    notifyListeners();
    console.log('[PlaybackController] Seeked to:', position);
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Failed to seek';
    notifyListeners();
    throw error;
  }
}

/**
 * Get current position
 */
export async function getCurrentPosition(device: CastingDevice): Promise<number> {
  try {
    state.position = await dlnaPlayer.getPosition(device);
    notifyListeners();
    return state.position;
  } catch (error) {
    console.error('[PlaybackController] Failed to get position:', error);
    return state.position;
  }
}

/**
 * Set volume (0-100)
 */
export async function setVolume(_device: CastingDevice, volume: number): Promise<void> {
  state.volume = Math.max(0, Math.min(100, volume));
  notifyListeners();
  console.log('[PlaybackController] Volume set to:', state.volume);
}

/**
 * Start polling position updates
 */
function startPositionPolling(device: CastingDevice): void {
  if (positionPollInterval) {
    clearInterval(positionPollInterval);
  }

  positionPollInterval = setInterval(async () => {
    if (state.isPlaying) {
      try {
        state.position = await dlnaPlayer.getPosition(device);
        notifyListeners();
      } catch (error) {
        // Ignore position polling errors
      }
    }
  }, 1000);
}

/**
 * Stop polling position updates
 */
function stopPositionPolling(): void {
  if (positionPollInterval) {
    clearInterval(positionPollInterval);
    positionPollInterval = null;
  }
}

/**
 * Restore session from storage
 */
export async function restoreSession(): Promise<CastingSession | null> {
  const session = await getCurrentSession();

  if (session && session.status === 'playing') {
    state.session = session;
    state.isPlaying = true;
    notifyListeners();
    console.log('[PlaybackController] Session restored:', session.id);
  }

  return session;
}

/**
 * Clear error
 */
export function clearError(): void {
  state.error = null;
  notifyListeners();
}

export default {
  subscribe,
  getState,
  startPlayback,
  stopPlayback,
  pausePlayback,
  resumePlayback,
  seekTo,
  getCurrentPosition,
  setVolume,
  restoreSession,
  clearError
};
