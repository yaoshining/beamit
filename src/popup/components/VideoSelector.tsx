/**
 * VideoSelector Component
 * Dropdown/selector component for choosing which video source to cast.
 * Supports disabled state, empty state, and accessible keyboard navigation.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { VideoSource } from '@shared/types';
import { groupByType } from '@shared/detectors/video-source-selector';
import type { VideoSourceGroup } from '@shared/detectors/video-source-selector';
import { sortSourcesByPriority } from '@shared/detectors/video-detector';

export interface VideoSelectorProps {
  /** Available video sources to choose from */
  sources: VideoSource[];
  /** Currently selected source ID */
  selectedId?: string;
  /** Called when a source is selected */
  onSelect: (source: VideoSource) => void;
  /** Whether the selector is disabled (e.g., during casting) */
  disabled?: boolean;
  /** Placeholder text when no sources */
  placeholder?: string;
}

/**
 * Get type icon emoji based on video type.
 */
function getTypeIcon(type: VideoSource['type']): string {
  switch (type) {
    case 'media':
      return '🎬';
    case 'hls':
      return '📡';
    case 'dash':
      return '📊';
    case 'iframe':
      return '🔗';
    default:
      return '📹';
  }
}

/**
 * Get type badge color class based on video type.
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
 * Format a URL for display by truncating the middle.
 */
function formatUrlForDisplay(url: string, maxLength = 40): string {
  if (url.length <= maxLength) return url;
  const start = url.slice(0, 25);
  const end = url.slice(-12);
  return `${start}...${end}`;
}

/**
 * VideoSelector Component
 *
 * Dropdown that shows available video sources grouped by type.
 * Closes on outside click and Escape key.
 */
export function VideoSelector({
  sources,
  selectedId,
  onSelect,
  disabled = false,
  placeholder = '选择视频源',
}: VideoSelectorProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const sortedSources = sortSourcesByPriority(sources);
  const groups = groupByType(sortedSources);
  const selectedSource = sources.find((s) => s.id === selectedId);
  const hasSources = sources.length > 0;

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleOutsideClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    // Delay adding listener to avoid immediate trigger
    const timer = setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [isOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    if (!disabled && hasSources) {
      setIsOpen((prev) => !prev);
    }
  }, [disabled, hasSources]);

  const handleSelect = useCallback(
    (source: VideoSource) => {
      onSelect(source);
      setIsOpen(false);
      triggerRef.current?.focus();
    },
    [onSelect]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled || !hasSources) return;

      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          handleToggle();
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
          } else {
            // Focus first item in dropdown
            const firstItem = listRef.current?.querySelector<HTMLButtonElement>(
              '[role="option"]'
            );
            firstItem?.focus();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (isOpen) {
            // Focus last item in dropdown
            const items =
              listRef.current?.querySelectorAll<HTMLButtonElement>(
                '[role="option"]'
              );
            if (items && items.length > 0) {
              items[items.length - 1].focus();
            }
          }
          break;
      }
    },
    [disabled, hasSources, isOpen, handleToggle]
  );

  // Empty state
  if (!hasSources) {
    return (
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          disabled
          className="w-full flex items-center justify-between px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-400 cursor-not-allowed"
        >
          <span>未检测到视频源</span>
          <svg
            className="w-4 h-4 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-3 py-2.5 text-sm border rounded-lg transition-all ${
          disabled
            ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
            : isOpen
              ? 'bg-white border-primary-500 ring-1 ring-primary-500 text-gray-900'
              : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700'
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={placeholder}
      >
        <span className="truncate">
          {selectedSource
            ? `${getTypeIcon(selectedSource.type)} ${formatUrlForDisplay(selectedSource.url)}`
            : placeholder}
        </span>
        <svg
          className={`w-4 h-4 shrink-0 ml-2 transition-transform ${
            isOpen ? 'rotate-180' : ''
          } ${disabled ? 'text-gray-300' : 'text-gray-500'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && hasSources && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto"
          role="listbox"
          aria-label="视频源列表"
        >
          {groups.map((group: VideoSourceGroup) => (
            <div key={group.type}>
              {/* Group header */}
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-100">
                {group.label}
                <span className="ml-1 text-gray-300">
                  ({group.sources.length})
                </span>
              </div>

              {/* Group items */}
              {group.sources.map((source) => {
                const isSelected = source.id === selectedId;

                return (
                  <button
                    key={source.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(source)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        const next =
                          (e.target as HTMLElement)
                            .closest('[role="option"]')
                            ?.nextElementSibling?.querySelector<
                              HTMLButtonElement
                            >('[role="option"]') ??
                          (
                            e.target as HTMLElement
                          ).closest('[role="listbox"]')
                            ?.querySelector<HTMLButtonElement>(
                              '[role="option"]'
                            );
                        next?.focus();
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        const prev =
                          (e.target as HTMLElement)
                            .closest('[role="option"]')
                            ?.previousElementSibling?.querySelector<
                              HTMLButtonElement
                            >('[role="option"]') ??
                          (
                            e.target as HTMLElement
                          ).closest('[role="listbox"]')
                            ?.querySelectorAll<HTMLButtonElement>(
                              '[role="option"]'
                            );
                        if (prev instanceof NodeList && prev.length > 0) {
                          prev[prev.length - 1].focus();
                        } else if (prev instanceof HTMLElement) {
                          prev.focus();
                        }
                      }
                    }}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-2 text-sm transition-colors ${
                      isSelected
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    type="button"
                  >
                    <span className="text-xs shrink-0">
                      {getTypeIcon(source.type)}
                    </span>
                    <span
                      className={`px-1 py-0.5 rounded text-[10px] font-medium shrink-0 ${getTypeBadgeClass(source.type)}`}
                    >
                      {source.type.toUpperCase()}
                    </span>
                    <span className="truncate text-xs">
                      {formatUrlForDisplay(source.url)}
                    </span>
                    {isSelected && (
                      <span className="ml-auto text-primary-600 shrink-0">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default VideoSelector;
