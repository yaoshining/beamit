/**
 * VideoList Component
 * Displays detected video sources grouped by type with select functionality.
 * Supports loading, empty, and error states.
 */

import React from 'react';
import type { VideoSource } from '@shared/types';
import { groupByType, getRecommendedSource } from '@shared/detectors/video-source-selector';
import type { VideoSourceGroup } from '@shared/detectors/video-source-selector';
import { sortSourcesByPriority } from '@shared/detectors/video-detector';

export interface VideoListProps {
  /** Detected video sources */
  sources: VideoSource[];
  /** Currently selected source ID */
  selectedId?: string;
  /** Whether video detection is in progress */
  loading?: boolean;
  /** Error message from detection */
  error?: string | null;
  /** Called when a source is selected */
  onSelect: (source: VideoSource) => void;
  /** Called to trigger re-detection */
  onRefresh: () => void;
}

/**
 * Format a URL for display by truncating the middle.
 * e.g., "https://example.com/.../video.mp4"
 */
function formatUrlForDisplay(url: string, maxLength = 50): string {
  if (url.length <= maxLength) return url;
  const start = url.slice(0, 30);
  const end = url.slice(-15);
  return `${start}...${end}`;
}

/**
 * Get badge color class based on video type.
 */
function getTypeBadgeClass(type: VideoSource['type']): string {
  switch (type) {
    case 'media':
      return 'bg-blue-100 text-blue-700';
    case 'hls':
      return 'bg-green-100 text-green-700';
    case 'dash':
      return 'bg-purple-100 text-purple-700';
    case 'iframe':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

/**
 * Get type label in Chinese.
 */
function getTypeLabel(type: VideoSource['type']): string {
  switch (type) {
    case 'media':
      return 'HTML5';
    case 'hls':
      return 'HLS';
    case 'dash':
      return 'DASH';
    case 'iframe':
      return '嵌入';
    default:
      return type;
  }
}

/**
 * Format duration from seconds to mm:ss.
 */
function formatDuration(seconds?: number): string | null {
  if (seconds === undefined || seconds <= 0) return null;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Loading skeleton component.
 */
function LoadingSkeleton(): React.ReactElement {
  return (
    <div className="space-y-3 animate-pulse" role="status" aria-label="正在检测视频源">
      <div className="h-4 w-24 bg-gray-200 rounded" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg" />
        ))}
      </div>
      <span className="sr-only">正在检测视频源...</span>
    </div>
  );
}

/**
 * Empty state component when no videos detected.
 */
function EmptyState({ onRefresh }: { onRefresh: () => void }): React.ReactElement {
  return (
    <div className="text-center py-8">
      <div className="text-4xl mb-3">📺</div>
      <p className="text-sm text-gray-500 mb-4">当前页面未检测到视频源</p>
      <button
        onClick={onRefresh}
        className="btn-secondary text-xs"
        type="button"
      >
        重新检测
      </button>
    </div>
  );
}

/**
 * Error state component.
 */
function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}): React.ReactElement {
  return (
    <div className="text-center py-8">
      <div className="text-4xl mb-3">⚠️</div>
      <p className="text-sm text-red-600 mb-2">检测失败</p>
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
 * VideoList Component
 *
 * Displays all detected video sources grouped by type.
 * Highlights the recommended source and currently selected source.
 */
export function VideoList({
  sources,
  selectedId,
  loading = false,
  error = null,
  onSelect,
  onRefresh,
}: VideoListProps): React.ReactElement {
  const recommended = getRecommendedSource(sources);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRefresh} />;
  }

  if (sources.length === 0) {
    return <EmptyState onRefresh={onRefresh} />;
  }

  const sortedSources = sortSourcesByPriority(sources);
  const groups = groupByType(sortedSources);

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">
          检测到 {sources.length} 个视频源
        </h2>
        <button
          onClick={onRefresh}
          className="text-xs text-primary-600 hover:text-primary-700 transition-colors"
          type="button"
        >
          重新检测
        </button>
      </div>

      {/* Recommended source highlight */}
      {recommended && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-primary-700">推荐</span>
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getTypeBadgeClass(recommended.type)}`}>
              {getTypeLabel(recommended.type)}
            </span>
          </div>
          <p className="text-xs text-gray-600 truncate">
            {formatUrlForDisplay(recommended.url, 60)}
          </p>
          {recommended.duration !== undefined && recommended.duration > 0 && (
            <p className="text-xs text-gray-400 mt-1">{formatDuration(recommended.duration)}</p>
          )}
          <button
            onClick={() => onSelect(recommended)}
            className="btn-primary text-xs mt-2 w-full"
            type="button"
          >
            投屏此视频
          </button>
        </div>
      )}

      {/* Grouped video sources */}
      <div className="space-y-3">
        {groups.map((group: VideoSourceGroup) => (
          <div key={group.type}>
            <h3 className="text-xs font-medium text-gray-400 mb-2">
              {group.label}
              <span className="ml-1 text-gray-300">({group.sources.length})</span>
            </h3>
            <div className="space-y-2">
              {group.sources.map((source) => {
                const isSelected = source.id === selectedId;
                const isRecommended =
                  recommended !== null && source.id === recommended.id;

                return (
                  <button
                    key={source.id}
                    onClick={() => onSelect(source)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                        : isRecommended
                          ? 'border-primary-200 bg-primary-50/50'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`选择视频源: ${formatUrlForDisplay(source.url)}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${getTypeBadgeClass(source.type)}`}>
                          {getTypeLabel(source.type)}
                        </span>
                        <span className="text-xs text-gray-600 truncate">
                          {formatUrlForDisplay(source.url)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isRecommended && !isSelected && (
                          <span className="text-[10px] text-primary-600 font-medium">推荐</span>
                        )}
                        {formatDuration(source.duration) && (
                          <span className="text-[10px] text-gray-400">
                            {formatDuration(source.duration)}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default VideoList;
