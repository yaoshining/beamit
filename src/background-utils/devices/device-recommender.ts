/**
 * Device Recommender Module
 * Provides device ranking, recommendation, and sorting logic
 * based on usage frequency, recency, and availability.
 * 
 * @file src/background-utils/devices/device-recommender.ts
 */

import type { CastingDevice } from '@shared/types';
import { getDeviceHistory } from '@shared/storage';
import type { DeviceHistory } from '@shared/types';
import { isDeviceOnline } from './device-manager';

export interface DeviceRecommendation {
  device: CastingDevice;
  score: number;
  reasons: string[];
}

export type SortStrategy = 'frequency' | 'recency' | 'availability' | 'hybrid';

/** Weight configuration for hybrid scoring */
export const SCORE_WEIGHTS = {
  USE_FREQUENCY: 0.3,   // How often the device is used
  RECENCY: 0.3,         // How recently the device was used
  AVAILABILITY: 0.4,    // Whether device is currently online/available
} as const;

/** Score bonus for a currently online device */
const ONLINE_BONUS = 10;

/** Score bonus for a recently seen device (within 5 minutes) */
const RECENTLY_SEEN_BONUS = 5;

/** Recency half-life in milliseconds (7 days) */
const RECENCY_HALF_LIFE = 7 * 24 * 60 * 60 * 1000;

/**
 * Calculate a recency score based on how recently the device was used.
 * Uses exponential decay: score = base * 0.5 ^ (timeSince / halfLife)
 */
function calculateRecencyScore(lastUsed: number): number {
  const timeSince = Date.now() - lastUsed;
  if (timeSince <= 0) return 1;
  const halvings = timeSince / RECENCY_HALF_LIFE;
  return Math.max(0, Math.pow(0.5, halvings));
}

/**
 * Calculate a frequency score based on usage count.
 * Uses logarithmic scaling to prevent a single device from dominating.
 */
function calculateFrequencyScore(useCount: number): number {
  if (useCount <= 0) return 0;
  return Math.min(1, Math.log10(useCount + 1) / Math.log10(11));
}

/**
 * Calculate an availability score based on device online status and last seen time.
 */
function calculateAvailabilityScore(isOnline: boolean, lastSeen: number): number {
  let score = 0;
  if (isOnline) score += 1;
  const timeSinceLastSeen = Date.now() - lastSeen;
  if (timeSinceLastSeen < 5 * 60 * 1000) score += 0.5; // Seen within 5 minutes
  else if (timeSinceLastSeen < 30 * 60 * 1000) score += 0.25; // Seen within 30 minutes
  return Math.min(1, score);
}

/**
 * Build a lookup map from device history for efficient scoring.
 */
async function buildHistoryMap(): Promise<Map<string, DeviceHistory>> {
  const history = await getDeviceHistory();
  const map = new Map<string, DeviceHistory>();
  for (const entry of history) {
    map.set(entry.deviceId, entry);
  }
  return map;
}

/**
 * Score a single device using the hybrid algorithm.
 */
async function scoreDevice(
  device: CastingDevice,
  historyMap: Map<string, DeviceHistory>
): Promise<DeviceRecommendation> {
  const reasons: string[] = [];
  const historyEntry = historyMap.get(device.id);

  // Frequency score
  const useCount = historyEntry?.useCount ?? 0;
  const frequencyScore = calculateFrequencyScore(useCount);
  if (useCount > 0) reasons.push(`已使用 ${useCount} 次`);

  // Recency score
  const lastUsed = historyEntry?.lastUsed ?? device.lastSeen;
  const recencyScore = calculateRecencyScore(lastUsed);
  if (recencyScore > 0.5) reasons.push('最近使用过');

  // Availability score
  const isOnline = await isDeviceOnline(device);
  const availabilityScore = calculateAvailabilityScore(isOnline, device.lastSeen);
  if (isOnline) reasons.push('设备在线');
  else reasons.push('设备离线');

  // Hybrid score
  const score =
    SCORE_WEIGHTS.USE_FREQUENCY * frequencyScore +
    SCORE_WEIGHTS.RECENCY * recencyScore +
    SCORE_WEIGHTS.AVAILABILITY * availabilityScore +
    (isOnline ? ONLINE_BONUS : 0) +
    (Date.now() - device.lastSeen < 5 * 60 * 1000 ? RECENTLY_SEEN_BONUS : 0);

  return { device, score, reasons };
}

/**
 * Get recommended devices sorted by hybrid score (highest first).
 * Recommended devices are those that are online and have been used before.
 */
export async function getRecommendedDevices(
  devices: CastingDevice[]
): Promise<DeviceRecommendation[]> {
  if (devices.length === 0) return [];

  const historyMap = await buildHistoryMap();
  const scored = await Promise.all(
    devices.map((device) => scoreDevice(device, historyMap))
  );

  return scored.sort((a, b) => b.score - a.score);
}

/**
 * Get the single best device recommendation.
 */
export async function getBestDevice(
  devices: CastingDevice[]
): Promise<DeviceRecommendation | null> {
  const recommendations = await getRecommendedDevices(devices);
  return recommendations[0] ?? null;
}

/**
 * Sort devices by a specific strategy.
 */
export async function sortDevices(
  devices: CastingDevice[],
  strategy: SortStrategy = 'hybrid'
): Promise<CastingDevice[]> {
  const historyMap = await buildHistoryMap();

  const sorted = [...devices].sort((a, b) => {
    switch (strategy) {
      case 'frequency': {
        const aCount = historyMap.get(a.id)?.useCount ?? 0;
        const bCount = historyMap.get(b.id)?.useCount ?? 0;
        return bCount - aCount;
      }
      case 'recency': {
        const aLast = historyMap.get(a.id)?.lastUsed ?? a.lastSeen;
        const bLast = historyMap.get(b.id)?.lastUsed ?? b.lastSeen;
        return bLast - aLast;
      }
      case 'availability': {
        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
        return b.lastSeen - a.lastSeen;
      }
      case 'hybrid':
      default: {
        // Online first, then by recency
        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
        const aLast = historyMap.get(a.id)?.lastUsed ?? a.lastSeen;
        const bLast = historyMap.get(b.id)?.lastUsed ?? b.lastSeen;
        return bLast - aLast;
      }
    }
  });

  return sorted;
}

/**
 * Filter to only recommended (online and recently used) devices.
 */
export async function filterRecommendedDevices(
  devices: CastingDevice[]
): Promise<CastingDevice[]> {
  const recommendations = await getRecommendedDevices(devices);
  return recommendations
    .filter((r) => r.device.isOnline && r.score > 0)
    .map((r) => r.device);
}

/**
 * Get device usage statistics for display.
 */
export async function getDeviceUsageSummary(
  deviceId: string
): Promise<{ useCount: number; lastUsed: string; isFrequent: boolean }> {
  const history = await getDeviceHistory();
  const entry = history.find((h) => h.deviceId === deviceId);

  if (!entry) {
    return { useCount: 0, lastUsed: '从未使用', isFrequent: false };
  }

  const daysSinceLastUse = Math.floor(
    (Date.now() - entry.lastUsed) / (24 * 60 * 60 * 1000)
  );
  const lastUsed =
    daysSinceLastUse === 0
      ? '今天'
      : daysSinceLastUse === 1
        ? '昨天'
        : `${daysSinceLastUse} 天前`;

  return {
    useCount: entry.useCount,
    lastUsed,
    isFrequent: entry.useCount >= 3,
  };
}

export default {
  getRecommendedDevices,
  getBestDevice,
  sortDevices,
  filterRecommendedDevices,
  getDeviceUsageSummary,
};
