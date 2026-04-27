// Device Manager
// Manages device state and history

import { CastingDevice } from '@shared/types';
import { getDiscoveryService } from './dlna-discover';
import { addToDeviceHistory, getRecentDeviceIds, setRecentDevices } from '@shared/storage';

export interface DeviceManagerState {
  devices: CastingDevice[];
  selectedDevice: CastingDevice | null;
  isDiscovering: boolean;
  lastDiscovery: number;
  error: string | null;
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
export async function startDiscovery(): Promise<CastingDevice[]> {
  if (state.isDiscovering) {
    console.log('[DeviceManager] Discovery already in progress');
    return state.devices;
  }

  state.isDiscovering = true;
  state.error = null;

  try {
    const service = getDiscoveryService();
    const devices = await service.startDiscovery({
      timeout: 5000,
      onDeviceFound: (device) => {
        console.log('[DeviceManager] Device found:', device.name);
        // Add to recent devices
        addToRecentDevice(device);
      },
      onDiscoveryEnd: (devices) => {
        state.devices = devices;
        state.lastDiscovery = Date.now();
        state.isDiscovering = false;
        console.log('[DeviceManager] Discovery complete. Found', devices.length, 'devices');
      },
      onError: (error) => {
        state.error = error.message;
        state.isDiscovering = false;
        console.error('[DeviceManager] Discovery error:', error);
      }
    });

    state.devices = devices;
    state.lastDiscovery = Date.now();
    return devices;
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Discovery failed';
    state.isDiscovering = false;
    console.error('[DeviceManager] Discovery failed:', error);
    return [];
  }
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
export function selectDevice(device: CastingDevice): void {
  state.selectedDevice = device;
  addToRecentDevice(device);
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
export function isDeviceOnline(device: CastingDevice): boolean {
  const now = Date.now();
  const timeout = 30000; // 30 seconds
  return now - device.lastSeen < timeout;
}

/**
 * Filter online devices only
 */
export function getOnlineDevices(): CastingDevice[] {
  return state.devices.filter(isDeviceOnline);
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
    if (device && isDeviceOnline(device)) {
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
