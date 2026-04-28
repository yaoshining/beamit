/**
 * VideoSelector Component Tests
 * Tests the dropdown video source selector with various states
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VideoSelector } from '@popup/components/VideoSelector';
import type { VideoSource } from '@shared/types';

function createSource(
  id: string,
  url: string,
  type: VideoSource['type'] = 'media',
  overrides: Partial<VideoSource> = {}
): VideoSource {
  return {
    id,
    url,
    type,
    detectedAt: Date.now(),
    ...overrides,
  } as VideoSource;
}

describe('VideoSelector', () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show empty state when no sources', () => {
    render(
      <VideoSelector
        sources={[]}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText('未检测到视频源')).toBeDefined();
  });

  it('should be disabled when no sources', () => {
    render(
      <VideoSelector
        sources={[]}
        onSelect={mockOnSelect}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should show placeholder text when no source selected', () => {
    const sources = [createSource('src-1', 'https://example.com/video.mp4', 'media')];

    render(
      <VideoSelector
        sources={sources}
        onSelect={mockOnSelect}
        placeholder="Select a video source"
      />
    );

    expect(screen.getByText('Select a video source')).toBeDefined();
  });

  it('should show default placeholder when not specified', () => {
    const sources = [createSource('src-1', 'https://example.com/video.mp4', 'media')];

    render(
      <VideoSelector
        sources={sources}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText('选择视频源')).toBeDefined();
  });

  it('should display selected source URL when selectedId is provided', () => {
    const sources = [
      createSource('src-1', 'https://example.com/video.mp4', 'media'),
    ];

    render(
      <VideoSelector
        sources={sources}
        selectedId="src-1"
        onSelect={mockOnSelect}
      />
    );

    // Should show the source URL (truncated) with icon
    expect(screen.getByText(/video.mp4/)).toBeDefined();
  });

  it('should open dropdown on trigger click', () => {
    const sources = [createSource('src-1', 'https://example.com/video.mp4', 'media')];

    render(
      <VideoSelector
        sources={sources}
        onSelect={mockOnSelect}
      />
    );

    // Click the trigger button
    const trigger = screen.getByRole('button', { name: '选择视频源' });
    fireEvent.click(trigger);

    // Dropdown should appear
    expect(screen.getByRole('listbox')).toBeDefined();
  });

  it('should close dropdown when Escape key is pressed', () => {
    const sources = [createSource('src-1', 'https://example.com/video.mp4', 'media')];

    render(
      <VideoSelector
        sources={sources}
        onSelect={mockOnSelect}
      />
    );

    // Open dropdown
    const trigger = screen.getByRole('button', { name: '选择视频源' });
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeDefined();

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('should call onSelect when a source is selected from dropdown', () => {
    const sources = [createSource('src-1', 'https://example.com/video.mp4', 'media')];

    render(
      <VideoSelector
        sources={sources}
        onSelect={mockOnSelect}
      />
    );

    // Open dropdown
    const trigger = screen.getByRole('button', { name: '选择视频源' });
    fireEvent.click(trigger);

    // Click the option
    const option = screen.getByRole('option');
    fireEvent.click(option);
    expect(mockOnSelect).toHaveBeenCalledWith(sources[0]);
  });

  it('should close dropdown after selecting an option', () => {
    const sources = [createSource('src-1', 'https://example.com/video.mp4', 'media')];

    render(
      <VideoSelector
        sources={sources}
        onSelect={mockOnSelect}
      />
    );

    // Open dropdown
    const trigger = screen.getByRole('button', { name: '选择视频源' });
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeDefined();

    // Select option
    const option = screen.getByRole('option');
    fireEvent.click(option);

    // Dropdown should close
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('should be disabled when disabled prop is true', () => {
    const sources = [createSource('src-1', 'https://example.com/video.mp4', 'media')];

    render(
      <VideoSelector
        sources={sources}
        onSelect={mockOnSelect}
        disabled={true}
      />
    );

    const trigger = screen.getByRole('button');
    expect(trigger).toBeDisabled();
  });

  it('should show grouped sources by type in dropdown', () => {
    const sources = [
      createSource('src-1', 'https://example.com/video.mp4', 'media'),
      createSource('src-2', 'https://example.com/stream.m3u8', 'hls'),
    ];

    render(
      <VideoSelector
        sources={sources}
        onSelect={mockOnSelect}
      />
    );

    // Open dropdown
    const trigger = screen.getByRole('button', { name: '选择视频源' });
    fireEvent.click(trigger);

    // Should show group labels
    expect(screen.getByText('HTML5 视频')).toBeDefined();
    expect(screen.getByText('HLS 流 (m3u8)')).toBeDefined();
  });

  it('should mark selected option with aria-selected', () => {
    const sources = [
      createSource('src-1', 'https://example.com/video.mp4', 'media'),
    ];

    render(
      <VideoSelector
        sources={sources}
        selectedId="src-1"
        onSelect={mockOnSelect}
      />
    );

    // Open dropdown
    const trigger = screen.getByRole('button', { name: '选择视频源' });
    fireEvent.click(trigger);

    const option = screen.getByRole('option');
    expect(option.getAttribute('aria-selected')).toBe('true');
  });

  it('should open dropdown on ArrowDown key', () => {
    const sources = [createSource('src-1', 'https://example.com/video.mp4', 'media')];

    render(
      <VideoSelector
        sources={sources}
        onSelect={mockOnSelect}
      />
    );

    const trigger = screen.getByRole('button', { name: '选择视频源' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });

    // Dropdown should appear
    expect(screen.getByRole('listbox')).toBeDefined();
  });

  it('should toggle dropdown on Enter key', () => {
    const sources = [createSource('src-1', 'https://example.com/video.mp4', 'media')];

    render(
      <VideoSelector
        sources={sources}
        onSelect={mockOnSelect}
      />
    );

    const trigger = screen.getByRole('button', { name: '选择视频源' });

    // Enter opens dropdown
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(screen.getByRole('listbox')).toBeDefined();

    // Enter closes dropdown
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('should toggle dropdown on Space key', () => {
    const sources = [createSource('src-1', 'https://example.com/video.mp4', 'media')];

    render(
      <VideoSelector
        sources={sources}
        onSelect={mockOnSelect}
      />
    );

    const trigger = screen.getByRole('button', { name: '选择视频源' });

    // Space opens dropdown
    fireEvent.keyDown(trigger, { key: ' ' });
    expect(screen.getByRole('listbox')).toBeDefined();

    // Space closes dropdown
    fireEvent.keyDown(trigger, { key: ' ' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('should not open dropdown when disabled', () => {
    const sources = [createSource('src-1', 'https://example.com/video.mp4', 'media')];

    render(
      <VideoSelector
        sources={sources}
        onSelect={mockOnSelect}
        disabled={true}
      />
    );

    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
