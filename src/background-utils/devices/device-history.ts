/**
 * Device History Module
 * Provides higher-level device history operations including
 * storage, retrieval, cleanup, and analytics.
 * 
 * @file src/background-utils/devices/device-history.ts
 */

import type { CastingDevice, DeviceHistory } from '@shared/types';
import {
  getDeviceHistory,
  setDeviceHistory,
  addToDeviceHistory as addToStorageHistory,
  getRecentDevices,
  setRecentDevices,
} from '@shared/storage';

/** Maximum number of recent device entries to keep */
export const MAX_HISTORY_SIZE = 10;

/** Maximum age for a stale history entry in milliseconds (30 days) */
export const MAX_HISTORY_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface DeviceHistoryStats {
  totalEntries: number;
  uniqueDevices: number;
  mostUsedDevice: DeviceHistory | null;
  recentlyUsedDevice: DeviceHistory | null;
  staleEntries: number;
}

/**
 * Get all device history entries, sorted by last used (newest first).
 */
export async function getAllHistory(): Promise<DeviceHistory[]> {
  const history = await getDeviceHistory();
  return history.sort((a, b) => b.lastUsed - a.lastUsed);
}

/**
 * Record a device usage in history.
 * Updates the existing entry or creates a new one.
 */
export async function recordDeviceUsage(device: CastingDevice): Promise<void> {
  await addToStorageHistory(device);
}

/**
 * Get the most recently used device.
 */
export async function getLastUsedDevice(): Promise<DeviceHistory | null> {
  const history = await getAllHistory();
  return history[0] ?? null;
}

/**
 * Get the most frequently used device.
 */
export async function getMostUsedDevice(): Promise<DeviceHistory | null> {
  const history = await getAllHistory();
  if (history.length === 0) return null;
  return history.reduce((max, curr) => (curr.useCount > max.useCount ? curr : max), history[0]);
}

/**
 * Get recently used device IDs from history.
 */
export async function getRecentDeviceIdList(): Promise<string[]> {
  const history = await getAllHistory();
  return history.slice(0, MAX_HISTORY_SIZE).map((h) => h.deviceId);
}

/**
 * Get device usage count by device ID.
 */
export async function getDeviceUsageCount(deviceId: string): Promise<number> {
  const history = await getDeviceHistory();
  const entry = history.find((h) => h.deviceId === deviceId);
  return entry?.useCount ?? 0;
}

/**
 * Remove a specific device from history.
 */
export async function removeDeviceFromHistory(deviceId: string): Promise<void> {
  let history = await getDeviceHistory();
  history = history.filter((h) => h.deviceId !== deviceId);
  await setDeviceHistory(history);

  // Also remove from recent devices list
  const recentIds = await getRecentDevices();
  const filtered = recentIds.filter((id) => id !== deviceId);
  await setRecentDevices(filtered);
}

/**
 * Clear all device history.
 */
export async function clearAllHistory(): Promise<void> {
  await setDeviceHistory([]);
  await setRecentDevices([]);
}

/**
 * Remove stale history entries older than MAX_HISTORY_AGE_MS.
 * Returns the number of removed entries.
 */
export async function cleanStaleEntries(): Promise<number> {
  const history = await getDeviceHistory();
  const cutoff = Date.now() - MAX_HISTORY_AGE_MS;
  const before = history.length;
  const filtered = history.filter((h) => h.lastUsed > cutoff);

  if (filtered.length !== before) {
    await setDeviceHistory(filtered);
  }

  return before - filtered.length;
}

/**
 * Get device history statistics.
 */
export async function getHistoryStats(): Promise<DeviceHistoryStats> {
  const history = await getDeviceHistory();
  const uniqueDevices = new Set(history.map((h) => h.deviceId)).size;
  const cutoff = Date.now() - MAX_HISTORY_AGE_MS;
  const staleEntries = history.filter((h) => h.lastUsed <= cutoff).length;

  return {
    totalEntries: history.length,
    uniqueDevices,
    mostUsedDevice: await getMostUsedDevice(),
    recentlyUsedDevice: history[0] ?? null,
    staleEntries,
  };
}

/**
 * Check if a device is in history.
 */
export async function isDeviceInHistory(deviceId: string): Promise<boolean> {
  const history = await getDeviceHistory();
  return history.some((h) => h.deviceId === deviceId);
}

export default {
  getAllHistory,
  recordDeviceUsage,
  getLastUsedDevice,
  getMostUsedDevice,
  getRecentDeviceIdList,
  getDeviceUsageCount,
  removeDeviceFromHistory,
  clearAllHistory,
  cleanStaleEntries,
  getHistoryStats,
  isDeviceInHistory,
};
