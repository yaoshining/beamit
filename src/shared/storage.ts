import { Storage } from '@plasmohq/storage';

import type { 
  VideoSource, 
  CastingDevice, 
  CastingSession, 
  DeviceHistory 
} from '@shared/types';
import { STORAGE_KEYS } from '@shared/types';

// Local Storage (persistent)
export const localStorage = new Storage({
  area: 'local'
});

// Session Storage (temporary)
export const sessionStorage = new Storage({
  area: 'session'
});

// Helper Functions
export async function setDeviceHistory(history: DeviceHistory[]): Promise<void> {
  await localStorage.set(STORAGE_KEYS.DEVICE_HISTORY, history);
}

export async function getDeviceHistory(): Promise<DeviceHistory[]> {
  const history = await localStorage.get<DeviceHistory[]>(STORAGE_KEYS.DEVICE_HISTORY);
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
  await localStorage.set(STORAGE_KEYS.RECENT_DEVICES, deviceIds);
}

export async function getRecentDevices(): Promise<string[]> {
  const devices = await localStorage.get<string[]>(STORAGE_KEYS.RECENT_DEVICES);
  return devices || [];
}

// Session Storage Helpers
export async function setCurrentSession(session: CastingSession | null): Promise<void> {
  if (session) {
    await sessionStorage.set(STORAGE_KEYS.CURRENT_SESSION, session);
  } else {
    await sessionStorage.remove(STORAGE_KEYS.CURRENT_SESSION);
  }
}

export async function getCurrentSession(): Promise<CastingSession | null> {
  const session = await sessionStorage.get<CastingSession>(STORAGE_KEYS.CURRENT_SESSION);
  return session ?? null;
}

export async function setDetectedVideos(videos: VideoSource[]): Promise<void> {
  await sessionStorage.set(STORAGE_KEYS.DETECTED_VIDEOS, videos);
}

export async function getDetectedVideos(): Promise<VideoSource[]> {
  const videos = await sessionStorage.get<VideoSource[]>(STORAGE_KEYS.DETECTED_VIDEOS);
  return videos || [];
}

export async function setDiscoveredDevices(devices: CastingDevice[]): Promise<void> {
  await sessionStorage.set(STORAGE_KEYS.DISCOVERED_DEVICES, devices);
}

export async function getDiscoveredDevices(): Promise<CastingDevice[]> {
  const devices = await sessionStorage.get<CastingDevice[]>(STORAGE_KEYS.DISCOVERED_DEVICES);
  return devices || [];
}

// Clear session storage (for when extension is closed)
export async function clearSessionStorage(): Promise<void> {
  await sessionStorage.clear();
}

// Settings
export interface Settings {
  autoPlay: boolean;
  deviceTimeout: number;
  showNotifications: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  autoPlay: true,
  deviceTimeout: 5000,
  showNotifications: true
};

export async function getSettings(): Promise<Settings> {
  const settings = await localStorage.get<Settings>(STORAGE_KEYS.SETTINGS);
  return settings || DEFAULT_SETTINGS;
}

export async function setSettings(settings: Settings): Promise<void> {
  await localStorage.set(STORAGE_KEYS.SETTINGS, settings);
}