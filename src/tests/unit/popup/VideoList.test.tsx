/**
 * VideoList Component Tests
 * Tests rendering of detected video sources with various states
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VideoList } from '@popup/components/VideoList';
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

describe('VideoList', () => {
  const mockOnSelect = vi.fn();
  const mockOnRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading skeleton when loading', () => {
    render(
      <VideoList
        sources={[]}
        loading={true}
        onSelect={mockOnSelect}
        onRefresh={mockOnRefresh}
      />
    );

    expect(screen.getByRole('status')).toBeDefined();
    expect(screen.getByText('正在检测视频源...')).toBeDefined();
  });

  it('should show empty state when no sources and not loading', () => {
    render(
      <VideoList
        sources={[]}
        loading={false}
        onSelect={mockOnSelect}
        onRefresh={mockOnRefresh}
      />
    );

    expect(screen.getByText('当前页面未检测到视频源')).toBeDefined();
  });

  it('should call onRefresh when refresh button is clicked in empty state', () => {
    render(
      <VideoList
        sources={[]}
        loading={false}
        onSelect={mockOnSelect}
        onRefresh={mockOnRefresh}
      />
    );

    fireEvent.click(screen.getByText('重新检测'));
    expect(mockOnRefresh).toHaveBeenCalled();
  });

  it('should show error state when error is provided', () => {
    render(
      <VideoList
        sources={[]}
        loading={false}
        error="Detection failed"
        onSelect={mockOnSelect}
        onRefresh={mockOnRefresh}
      />
    );

    expect(screen.getByText('检测失败')).toBeDefined();
    expect(screen.getByText('Detection failed')).toBeDefined();
  });

  it('should call onRefresh when retry button is clicked in error state', () => {
    render(
      <VideoList
        sources={[]}
        loading={false}
        error="Detection failed"
        onSelect={mockOnSelect}
        onRefresh={mockOnRefresh}
      />
    );

    fireEvent.click(screen.getByText('重试'));
    expect(mockOnRefresh).toHaveBeenCalled();
  });

  it('should render list of video sources', () => {
    const sources = [
      createSource('src-1', 'https://example.com/video.mp4', 'media'),
      createSource('src-2', 'https://example.com/stream.m3u8', 'hls'),
    ];

    render(
      <VideoList
        sources={sources}
        loading={false}
        onSelect={mockOnSelect}
        onRefresh={mockOnRefresh}
      />
    );

    expect(screen.getByText('检测到 2 个视频源')).toBeDefined();
  });

  it('should call onSelect when a source is clicked', () => {
    const sources = [createSource('src-1', 'https://example.com/video.mp4', 'media')];

    render(
      <VideoList
        sources={sources}
        loading={false}
        onSelect={mockOnSelect}
        onRefresh={mockOnRefresh}
      />
    );

    // Click on the source item button
    const sourceButton = screen.getByLabelText(/选择视频源/);
    fireEvent.click(sourceButton);
    expect(mockOnSelect).toHaveBeenCalledWith(sources[0]);
  });

  it('should show recommended source section', () => {
    const sources = [createSource('src-1', 'https://example.com/video.mp4', 'media')];

    render(
      <VideoList
        sources={sources}
        loading={false}
        onSelect={mockOnSelect}
        onRefresh={mockOnRefresh}
      />
    );

    // "推荐" appears in recommended header badge AND next to source item label
    const recommendedLabels = screen.getAllByText('推荐');
    expect(recommendedLabels.length).toBeGreaterThanOrEqual(1);
    // Should show "投屏此视频" button
    expect(screen.getByText('投屏此视频')).toBeDefined();
  });

  it('should call onSelect when "投屏此视频" button is clicked', () => {
    const sources = [createSource('src-1', 'https://example.com/video.mp4', 'media')];

    render(
      <VideoList
        sources={sources}
        loading={false}
        onSelect={mockOnSelect}
        onRefresh={mockOnRefresh}
      />
    );

    fireEvent.click(screen.getByText('投屏此视频'));
    expect(mockOnSelect).toHaveBeenCalledWith(sources[0]);
  });

  it('should display video type badges', () => {
    const sources = [
      createSource('src-1', 'https://example.com/video.mp4', 'media'),
      createSource('src-2', 'https://example.com/stream.m3u8', 'hls'),
      createSource('src-3', 'https://example.com/manifest.mpd', 'dash'),
      createSource('src-4', 'https://example.com/embed', 'iframe'),
    ];

    render(
      <VideoList
        sources={sources}
        loading={false}
        onSelect={mockOnSelect}
        onRefresh={mockOnRefresh}
      />
    );

    // Type labels appear in recommended section AND source list items
    expect(screen.getAllByText('HTML5').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('HLS').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('DASH').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('嵌入').length).toBeGreaterThanOrEqual(1);
  });

  it('should show refresh button in header when sources exist', () => {
    const sources = [createSource('src-1', 'https://example.com/video.mp4', 'media')];

    render(
      <VideoList
        sources={sources}
        loading={false}
        onSelect={mockOnSelect}
        onRefresh={mockOnRefresh}
      />
    );

    const refreshButton = screen.getByText('重新检测');
    fireEvent.click(refreshButton);
    expect(mockOnRefresh).toHaveBeenCalled();
  });

  it('should highlight selected source', () => {
    const sources = [createSource('src-1', 'https://example.com/video.mp4', 'media')];

    render(
      <VideoList
        sources={sources}
        selectedId="src-1"
        loading={false}
        onSelect={mockOnSelect}
        onRefresh={mockOnRefresh}
      />
    );

    const selectedButton = screen.getByLabelText(/选择视频源/);
    expect(selectedButton.getAttribute('aria-pressed')).toBe('true');
  });

  it('should display duration when available', () => {
    const sources = [
      createSource('src-1', 'https://example.com/video.mp4', 'media', { duration: 125 }),
    ];

    render(
      <VideoList
        sources={sources}
        loading={false}
        onSelect={mockOnSelect}
        onRefresh={mockOnRefresh}
      />
    );

    // 125 seconds = 2:05 (appears in recommended section AND source list)
    const durationTexts = screen.getAllByText('2:05');
    expect(durationTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('should display grouped sources by type', () => {
    const sources = [
      createSource('src-1', 'https://example.com/video.mp4', 'media'),
      createSource('src-2', 'https://example.com/stream.m3u8', 'hls'),
    ];

    render(
      <VideoList
        sources={sources}
        loading={false}
        onSelect={mockOnSelect}
        onRefresh={mockOnRefresh}
      />
    );

    // Multiple source items should be rendered
    const sourceButtons = screen.getAllByLabelText(/选择视频源/);
    expect(sourceButtons.length).toBe(2);
  });

  it('should display truncated URLs', () => {
    const longUrl = 'https://example.com/very/long/path/to/a/video/file.mp4?token=abc123';
    const sources = [createSource('src-1', longUrl, 'media')];

    render(
      <VideoList
        sources={sources}
        loading={false}
        onSelect={mockOnSelect}
        onRefresh={mockOnRefresh}
      />
    );

    // URL should be truncated (display contains "...")
    // formatUrlForDisplay slices first 30 + "..." + last 15 for maxLength=50
    // Truncated URL appears in recommended section AND source list item
    const truncated = longUrl.slice(0, 30) + '...' + longUrl.slice(-15);
    const urlTexts = screen.getAllByText(truncated);
    expect(urlTexts.length).toBeGreaterThanOrEqual(1);
  });
});
