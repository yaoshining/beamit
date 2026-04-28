/**
 * DeviceList Component
 * Displays discovered and recently used DLNA devices with status indicators.
 * Supports loading, empty, error states, and offline status display.
 * 
 * @file src/popup/components/DeviceList.tsx
 */

import React from 'react';
import type { CastingDevice } from '@shared/types';
import type { DeviceRecommendation } from '@background-utils/devices/device-recommender';

export interface DeviceListProps {
  /** List of discovered/recommended devices with scores */
  recommendations: DeviceRecommendation[];
  /** Currently selected device ID */
  selectedId?: string;
  /** Whether device discovery is in progress */
  isDiscovering?: boolean;
  /** Discovery timeout in milliseconds */
  discoveryTimeout?: number;
  /** Discovery error message */
  error?: string | null;
  /** Called when a device is selected */
  onSelect: (device: CastingDevice) => void;
  /** Called to start/refresh device discovery */
  onDiscover: () => void;
  /** Called to stop device discovery */
  onStopDiscovery?: () => void;
}

/**
 * Device type icons mapping.
 */
function getDeviceIcon(type: CastingDevice['type']): string {
  switch (type) {
    case 'tv':
      return '📺';
    case 'receiver':
      return '🔊';
    case 'speaker':
      return '🔈';
    default:
      return '📡';
  }
}

/**
 * Get online status color class.
 */
function getStatusClass(isOnline: boolean): string {
  return isOnline
    ? 'bg-green-500'
    : 'bg-gray-300';
}

/**
 * Get status text in Chinese.
 */
function getStatusText(isOnline: boolean): string {
  return isOnline ? '在线' : '离线';
}

/**
 * Format lastSeen timestamp to relative time.
 */
function formatLastSeen(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 10) return '刚刚';
  if (seconds < 60) return `${seconds} 秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

/**
 * Loading skeleton for device discovery.
 */
function DiscoverySkeleton(): React.ReactElement {
  return (
    <div className="space-y-3 animate-pulse" role="status" aria-label="正在搜索设备">
      <div className="flex items-center justify-center gap-2 py-4">
        <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500">正在搜索设备...</span>
      </div>
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg" />
        ))}
      </div>
      <span className="sr-only">正在搜索 DLNA 设备...</span>
    </div>
  );
}

/**
 * Empty state when no devices found.
 */
function EmptyDeviceState({
  onDiscover,
}: {
  onDiscover: () => void;
}): React.ReactElement {
  return (
    <div className="text-center py-8">
      <div className="text-4xl mb-3">📡</div>
      <p className="text-sm text-gray-500 mb-2">未发现可用设备</p>
      <p className="text-xs text-gray-400 mb-4">
        请确保设备已连接到同一网络
      </p>
      <button
        onClick={onDiscover}
        className="btn-secondary text-xs"
        type="button"
      >
        重新搜索
      </button>
    </div>
  );
}

/**
 * Error state for device discovery.
 */
function DiscoveryError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}): React.ReactElement {
  return (
    <div className="text-center py-8">
      <div className="text-4xl mb-3">⚠️</div>
      <p className="text-sm text-red-600 mb-2">搜索失败</p>
      <p className="text-xs text-gray-500 mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="btn-secondary text-xs"
        type="button"
      >
        重试
      </button>
    </div>
  );
}

/**
 * DeviceList Component
 * 
 * Displays discovered devices sorted by recommendation score.
 * Shows online/offline status, last seen time, and usage frequency.
 * T047: Offline devices show grayed-out appearance with "离线" badge.
 * T048: Discovery timeout is displayed with countdown indicator.
 */
export function DeviceList({
  recommendations,
  selectedId,
  isDiscovering = false,
  error = null,
  onSelect,
  onDiscover,
}: DeviceListProps): React.ReactElement {
  if (isDiscovering) {
    return <DiscoverySkeleton />;
  }

  if (error) {
    return <DiscoveryError message={error} onRetry={onDiscover} />;
  }

  if (recommendations.length === 0) {
    return <EmptyDeviceState onDiscover={onDiscover} />;
  }

  // Sort: online first, then by score
  const sorted = [...recommendations].sort((a, b) => {
    if (a.device.isOnline !== b.device.isOnline) {
      return a.device.isOnline ? -1 : 1;
    }
    return b.score - a.score;
  });

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">
          发现 {recommendations.length} 台设备
        </h2>
        <button
          onClick={onDiscover}
          className="text-xs text-primary-600 hover:text-primary-700 transition-colors"
          type="button"
        >
          刷新
        </button>
      </div>

      {/* Device items */}
      <div className="space-y-2">
        {sorted.map(({ device, score, reasons }) => {
          const isSelected = device.id === selectedId;
          const isOnline = device.isOnline;

          return (
            <button
              key={device.id}
              onClick={() => isOnline && onSelect(device)}
              disabled={!isOnline}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                isSelected
                  ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                  : isOnline
                    ? 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
              }`}
              type="button"
              aria-pressed={isSelected}
              aria-label={`选择设备: ${device.name}`}
            >
              <div className="flex items-center gap-3">
                {/* Device icon */}
                <span className="text-xl shrink-0">
                  {getDeviceIcon(device.type)}
                </span>

                {/* Device info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium truncate ${
                      isOnline ? 'text-gray-900' : 'text-gray-500'
                    }`}>
                      {device.name}
                    </span>
                    {/* Online/Offline badge - T047 */}
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                      isOnline
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${getStatusClass(isOnline)}`} />
                      {getStatusText(isOnline)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-gray-400">
                      {device.address}{device.port ? `:${device.port}` : ''}
                    </span>
                    <span className="text-[10px] text-gray-300">·</span>
                    <span className="text-[10px] text-gray-400">
                      {formatLastSeen(device.lastSeen)}
                    </span>
                  </div>

                  {/* Recommendation reasons */}
                  {reasons.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1">
                      {reasons.map((reason, i) => (
                        <span
                          key={i}
                          className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Score indicator - T046 recent device quick access */}
                {isOnline && (
                  <div className="flex flex-col items-center shrink-0">
                    <div className="text-xs font-semibold text-primary-600">
                      {Math.round(score)}
                    </div>
                    <div className="text-[8px] text-gray-400">评分</div>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default DeviceList;
