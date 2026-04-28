/**
 * IndexPopup Component Tests
 * Tests the main popup component with view switching, auto-detection,
 * device discovery, and casting flow.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import IndexPopup from '@popup/../popup';
import type { VideoSource, CastingDevice } from '@shared/types';

// Must use vi.hoisted() because vi.mock factories are hoisted to top of file
const mockDevice = vi.hoisted(() => ({
  id: 'tv-1',
  name: 'Living Room TV',
  address: '192.168.1.100',
  port: 1900,
  type: 'tv',
  protocol: 'dlna',
  isOnline: true,
  lastSeen: Date.now(),
} as CastingDevice));

// Mock device-manager
vi.mock('@background-utils/devices/device-manager', () => ({
  startDiscovery: vi.fn().mockResolvedValue([mockDevice]),
  stopDiscovery: vi.fn(),
}));

// Mock device-recommender
vi.mock('@background-utils/devices/device-recommender', () => ({
  getRecommendedDevices: vi.fn().mockResolvedValue([
    { device: mockDevice, score: 85, reasons: ['Online', 'Recently used'] },
  ]),
}));

// Mock shared storage (for getDiscoveredDevices T046)
vi.mock('@shared/storage', () => ({
  getDiscoveredDevices: vi.fn().mockResolvedValue([]),
}));

describe('IndexPopup', () => {
  const originalSendMessage = global.chrome?.runtime?.sendMessage;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalSendMessage) {
      (global.chrome as any).runtime.sendMessage = originalSendMessage;
    }
  });

  it('should render the popup with BeamIt header', async () => {
    (global.chrome as any).runtime.sendMessage = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      render(<IndexPopup />);
    });

    expect(screen.getByText('Beam It')).toBeDefined();
    expect(screen.getByText('视频投屏')).toBeDefined();
  });

  it('should show detection view by default', async () => {
    (global.chrome as any).runtime.sendMessage = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      render(<IndexPopup />);
    });

    // VideoSelector shows empty state when no sources
    expect(screen.getByText('未检测到视频源')).toBeDefined();
    // VideoList shows empty state
    expect(screen.getByText('当前页面未检测到视频源')).toBeDefined();
  });

  it('should display detected videos from background response', async () => {
    const mockVideos: VideoSource[] = [
      {
        id: 'v1', url: 'https://example.com/video.mp4',
        type: 'media', pageUrl: 'https://example.com',
        pageTitle: 'Test Video', detectedAt: Date.now(),
      },
    ];

    (global.chrome as any).runtime.sendMessage = vi.fn().mockResolvedValue({
      success: true,
      videos: mockVideos,
    });

    await act(async () => {
      render(<IndexPopup />);
    });

    expect(screen.getByText('1 个视频源')).toBeDefined();
  });

  it('should display detection error from background response', async () => {
    (global.chrome as any).runtime.sendMessage = vi.fn().mockResolvedValue({
      success: false,
      error: 'Failed to access page',
    });

    await act(async () => {
      render(<IndexPopup />);
    });

    expect(screen.getByText('Failed to access page')).toBeDefined();
  });

  it('should use demo data in dev mode when background throws', async () => {
    (global.chrome as any).runtime.sendMessage = vi.fn().mockRejectedValue(
      new Error('Connection refused')
    );

    await act(async () => {
      render(<IndexPopup />);
    });

    expect(screen.getByText('2 个视频源')).toBeDefined();
  });

  it('should show "投屏到设备" button when a source is selected', async () => {
    const mockVideos: VideoSource[] = [
      {
        id: 'v1', url: 'https://example.com/video.mp4',
        type: 'media', pageUrl: 'https://example.com',
        pageTitle: 'Test Video', detectedAt: Date.now(),
      },
    ];

    (global.chrome as any).runtime.sendMessage = vi.fn().mockResolvedValue({
      success: true,
      videos: mockVideos,
    });

    await act(async () => {
      render(<IndexPopup />);
    });

    // Select a video source
    const sourceButton = screen.getByLabelText(/选择视频源/);
    await act(async () => {
      fireEvent.click(sourceButton);
    });

    expect(screen.getByText('投屏到设备')).toBeDefined();
  });

  it('should show devices view when "投屏到设备" is clicked', async () => {
    const mockVideos: VideoSource[] = [
      {
        id: 'v1', url: 'https://example.com/video.mp4',
        type: 'media', pageUrl: 'https://example.com',
        pageTitle: 'Test Video', detectedAt: Date.now(),
      },
    ];

    (global.chrome as any).runtime.sendMessage = vi.fn().mockResolvedValue({
      success: true,
      videos: mockVideos,
    });

    await act(async () => {
      render(<IndexPopup />);
    });

    // Select source
    const sourceButton = screen.getByLabelText(/选择视频源/);
    await act(async () => {
      fireEvent.click(sourceButton);
    });

    // Go to devices view
    await act(async () => {
      fireEvent.click(screen.getByText('投屏到设备'));
    });

    expect(screen.getByText('选择设备')).toBeDefined();
    expect(screen.getByText('待投屏视频')).toBeDefined();
  });

  it('should show casting view when a device is selected', async () => {
    const mockVideos: VideoSource[] = [
      {
        id: 'v1', url: 'https://example.com/video.mp4',
        type: 'media', pageUrl: 'https://example.com',
        pageTitle: 'Test Video', detectedAt: Date.now(),
      },
    ];

    // First call = DETECT_VIDEOS, second call = START_CASTING
    const sendMessageMock = vi.fn()
      .mockResolvedValueOnce({ success: true, videos: mockVideos })
      .mockResolvedValueOnce(undefined);

    (global.chrome as any).runtime.sendMessage = sendMessageMock;

    const { startDiscovery } = await import('@background-utils/devices/device-manager');
    (startDiscovery as any).mockResolvedValue([mockDevice]);

    await act(async () => {
      render(<IndexPopup />);
    });

    // Select source
    const sourceButton = screen.getByLabelText(/选择视频源/);
    await act(async () => {
      fireEvent.click(sourceButton);
    });

    // Go to devices view
    await act(async () => {
      fireEvent.click(screen.getByText('投屏到设备'));
    });

    // Wait for device to appear
    await waitFor(() => {
      expect(screen.getByText('Living Room TV')).toBeDefined();
    });

    // Click device to cast
    await act(async () => {
      fireEvent.click(screen.getByText('Living Room TV'));
    });

    expect(screen.getByText('投屏中')).toBeDefined();
    expect(screen.getByText(/正在投屏到 Living Room TV/)).toBeDefined();
  });

  it('should show back button in devices view and navigate back', async () => {
    const mockVideos: VideoSource[] = [
      {
        id: 'v1', url: 'https://example.com/video.mp4',
        type: 'media', pageUrl: 'https://example.com',
        pageTitle: 'Test Video', detectedAt: Date.now(),
      },
    ];

    (global.chrome as any).runtime.sendMessage = vi.fn().mockResolvedValue({
      success: true,
      videos: mockVideos,
    });

    await act(async () => {
      render(<IndexPopup />);
    });

    // Select source
    const sourceButton = screen.getByLabelText(/选择视频源/);
    await act(async () => {
      fireEvent.click(sourceButton);
    });

    // Go to devices view
    await act(async () => {
      fireEvent.click(screen.getByText('投屏到设备'));
    });

    // Back button visible
    const backButton = screen.getByLabelText('返回');
    expect(backButton).toBeDefined();

    // Click back
    await act(async () => {
      fireEvent.click(backButton);
    });

    expect(screen.getByText('视频投屏')).toBeDefined();
  });

  it('should show BeamIt version in footer', async () => {
    (global.chrome as any).runtime.sendMessage = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      render(<IndexPopup />);
    });

    expect(screen.getByText('BeamIt v0.1.0')).toBeDefined();
  });

  it('should handle empty discover results gracefully', async () => {
    const mockVideos: VideoSource[] = [
      {
        id: 'v1', url: 'https://example.com/video.mp4',
        type: 'media', pageUrl: 'https://example.com',
        pageTitle: 'Test Video', detectedAt: Date.now(),
      },
    ];

    (global.chrome as any).runtime.sendMessage = vi.fn().mockResolvedValue({
      success: true,
      videos: mockVideos,
    });

    const { startDiscovery } = await import('@background-utils/devices/device-manager');
    (startDiscovery as any).mockResolvedValue([]);

    await act(async () => {
      render(<IndexPopup />);
    });

    // Select source
    const sourceButton = screen.getByLabelText(/选择视频源/);
    await act(async () => {
      fireEvent.click(sourceButton);
    });

    // Go to devices view
    await act(async () => {
      fireEvent.click(screen.getByText('投屏到设备'));
    });

    await waitFor(() => {
      expect(screen.getByText('未发现可用设备')).toBeDefined();
    });
  });
});
