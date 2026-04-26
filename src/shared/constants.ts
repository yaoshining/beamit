// DLNA/SSDP Constants
export const DLNA_CONSTANTS = {
  SSDP_MULTICAST_ADDRESS: '239.255.255.250',
  SSDP_PORT: 1900,
  SSDP_ST: 'urn:schemas-upnp-org:device:MediaRenderer:1',
  SSDP_MSEARCH: [
    'M-SEARCH * HTTP/1.1',
    'HOST: 239.255.255.250:1900',
    'MAN: "ssdp:discover"',
    'MX: 3',
    'ST: urn:schemas-upnp-org:device:MediaRenderer:1'
  ].join('\r\n'),
  SSDP_RESPONSE_MATCH: 'HTTP/1.1 200 OK',
  DEVICE_DISCOVERY_TIMEOUT: 5000,
  DEVICE_CACHE_DURATION: 300000 // 5 minutes
} as const;

// Storage Constants
export const STORAGE_CONSTANTS = {
  MAX_RECENT_DEVICES: 10,
  SESSION_STORAGE_KEY: 'castingSession',
  VIDEO_CACHE_DURATION: 60000 // 1 minute
} as const;

// UI Constants
export const UI_CONSTANTS = {
  POPUP_WIDTH: 400,
  POPUP_HEIGHT: 600,
  ANIMATION_DURATION: 200,
  TOAST_DURATION: 3000,
  LOADING_TIMEOUT: 10000
} as const;

// Video Detection Patterns
export const VIDEO_PATTERNS = {
  HLS_MANIFEST: /\.m3u8(?:\?.*)?$/i,
  DASH_MANIFEST: /\.mpd(?:\?.*)?$/i,
  VIDEO_EXTENSIONS: /\.(mp4|webm|flv|mov|avi|mkv)(?:\?.*)?$/i,
  VIDEO_TYPES: ['video/mp4', 'video/webm', 'video/x-flv', 'application/x-mpegURL', 'application/dash+xml'],
  IFRAME_VIDEO_DOMAINS: [
    'youtube.com',
    'youtu.be',
    'vimeo.com',
    'dailymotion.com',
    'twitch.tv'
  ]
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NO_VIDEO_FOUND: '未检测到可投屏的视频',
  DEVICE_NOT_FOUND: '未找到可用的投屏设备',
  DEVICE_OFFLINE: '设备已离线',
  CASTING_FAILED: '投屏失败，请重试',
  NETWORK_ERROR: '网络错误，请检查网络连接',
  TIMEOUT: '操作超时，请重试',
  UNKNOWN_ERROR: '发生未知错误'
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  VIDEO_DETECTED: '已检测到 {count} 个视频',
  DEVICES_FOUND: '已发现 {count} 个设备',
  CASTING_STARTED: '正在投屏到 {device}',
  CASTING_STOPPED: '已停止投屏'
} as const;

// Device Display Names
export const DEVICE_TYPE_NAMES = {
  tv: '电视',
  receiver: 'AV 接收器',
  speaker: '音箱',
  other: '设备'
} as const;