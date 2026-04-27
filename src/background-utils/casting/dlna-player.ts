// DLNA Player Controller
// Handles DLNA/UPnP AVTransport protocol for media playback

import { CastingDevice, VideoSource, CastingSession } from '@shared/types';
import { setCurrentSession, getCurrentSession, getDiscoveredDevices } from '@shared/storage';

export interface PlaybackState {
  isPlaying: boolean;
  position: number;
  duration: number;
  volume: number;
  mute: boolean;
}

const PLAYBACK_STATE: PlaybackState = {
  isPlaying: false,
  position: 0,
  duration: 0,
  volume: 100,
  mute: false
};

const AV_TRANSPORT_SERVICE = 'urn:schemas-upnp-org:service:AVTransport:1';
const RENDERING_CONTROL_SERVICE = 'urn:schemas-upnp-org:service:RenderingControl:1';

/** Default timeout (ms) for DLNA device HTTP requests */
const DLNA_REQUEST_TIMEOUT_MS = 8000;

/**
 * XML-escape special characters in a string value.
 */
function escapeXml(value: string): string {
  const amp = '&' + 'amp;';
  const lt = '&' + 'lt;';
  const gt = '&' + 'gt;';
  const quot = '&' + 'quot;';
  const apos = '&' + '#39;';
  return value
    .replace(/&/g, amp)
    .replace(/</g, lt)
    .replace(/>/g, gt)
    .replace(/"/g, quot)
    .replace(/'/g, apos);
}

/**
 * Derive the UPnP control endpoint path from a service URN.
 * E.g. "urn:schemas-upnp-org:service:AVTransport:1" -> "/upnp/control/avtransport"
 */
function getControlEndpoint(serviceUrn: string): string {
  const match = serviceUrn.match(/:service:(\w+):\d+$/);
  if (match) {
    return `/upnp/control/${match[1].toLowerCase()}`;
  }
  // Fallback: use the URN as-is (original behavior)
  return `/${serviceUrn}`;
}

/**
 * Create DLNA AVTransport SOAP request
 */
function createAVTransportSoap(action: string, args: Record<string, string>): string {
  const argsXml = Object.entries(args)
    .map(([key, value]) => `<${key}>${escapeXml(value)}</${key}>`)
    .join('');

  return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:${action} xmlns:u="${AV_TRANSPORT_SERVICE}">
      ${argsXml}
    </u:${action}>
  </s:Body>
</s:Envelope>`;
}

/**
 * Send HTTP request to DLNA device
 */
async function sendToDevice(
  device: CastingDevice,
  service: string,
  action: string,
  body: string,
  timeoutMs: number = DLNA_REQUEST_TIMEOUT_MS
): Promise<string> {
  const controlPath = getControlEndpoint(service);
  const url = `http://${device.address}:${device.port || 1900}${controlPath}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset="utf-8"',
        SOAPACTION: `"${service}#${action}"`
      },
      body,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`DLNA request failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

/**
 * Set the media URL on the DLNA device
 */
export async function setMediaUrl(
  device: CastingDevice,
  videoSource: VideoSource
): Promise<void> {
  const instanceId = '0';
  const metadata = `<?xml version="1.0"?>
<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">
  <item id="0" parentID="0" restricted="0">
    <dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">${escapeXml(videoSource.pageTitle || 'Video')}</dc:title>
    <upnp:class xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/">object.item.videoItem</upnp:class>
    <res protocolInfo="http-get:*:video/*:*">${escapeXml(videoSource.url)}</res>
  </item>
</DIDL-Lite>`;

  const soapBody = createAVTransportSoap('SetAVTransportURI', {
    InstanceID: instanceId,
    CurrentURI: videoSource.url,
    CurrentURIMetaData: metadata
  });

  await sendToDevice(device, AV_TRANSPORT_SERVICE, 'SetAVTransportURI', soapBody);
  console.log('[DLNAPlayer] Media URL set:', videoSource.url);
}

/**
 * Start playback on DLNA device
 */
export async function play(device: CastingDevice): Promise<void> {
  const soapBody = createAVTransportSoap('Play', {
    InstanceID: '0',
    Speed: '1'
  });

  await sendToDevice(device, AV_TRANSPORT_SERVICE, 'Play', soapBody);
  PLAYBACK_STATE.isPlaying = true;
  console.log('[DLNAPlayer] Playback started');
}

/**
 * Pause playback on DLNA device
 */
export async function pause(device: CastingDevice): Promise<void> {
  const soapBody = createAVTransportSoap('Pause', {
    InstanceID: '0'
  });

  await sendToDevice(device, AV_TRANSPORT_SERVICE, 'Pause', soapBody);
  PLAYBACK_STATE.isPlaying = false;
  console.log('[DLNAPlayer] Playback paused');
}

/**
 * Stop playback on DLNA device
 */
export async function stop(device: CastingDevice): Promise<void> {
  const soapBody = createAVTransportSoap('Stop', {
    InstanceID: '0'
  });

  await sendToDevice(device, AV_TRANSPORT_SERVICE, 'Stop', soapBody);
  PLAYBACK_STATE.isPlaying = false;
  PLAYBACK_STATE.position = 0;
  console.log('[DLNAPlayer] Playback stopped');
}

/**
 * Seek to position (in seconds)
 */
export async function seek(device: CastingDevice, position: number): Promise<void> {
  const soapBody = createAVTransportSoap('Seek', {
    InstanceID: '0',
    Unit: 'REL_TIME',
    Target: formatTime(position)
  });

  await sendToDevice(device, AV_TRANSPORT_SERVICE, 'Seek', soapBody);
  PLAYBACK_STATE.position = position;
  console.log('[DLNAPlayer] Seeked to:', position);
}

/**
 * Get current playback position
 */
export async function getPosition(device: CastingDevice): Promise<number> {
  const soapBody = createAVTransportSoap('GetPositionInfo', {
    InstanceID: '0'
  });

  const response = await sendToDevice(device, AV_TRANSPORT_SERVICE, 'GetPositionInfo', soapBody);

  // Parse position from response (support optional namespace prefix, e.g. <ns:RelTime>)
  const match = response.match(/<(?:[a-zA-Z0-9]+:)?RelTime>(\d+):(\d+):(\d+)<\/(?:[a-zA-Z0-9]+:)?RelTime>/);
  if (match) {
    const [, hours, minutes, seconds] = match;
    const position = parseInt(hours, 10) * 3600 + parseInt(minutes, 10) * 60 + parseInt(seconds, 10);
    PLAYBACK_STATE.position = position;
    return position;
  }

  return PLAYBACK_STATE.position;
}

/**
 * Get current playback state
 */
/**
 * Set volume on DLNA device via RenderingControl::SetVolume
 */
export async function setVolume(device: CastingDevice, volume: number): Promise<void> {
  const clampedVolume = Math.max(0, Math.min(100, Math.round(volume)));
  const soapBody = createAVTransportSoap('SetVolume', {
    InstanceID: '0',
    Channel: 'Master',
    DesiredVolume: String(clampedVolume)
  });

  await sendToDevice(device, RENDERING_CONTROL_SERVICE, 'SetVolume', soapBody);
  PLAYBACK_STATE.volume = clampedVolume;
  console.log('[DLNAPlayer] Volume set to:', clampedVolume);
}

export function getPlaybackState(): PlaybackState {
  return { ...PLAYBACK_STATE };
}

/**
 * Format seconds to HH:MM:SS
 */
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Start casting session
 */
export async function startCasting(
  device: CastingDevice,
  videoSource: VideoSource
): Promise<CastingSession> {
  const session: CastingSession = {
    id: crypto.randomUUID(),
    deviceId: device.id,
    videoSourceId: videoSource.id,
    status: 'connecting',
    startedAt: Date.now()
  };

  await setCurrentSession(session);

  try {
    // Set media URL
    await setMediaUrl(device, videoSource);

    // Start playback
    await play(device);

    // Update session status
    session.status = 'playing';
    await setCurrentSession(session);

    console.log('[DLNAPlayer] Casting started:', session.id);
    return session;
  } catch (error) {
    session.status = 'error';
    session.error = error instanceof Error ? error.message : 'Unknown error';
    await setCurrentSession(session);
    throw error;
  }
}

/**
 * Stop casting session
 */
export async function stopCasting(sessionId: string): Promise<void> {
  const session = await getCurrentSession();

  if (!session || session.id !== sessionId) {
    console.warn('[DLNAPlayer] Session not found or mismatch:', sessionId);
    return;
  }

  try {
    // Look up the device from discovered devices by session.deviceId
    const devices = await getDiscoveredDevices();
    const device = devices.find((d) => d.id === session.deviceId);

    if (device) {
      // Send Stop SOAP command to the device before updating local state
      await stop(device);
    } else {
      console.warn('[DLNAPlayer] Device not found for session, stopping locally only:', session.deviceId);
    }

    session.status = 'stopped';
    session.endedAt = Date.now();
    await setCurrentSession(session);

    PLAYBACK_STATE.isPlaying = false;
    PLAYBACK_STATE.position = 0;

    console.log('[DLNAPlayer] Casting stopped:', sessionId);
  } catch (error) {
    console.error('[DLNAPlayer] Error stopping casting:', error);
    throw error;
  }
}

export default {
  setMediaUrl,
  play,
  pause,
  stop,
  seek,
  getPosition,
  getPlaybackState,
  startCasting,
  stopCasting,
  setVolume
};
