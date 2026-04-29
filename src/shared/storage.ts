// Storage wrapper using native chrome.storage.* API
// Does NOT use @plasmohq/storage (which uses chrome.runtime.connect() internally
// and causes "Extension context invalidated" errors on HMR reload).
// Direct chrome.storage.local / chrome.storage.session calls are used instead.

import type {
  VideoSource,
  CastingDevice,
  CastingSession,
  DeviceHistory
} from '@shared/types';
import { STORAGE_KEYS } from '@shared/types';

// ---------------------------------------------------------------------------
// Local Storage Helpers (chrome.storage.local — persistent data)
// ---------------------------------------------------------------------------
async function localGet<T>(key: string): Promise<T | undefined> {
  const result = await chrome.storage.local.get(key);
  return result[key] as T | undefined;
}

async function localSet(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

// ---------------------------------------------------------------------------
// Session Storage Helpers (chrome.storage.session — temporary data)
// ---------------------------------------------------------------------------
async function sessionGet<T>(key: string): Promise<T | undefined> {
  const result = await chrome.storage.session.get(key);
  return result[key] as T | undefined;
}

async function sessionSet(key: string, value: unknown): Promise<void> {
  await chrome.storage.session.set({ [key]: value });
}

async function sessionRemove(key: string): Promise<void> {
  await chrome.storage.session.remove(key);
}

async function sessionClear(): Promise<void> {
  await chrome.storage.session.clear();
}

// ---------------------------------------------------------------------------
// Device History (local storage — persistent)
// ---------------------------------------------------------------------------
export async function setDeviceHistory(history: DeviceHistory[]): Promise<void> {
  await localSet(STORAGE_KEYS.DEVICE_HISTORY, history);
}

export async function getDeviceHistory(): Promise<DeviceHistory[]> {
  const history = await localGet<DeviceHistory[]>(STORAGE_KEYS.DEVICE_HISTORY);
  return history || [];
}

export async function addToDeviceHistory(device: CastingDevice): Promise<void> {
  const history = await getDeviceHistory();
  const existingIndex = history.findIndex(h => h.deviceId === device.id);

  if (existingIndex >= 0) {
    history[existingIndex].lastUsed = Date.now();
    history[existingIndex].useCount += 1;
  } else {
    history.unshift({
      deviceId: device.id,
      lastUsed: Date.now(),
      useCount: 1
    });
  }

  // Keep only last 10
  if (history.length > 10) {
    history.pop();
  }

  await setDeviceHistory(history);
}

export async function getRecentDeviceIds(): Promise<string[]> {
  const history = await getDeviceHistory();
  return history
    .sort((a, b) => b.lastUsed - a.lastUsed)
    .slice(0, 10)
    .map(h => h.deviceId);
}

export async function setRecentDevices(deviceIds: string[]): Promise<void> {
  await localSet(STORAGE_KEYS.RECENT_DEVICES, deviceIds);
}

export async function getRecentDevices(): Promise<string[]> {
  const devices = await localGet<string[]>(STORAGE_KEYS.RECENT_DEVICES);
  return devices || [];
}

// ---------------------------------------------------------------------------
// Session Storage Helpers (session storage — temporary)
// ---------------------------------------------------------------------------
export async function setCurrentSession(session: CastingSession | null): Promise<void> {
  if (session) {
    await sessionSet(STORAGE_KEYS.CURRENT_SESSION, session);
  } else {
    await sessionRemove(STORAGE_KEYS.CURRENT_SESSION);
  }
}

export async function getCurrentSession(): Promise<CastingSession | null> {
  const session = await sessionGet<CastingSession>(STORAGE_KEYS.CURRENT_SESSION);
  return session ?? null;
}

export async function setDetectedVideos(videos: VideoSource[]): Promise<void> {
  await sessionSet(STORAGE_KEYS.DETECTED_VIDEOS, videos);
}

export async function getDetectedVideos(): Promise<VideoSource[]> {
  const videos = await sessionGet<VideoSource[]>(STORAGE_KEYS.DETECTED_VIDEOS);
  return videos || [];
}

export async function setDiscoveredDevices(devices: CastingDevice[]): Promise<void> {
  await sessionSet(STORAGE_KEYS.DISCOVERED_DEVICES, devices);
}

export async function getDiscoveredDevices(): Promise<CastingDevice[]> {
  const devices = await sessionGet<CastingDevice[]>(STORAGE_KEYS.DISCOVERED_DEVICES);
  return devices || [];
}

// Clear session storage (for when extension is closed)
export async function clearSessionStorage(): Promise<void> {
  await sessionClear();
}

// ---------------------------------------------------------------------------
// Settings (local storage — persistent)
// ---------------------------------------------------------------------------
export interface Settings {
  autoPlay: boolean;
  deviceTimeout: number;
  showNotifications: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  autoPlay: true,
  deviceTimeout: 300000,
  showNotifications: true
};

export async function getSettings(): Promise<Settings> {
  const settings = await localGet<Settings>(STORAGE_KEYS.SETTINGS);
  // Return a shallow copy to prevent mutation of the default settings object
  return settings ? { ...settings } : { ...DEFAULT_SETTINGS };
}

export async function setSettings(settings: Settings): Promise<void> {
  await localSet(STORAGE_KEYS.SETTINGS, settings);
}
