// Video Types
export type VideoType = 'media' | 'hls' | 'dash' | 'iframe';

// Device Types
export type DeviceType = 'tv' | 'receiver' | 'speaker' | 'other';

// Protocol Types
export type Protocol = 'dlna';

// Session Status
export type SessionStatus = 'connecting' | 'playing' | 'paused' | 'stopped' | 'error';

// Video Source Entity
export interface VideoSource {
  id: string;
  url: string;
  type: VideoType;
  pageUrl: string;
  pageTitle?: string;
  duration?: number;
  mimeType?: string;
  detectedAt: number;
}

// Casting Device Entity
export interface CastingDevice {
  id: string;
  name: string;
  type: DeviceType;
  protocol: Protocol;
  address: string;
  port?: number;
  isOnline: boolean;
  lastSeen: number;
}

// Casting Session Entity
export interface CastingSession {
  id: string;
  deviceId: string;
  videoSourceId: string;
  status: SessionStatus;
  startedAt: number;
  endedAt?: number;
  error?: string;
}

// Device History Entity
export interface DeviceHistory {
  deviceId: string;
  lastUsed: number;
  useCount: number;
}

// Storage Keys
export const STORAGE_KEYS = {
  DEVICE_HISTORY: 'deviceHistory',
  RECENT_DEVICES: 'recentDevices',
  SETTINGS: 'settings',
  CURRENT_SESSION: 'currentSession',
  DETECTED_VIDEOS: 'detectedVideos',
  DISCOVERED_DEVICES: 'discoveredDevices'
} as const;

// Message Types for Content ↔ Background Communication
export type MessageType = 
  | 'DETECT_VIDEOS' 
  | 'VIDEOS_DETECTED' 
  | 'DISCOVER_DEVICES' 
  | 'DEVICES_DISCOVERED'
  | 'START_CASTING'
  | 'STOP_CASTING'
  | 'CASTING_STATUS'
  | 'ERROR';

export type ExtensionMessage =
  | { type: 'DETECT_VIDEOS'; tabId?: number }
  | { type: 'VIDEOS_DETECTED'; payload: DetectionResult; tabId?: number }
  | { type: 'DISCOVER_DEVICES'; tabId?: number }
  | { type: 'DEVICES_DISCOVERED'; payload: DiscoveryResult; tabId?: number }
  | { type: 'START_CASTING'; payload: CastingRequest; tabId?: number }
  | { type: 'STOP_CASTING'; payload?: { sessionId: string }; tabId?: number }
  | { type: 'CASTING_STATUS'; payload: CastingResponse; tabId?: number }
  | { type: 'ERROR'; payload: { message: string }; tabId?: number };

// Detection Result
export interface DetectionResult {
  success: boolean;
  videos: VideoSource[];
  error?: string;
}

// Device Discovery Result
export interface DiscoveryResult {
  success: boolean;
  devices: CastingDevice[];
  error?: string;
}

// Casting Request
export interface CastingRequest {
  deviceId: string;
  videoSource: VideoSource;
}

// Casting Response
export interface CastingResponse {
  success: boolean;
  sessionId?: string;
  error?: string;
}

// Validation Functions
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isValidIpAddress(ip: string): boolean {
  // IPv4: validate each octet is 0-255
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipv4Match = ip.match(ipv4Regex);
  if (ipv4Match) {
    const octets = [ipv4Match[1], ipv4Match[2], ipv4Match[3], ipv4Match[4]].map(Number);
    return octets.every(octet => octet >= 0 && octet <= 255);
  }

  // IPv6
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv6Regex.test(ip);
}

export function validateVideoSource(video: VideoSource): string[] {
  const errors: string[] = [];
  
  if (!video.id) errors.push('VideoSource.id is required');
  if (!isValidUrl(video.url)) errors.push('VideoSource.url must be a valid URL');
  if (!video.type) errors.push('VideoSource.type is required');
  if (!video.pageUrl) errors.push('VideoSource.pageUrl is required');
  if (!video.detectedAt) errors.push('VideoSource.detectedAt is required');
  
  return errors;
}

/**
 * Validate a hostname string.
 * Allows alphanumeric characters, hyphens, and dots.
 * Each label must not start or end with a hyphen.
 */
export function isValidHostname(hostname: string): boolean {
  if (hostname.length > 253) return false;

  const labels = hostname.split('.');
  if (labels.length === 0) return false;

  const labelRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
  return labels.every(label => label.length > 0 && label.length <= 63 && labelRegex.test(label));
}

export function validateCastingDevice(device: CastingDevice): string[] {
  const errors: string[] = [];
  
  if (!device.id) errors.push('CastingDevice.id is required');
  if (!device.name) errors.push('CastingDevice.name is required');
  if (!device.type) errors.push('CastingDevice.type is required');
  if (!device.protocol) errors.push('CastingDevice.protocol is required');
  if (!device.address) errors.push('CastingDevice.address is required');
  if (device.address && !isValidIpAddress(device.address) && !isValidHostname(device.address)) {
    errors.push('CastingDevice.address must be a valid IP address or hostname');
  }
  
  return errors;
}