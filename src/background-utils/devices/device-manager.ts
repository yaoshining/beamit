// Device Manager
// Manages device state and history

import { CastingDevice } from '@shared/types';
import { HTTP_DISCOVERY_TIMEOUT } from '@shared/constants';
import { getDiscoveryService } from './dlna-discover';
import {
  addToDeviceHistory,
  getDiscoveredDevices,
  getRecentDeviceIds,
  setRecentDevices,
  getSettings,
  setDiscoveredDevices
} from '@shared/storage';

export interface DeviceManagerState {
  devices: CastingDevice[];
  selectedDevice: CastingDevice | null;
  isDiscovering: boolean;
  lastDiscovery: number;
  error: string | null;
}

export interface StartDiscoveryOptions {
  onDevicesUpdated?: (devices: CastingDevice[]) => void | Promise<void>;
}

const state: DeviceManagerState = {
  devices: [],
  selectedDevice: null,
  isDiscovering: false,
  lastDiscovery: 0,
  error: null
};

/**
 * Get current device state
 */
export function getDeviceState(): DeviceManagerState {
  return { ...state };
}

/**
 * Start device discovery
 */
export async function startDiscovery(
  options: StartDiscoveryOptions = {}
): Promise<CastingDevice[]> {
  if (state.isDiscovering) {
    console.log('[DeviceManager] Discovery already in progress');
    return state.devices;
  }

  state.isDiscovering = true;
  state.error = null;

  try {
    const cachedDevices = await getDiscoveredDevices().catch(() => []);
    const previousDevices = mergeDevices(state.devices, cachedDevices);
    if (previousDevices.length > 0) {
      state.devices = previousDevices;
    }

    const service = getDiscoveryService();
    await service.startDiscovery({
      timeout: HTTP_DISCOVERY_TIMEOUT,
      fastResolveOnFirstDevice: true,
      onDeviceFound: (device) => {
        state.devices = mergeDevices([device], state.devices);
        setDiscoveredDevices(state.devices).catch((err) =>
          console.warn('[DeviceManager] Failed to cache discovered device:', err)
        );
        addToRecentDevice(device);
        void options.onDevicesUpdated?.(state.devices);
      },
      onDiscoveryEnd: (devices) => {
        const mergedDevices = devices.length > 0
          ? mergeDevices(devices, previousDevices)
          : previousDevices;

        state.devices = mergedDevices;
        state.lastDiscovery = Date.now();
        state.isDiscovering = false;
        console.log('[DeviceManager] Discovery complete. Found', devices.length, 'devices');

        // T046: Save discovered devices to session storage for quick access.
        // Do not overwrite a usable cache with an empty timeout result; repeated
        // refreshes can otherwise make a device disappear even though it was just seen.
        if (mergedDevices.length > 0) {
          setDiscoveredDevices(mergedDevices).catch((err) =>
            console.warn('[DeviceManager] Failed to cache discovered devices:', err)
          );
        }

        // Add each discovered device to recent devices
        mergedDevices.forEach((device) => {
          addToRecentDevice(device);
        });
        void options.onDevicesUpdated?.(mergedDevices);
      },
      onError: (error) => {
        state.error = error.message;
        state.isDiscovering = false;
        console.error('[DeviceManager] Discovery error:', error);
      }
    });

    return state.devices;
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Discovery failed';
    state.isDiscovering = false;
    console.error('[DeviceManager] Discovery failed:', error);
    return [];
  }
}

function mergeDevices(
  primary: CastingDevice[],
  fallback: CastingDevice[]
): CastingDevice[] {
  const merged = new Map<string, CastingDevice>();

  for (const device of fallback) {
    merged.set(device.id, device);
  }

  for (const device of primary) {
    const existing = merged.get(device.id);
    merged.set(device.id, {
      ...existing,
      ...device,
      lastSeen: Math.max(existing?.lastSeen ?? 0, device.lastSeen)
    });
  }

  return Array.from(merged.values());
}

/**
 * Stop device discovery
 */
export function stopDiscovery(): void {
  const service = getDiscoveryService();
  service.stopDiscovery();
  state.isDiscovering = false;
  console.log('[DeviceManager] Discovery stopped');
}

/**
 * Select a device for casting
 */
export async function selectDevice(device: CastingDevice): Promise<void> {
  state.selectedDevice = device;
  await addToRecentDevice(device);
  console.log('[DeviceManager] Device selected:', device.name);
}

/**
 * Get device by ID
 */
export function getDeviceById(deviceId: string): CastingDevice | undefined {
  return state.devices.find((d) => d.id === deviceId);
}

/**
 * Check if device is online
 */
export async function isDeviceOnline(device: CastingDevice): Promise<boolean> {
  const now = Date.now();
  let timeout = 30000; // default 30 seconds
  try {
    const settings = await getSettings();
    timeout = settings.deviceTimeout ?? 30000;
  } catch {
    // Fallback to default if settings cannot be retrieved
  }
  return now - device.lastSeen < timeout;
}

/**
 * Filter online devices only
 */
export async function getOnlineDevices(): Promise<CastingDevice[]> {
  const onlineDevices: CastingDevice[] = [];
  for (const device of state.devices) {
    if (await isDeviceOnline(device)) {
      onlineDevices.push(device);
    }
  }
  return onlineDevices;
}

/**
 * Add device to recent list
 */
async function addToRecentDevice(device: CastingDevice): Promise<void> {
  await addToDeviceHistory(device);
  const recentIds = await getRecentDeviceIds();
  if (!recentIds.includes(device.id)) {
    recentIds.unshift(device.id);
    if (recentIds.length > 10) {
      recentIds.pop();
    }
    await setRecentDevices(recentIds);
  }
}

/**
 * Get recently used devices
 */
export async function getRecentlyUsedDevices(): Promise<CastingDevice[]> {
  const recentIds = await getRecentDeviceIds();
  const recentDevices: CastingDevice[] = [];

  for (const id of recentIds) {
    const device = state.devices.find((d) => d.id === id);
    if (device && (await isDeviceOnline(device))) {
      recentDevices.push(device);
    }
  }

  return recentDevices;
}

/**
 * Refresh device list
 */
export async function refreshDevices(): Promise<CastingDevice[]> {
  stopDiscovery();
  return startDiscovery();
}

/**
 * Clear device state
 */
export function clearState(): void {
  state.devices = [];
  state.selectedDevice = null;
  state.isDiscovering = false;
  state.error = null;
}

export default {
  getDeviceState,
  startDiscovery,
  stopDiscovery,
  selectDevice,
  getDeviceById,
  isDeviceOnline,
  getOnlineDevices,
  getRecentlyUsedDevices,
  refreshDevices,
  clearState
};
