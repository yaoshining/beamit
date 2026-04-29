import { useState, useCallback, useEffect, useRef } from 'react';
import './popup/styles/global.css';

import type { VideoSource, CastingDevice } from '@shared/types';
import { VideoList } from './popup/components/VideoList';
import { VideoSelector } from './popup/components/VideoSelector';
import { DeviceList } from './popup/components/DeviceList';
import { getRecommendedDevices } from '@background-utils/devices/device-recommender';
import type { DeviceRecommendation } from '@background-utils/devices/device-recommender';
import { startDiscovery, stopDiscovery } from '@background-utils/devices/device-manager';
import { getDiscoveredDevices } from '@shared/storage';
import { HTTP_DISCOVERY_TIMEOUT } from '@shared/constants';

type AppView = 'detect' | 'devices' | 'casting';

/** Maximum discovery timeout in milliseconds (matches HTTP full subnet scan time) */
const DISCOVERY_TIMEOUT_MS = HTTP_DISCOVERY_TIMEOUT;

function IndexPopup() {
  // Detection state
  const [sources, setSources] = useState<VideoSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<VideoSource | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionError, setDetectionError] = useState<string | null>(null);

  // Device discovery state
  const [recommendations, setRecommendations] = useState<DeviceRecommendation[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<CastingDevice | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const discoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // App view state
  const [currentView, setCurrentView] = useState<AppView>('detect');

  /**
   * Detect videos on the current page by sending a message
   * to the background service worker.
   */
  const detectVideos = useCallback(async () => {
    setIsDetecting(true);
    setDetectionError(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'DETECT_VIDEOS',
      });

      if (response?.success && response?.videos) {
        setSources(response.videos);
      } else if (response?.error) {
        setDetectionError(response.error);
      } else {
        setSources([]);
      }
    } catch (error) {
      console.warn('[Popup] Background not available (dev mode):', error);

      // Dev fallback: simulate detection with demo data
      const demoSources: VideoSource[] = [
        {
          id: 'demo-1',
          url: 'https://example.com/video.mp4',
          type: 'media',
          pageUrl: 'https://example.com',
          pageTitle: '示例视频',
          duration: 245,
          detectedAt: Date.now(),
        },
        {
          id: 'demo-2',
          url: 'https://example.com/stream.m3u8',
          type: 'hls',
          pageUrl: 'https://example.com',
          pageTitle: '直播流',
          duration: undefined,
          detectedAt: Date.now(),
        },
      ];
      setSources(demoSources);
    } finally {
      setIsDetecting(false);
    }
  }, []);

  /**
   * Discover DLNA devices on the network.
   * T046: First loads cached devices from session storage for quick access,
   * then runs full discovery in background.
   * T048: Optimized with 5-second timeout.
   */
  const discoverDevices = useCallback(async () => {
    setIsDiscovering(true);
    setDiscoveryError(null);

    try {
      // T046: Load cached devices immediately for quick access
      const cachedDevices = await getDiscoveredDevices();
      if (cachedDevices.length > 0) {
        const cachedRecs = await getRecommendedDevices(cachedDevices);
        setRecommendations(cachedRecs);
      }

      // T048: Enforce 5-second maximum timeout
      const timeoutPromise = new Promise<CastingDevice[]>((resolve) => {
        discoveryTimerRef.current = setTimeout(() => {
          stopDiscovery();
          resolve([]);
        }, DISCOVERY_TIMEOUT_MS);
      });

      const updateRecommendations = async (devices: CastingDevice[]) => {
        if (devices.length === 0) return;
        const recs = await getRecommendedDevices(devices);
        setRecommendations(recs);
      };

      const result = await Promise.race([
        startDiscovery({ onDevicesUpdated: updateRecommendations }),
        timeoutPromise,
      ]);

      if (discoveryTimerRef.current) {
        clearTimeout(discoveryTimerRef.current);
        discoveryTimerRef.current = null;
      }

      // Generate recommendations from discovered devices
      if (result.length > 0) {
        const recs = await getRecommendedDevices(result);
        setRecommendations(recs);
      } else if (cachedDevices.length === 0) {
        // Only set empty if no cached devices were available
        setRecommendations([]);
      }
    } catch (error) {
      setDiscoveryError(
        error instanceof Error ? error.message : '设备发现失败'
      );
      // T046: Don't clear recommendations on error if we have cached devices
      const cachedDevices = await getDiscoveredDevices().catch(() => []);
      if (cachedDevices.length === 0) {
        setRecommendations([]);
      }
    } finally {
      setIsDiscovering(false);
    }
  }, []);

  /**
   * Handle source selection from VideoList or VideoSelector.
   */
  const handleSelectSource = useCallback((source: VideoSource) => {
    setSelectedSource(source);
  }, []);

  /**
   * Handle device selection from DeviceList.
   * T046: Enables quick access to recently used devices.
   */
  const handleSelectDevice = useCallback(
    async (device: CastingDevice) => {
      setSelectedDevice(device);

      // Start casting with the selected device and source
      if (selectedSource) {
        try {
          await chrome.runtime.sendMessage({
            type: 'START_CASTING',
            payload: {
              deviceId: device.id,
              videoSource: selectedSource,
            },
          });
          setCurrentView('casting');
        } catch (error) {
          console.error('[Popup] Failed to start casting:', error);
        }
      }
    },
    [selectedSource]
  );

  /**
   * Handle casting the selected video source.
   * Switches to device discovery view.
   */
  const handleStartCasting = useCallback(() => {
    if (!selectedSource) return;
    setCurrentView('devices');
    discoverDevices();
  }, [selectedSource, discoverDevices]);

  /**
   * Go back to detection view.
   */
  const handleBackToDetection = useCallback(() => {
    setCurrentView('detect');
  }, []);

  /**
   * Cleanup discovery timer on unmount.
   */
  useEffect(() => {
    return () => {
      if (discoveryTimerRef.current) {
        clearTimeout(discoveryTimerRef.current);
      }
    };
  }, []);

  /**
   * Run auto-detection on mount.
   */
  useEffect(() => {
    detectVideos();
  }, [detectVideos]);

  return (
    <main className="min-w-[400px] min-h-[600px] bg-gray-50 text-gray-900 p-6">
      <section className="card flex h-full flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {currentView !== 'detect' && (
              <button
                onClick={handleBackToDetection}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                type="button"
                aria-label="返回"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            )}
            <div className="space-y-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-500">
                Beam It
              </p>
              <h1 className="text-lg font-semibold text-gray-900">
                {currentView === 'detect' && '视频投屏'}
                {currentView === 'devices' && '选择设备'}
                {currentView === 'casting' && '投屏中'}
              </h1>
            </div>
          </div>

          {/* Status indicator */}
          {sources.length > 0 && currentView === 'detect' && (
            <span className="text-xs text-gray-400">
              {sources.length} 个视频源
            </span>
          )}
          {recommendations.length > 0 && currentView === 'devices' && (
            <span className="text-xs text-gray-400">
              {recommendations.length} 台设备
            </span>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 space-y-4">
          {/* Detection View */}
          {currentView === 'detect' && (
            <>
              <VideoSelector
                sources={sources}
                selectedId={selectedSource?.id}
                onSelect={handleSelectSource}
                disabled={isDetecting}
                placeholder="选择要投屏的视频源"
              />

              <VideoList
                sources={sources}
                selectedId={selectedSource?.id}
                loading={isDetecting}
                error={detectionError}
                onSelect={handleSelectSource}
                onRefresh={detectVideos}
              />

              {selectedSource && (
                <button
                  onClick={handleStartCasting}
                  className="btn-primary w-full py-2.5 text-sm font-medium"
                  type="button"
                >
                  投屏到设备
                </button>
              )}
            </>
          )}

          {/* Devices View - T045/T046/T047 */}
          {currentView === 'devices' && (
            <>
              {/* Selected video summary */}
              {selectedSource && (
                <div className="bg-primary-50 border border-primary-200 rounded-lg p-3">
                  <div className="text-[10px] text-primary-600 font-medium mb-1">
                    待投屏视频
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 truncate">
                      {selectedSource.pageTitle || '未命名视频'}
                    </span>
                    <span className="text-[10px] text-gray-400 truncate">
                      {selectedSource.url}
                    </span>
                  </div>
                </div>
              )}

              {/* Device List (T045) with offline status (T047) and timeout (T048) */}
              <DeviceList
                recommendations={recommendations}
                selectedId={selectedDevice?.id}
                isDiscovering={isDiscovering}
                discoveryTimeout={DISCOVERY_TIMEOUT_MS}
                error={discoveryError}
                onSelect={handleSelectDevice}
                onDiscover={discoverDevices}
                onStopDiscovery={stopDiscovery}
              />
            </>
          )}

          {/* Casting View */}
          {currentView === 'casting' && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">📺</div>
              <p className="text-sm text-gray-900 font-medium mb-2">
                正在投屏到 {selectedDevice?.name || '设备'}
              </p>
              <p className="text-xs text-gray-500 mb-6">
                投屏会话已启动，播放控制将在后续阶段实现
              </p>
              <button
                onClick={handleBackToDetection}
                className="btn-secondary text-xs"
                type="button"
              >
                返回
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-[10px] text-gray-400 text-center border-t border-gray-100 pt-3">
          BeamIt v0.1.0
        </div>
      </section>
    </main>
  );
}

export default IndexPopup;
