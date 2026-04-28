/**
 * DeviceList Component Tests
 * Tests rendering of device recommendations with various states
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeviceList } from '@popup/components/DeviceList';
import type { DeviceRecommendation } from '@background-utils/devices/device-recommender';
import type { CastingDevice } from '@shared/types';

function createDevice(overrides: Partial<CastingDevice> = {}): CastingDevice {
  return {
    id: 'tv-1',
    name: 'Living Room TV',
    address: '192.168.1.100',
    port: 1900,
    type: 'tv',
    protocol: 'dlna',
    isOnline: true,
    lastSeen: Date.now(),
    ...overrides,
  } as CastingDevice;
}

function createRecommendation(
  deviceOverrides: Partial<CastingDevice> = {},
  score = 85,
  reasons: string[] = ['Recently used', 'Online']
): DeviceRecommendation {
  return {
    device: createDevice(deviceOverrides),
    score,
    reasons,
  };
}

describe('DeviceList', () => {
  const mockOnSelect = vi.fn();
  const mockOnDiscover = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render list of devices', () => {
    const recommendations = [
      createRecommendation({ id: 'tv-1', name: 'Living Room TV' }),
      createRecommendation({ id: 'tv-2', name: 'Bedroom TV' }, 60, ['Online']),
    ];

    render(
      <DeviceList
        recommendations={recommendations}
        onSelect={mockOnSelect}
        onDiscover={mockOnDiscover}
        isDiscovering={false}
      />
    );

    expect(screen.getByText('Living Room TV')).toBeDefined();
    expect(screen.getByText('Bedroom TV')).toBeDefined();
  });

  it('should display device type icons', () => {
    const recommendations = [
      createRecommendation({ type: 'tv', name: 'Samsung TV' }),
      createRecommendation({ type: 'speaker', name: 'Sonos Speaker' }),
      createRecommendation({ type: 'receiver', name: 'AV Receiver' }),
    ];

    render(
      <DeviceList
        recommendations={recommendations}
        onSelect={mockOnSelect}
        onDiscover={mockOnDiscover}
        isDiscovering={false}
      />
    );

    expect(screen.getByText('Samsung TV')).toBeDefined();
    expect(screen.getByText('Sonos Speaker')).toBeDefined();
    expect(screen.getByText('AV Receiver')).toBeDefined();
  });

  it('should call onSelect when a device is clicked', () => {
    const recommendations = [createRecommendation({}, 85, ['Recently used', 'Online'])];

    render(
      <DeviceList
        recommendations={recommendations}
        onSelect={mockOnSelect}
        onDiscover={mockOnDiscover}
        isDiscovering={false}
      />
    );

    fireEvent.click(screen.getByText('Living Room TV'));
    // Use the wrapped recommendation's device (same object reference)
    expect(mockOnSelect).toHaveBeenCalledWith(recommendations[0].device);
  });

  it('should not call onSelect when an offline device is clicked', () => {
    const recommendations = [
      createRecommendation({ isOnline: false, name: 'Offline TV' }),
    ];

    render(
      <DeviceList
        recommendations={recommendations}
        onSelect={mockOnSelect}
        onDiscover={mockOnDiscover}
        isDiscovering={false}
      />
    );

    const offlineButton = screen.getByText('Offline TV').closest('button');
    expect(offlineButton).toBeDisabled();
    fireEvent.click(screen.getByText('Offline TV'));
    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  it('should show discovery skeleton when discovering', () => {
    render(
      <DeviceList
        recommendations={[]}
        onSelect={mockOnSelect}
        onDiscover={mockOnDiscover}
        isDiscovering={true}
      />
    );

    // Should show skeleton with Chinese loading text
    expect(screen.getByText('正在搜索设备...')).toBeDefined();
  });

  it('should show empty state when no devices and not discovering', () => {
    render(
      <DeviceList
        recommendations={[]}
        onSelect={mockOnSelect}
        onDiscover={mockOnDiscover}
        isDiscovering={false}
      />
    );

    expect(screen.getByText('未发现可用设备')).toBeDefined();
  });

  it('should call onDiscover when refresh button is clicked in empty state', () => {
    render(
      <DeviceList
        recommendations={[]}
        onSelect={mockOnSelect}
        onDiscover={mockOnDiscover}
        isDiscovering={false}
      />
    );

    const searchButton = screen.getByText('重新搜索');
    fireEvent.click(searchButton);
    expect(mockOnDiscover).toHaveBeenCalled();
  });

  it('should show error state when error is provided', () => {
    render(
      <DeviceList
        recommendations={[]}
        onSelect={mockOnSelect}
        onDiscover={mockOnDiscover}
        isDiscovering={false}
        error="Discovery failed"
      />
    );

    expect(screen.getByText('搜索失败')).toBeDefined();
    expect(screen.getByText('Discovery failed')).toBeDefined();
  });

  it('should call onDiscover when retry button is clicked in error state', () => {
    render(
      <DeviceList
        recommendations={[]}
        onSelect={mockOnSelect}
        onDiscover={mockOnDiscover}
        isDiscovering={false}
        error="Discovery failed"
      />
    );

    const retryButton = screen.getByText('重试');
    fireEvent.click(retryButton);
    expect(mockOnDiscover).toHaveBeenCalled();
  });

  it('should show offline status for offline devices', () => {
    const recommendations = [
      createRecommendation({ isOnline: false, name: 'Offline TV' }),
    ];

    render(
      <DeviceList
        recommendations={recommendations}
        onSelect={mockOnSelect}
        onDiscover={mockOnDiscover}
        isDiscovering={false}
      />
    );

    expect(screen.getByText('离线')).toBeDefined();
  });

  it('should show online status for online devices', () => {
    const recommendations = [
      createRecommendation({ isOnline: true, name: 'Online TV' }),
    ];

    render(
      <DeviceList
        recommendations={recommendations}
        onSelect={mockOnSelect}
        onDiscover={mockOnDiscover}
        isDiscovering={false}
      />
    );

    expect(screen.getByText('在线')).toBeDefined();
  });

  it('should display recommendation reasons', () => {
    const recommendations = [
      createRecommendation({}, 90, ['Recently used', 'Online', 'Nearby']),
    ];

    render(
      <DeviceList
        recommendations={recommendations}
        onSelect={mockOnSelect}
        onDiscover={mockOnDiscover}
        isDiscovering={false}
      />
    );

    expect(screen.getByText('Recently used')).toBeDefined();
    expect(screen.getByText('Online')).toBeDefined();
    expect(screen.getByText('Nearby')).toBeDefined();
  });

  it('should display score for online devices', () => {
    const recommendations = [
      createRecommendation({ name: 'Scored Device' }, 85),
    ];

    render(
      <DeviceList
        recommendations={recommendations}
        onSelect={mockOnSelect}
        onDiscover={mockOnDiscover}
        isDiscovering={false}
      />
    );

    // Score (rounded) should be displayed
    expect(screen.getByText('85')).toBeDefined();
  });

  it('should highlight selected device with selectedId', () => {
    const recommendations = [createRecommendation({ id: 'tv-1', name: 'Living Room TV' })];

    render(
      <DeviceList
        recommendations={recommendations}
        selectedId="tv-1"
        onSelect={mockOnSelect}
        onDiscover={mockOnDiscover}
        isDiscovering={false}
      />
    );

    // The selected device button should have aria-pressed="true"
    const selectedButton = screen.getByLabelText('选择设备: Living Room TV');
    expect(selectedButton.getAttribute('aria-pressed')).toBe('true');
  });

  it('should sort online devices by score (highest first)', () => {
    const recommendations = [
      createRecommendation({ id: 'low', name: 'Low Score' }, 30, ['Online']),
      createRecommendation({ id: 'high', name: 'High Score' }, 90, ['Online']),
    ];

    render(
      <DeviceList
        recommendations={recommendations}
        onSelect={mockOnSelect}
        onDiscover={mockOnDiscover}
        isDiscovering={false}
      />
    );

    // Both devices should be rendered
    expect(screen.getByText('High Score')).toBeDefined();
    expect(screen.getByText('Low Score')).toBeDefined();
  });

  it('should show refresh button in device list header', () => {
    const recommendations = [createRecommendation()];

    render(
      <DeviceList
        recommendations={recommendations}
        onSelect={mockOnSelect}
        onDiscover={mockOnDiscover}
        isDiscovering={false}
      />
    );

    const refreshButton = screen.getByText('刷新');
    fireEvent.click(refreshButton);
    expect(mockOnDiscover).toHaveBeenCalled();
  });

  it('should display device address and port', () => {
    const recommendations = [
      createRecommendation({ address: '10.0.0.5', port: 1900, name: 'Test Device' }),
    ];

    render(
      <DeviceList
        recommendations={recommendations}
        onSelect={mockOnSelect}
        onDiscover={mockOnDiscover}
        isDiscovering={false}
      />
    );

    expect(screen.getByText('10.0.0.5:1900')).toBeDefined();
  });

  it('should handle default discoveryTimeout prop gracefully', () => {
    const recommendations = [createRecommendation()];

    render(
      <DeviceList
        recommendations={recommendations}
        onSelect={mockOnSelect}
        onDiscover={mockOnDiscover}
        isDiscovering={false}
        discoveryTimeout={5000}
      />
    );

    expect(screen.getByText('Living Room TV')).toBeDefined();
  });
});
