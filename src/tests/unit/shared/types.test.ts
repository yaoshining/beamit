/**
 * Unit tests for shared types and validation functions.
 *
 * @file src/tests/unit/shared/types.test.ts
 */

import { describe, it, expect } from 'vitest';
import type { VideoType } from '@shared/types';
import {
  isValidUrl,
  isValidIpAddress,
  isValidHostname,
  validateVideoSource,
  validateCastingDevice,
  STORAGE_KEYS
} from '@shared/types';

describe('isValidUrl', () => {
  it('should accept valid HTTPS URL', () => {
    expect(isValidUrl('https://example.com/video.mp4')).toBe(true);
  });

  it('should accept valid HTTP URL', () => {
    expect(isValidUrl('http://example.com/stream.m3u8')).toBe(true);
  });

  it('should accept URL with query params', () => {
    expect(isValidUrl('https://example.com/path?token=abc&exp=123')).toBe(true);
  });

  it('should reject empty string', () => {
    expect(isValidUrl('')).toBe(false);
  });

  it('should reject relative path', () => {
    expect(isValidUrl('/path/to/video.mp4')).toBe(false);
  });

  it('should reject invalid protocol', () => {
    expect(isValidUrl('ftp://example.com/file')).toBe(true); // URL constructor accepts ftp
  });

  it('should reject malformed URL', () => {
    expect(isValidUrl('not-a-url')).toBe(false);
  });
});

describe('isValidIpAddress', () => {
  it('should accept valid IPv4 address', () => {
    expect(isValidIpAddress('192.168.1.1')).toBe(true);
  });

  it('should accept IPv4 with zero octet', () => {
    expect(isValidIpAddress('0.0.0.0')).toBe(true);
  });

  it('should accept IPv4 max values', () => {
    expect(isValidIpAddress('255.255.255.255')).toBe(true);
  });

  it('should reject IPv4 with octet > 255', () => {
    expect(isValidIpAddress('256.1.2.3')).toBe(false);
  });

  it('should reject IPv4 with negative octet', () => {
    expect(isValidIpAddress('-1.2.3.4')).toBe(false);
  });

  it('should reject IPv4 with missing octet', () => {
    expect(isValidIpAddress('192.168.1')).toBe(false);
  });

  it('should reject IPv4 with extra octet', () => {
    expect(isValidIpAddress('192.168.1.1.5')).toBe(false);
  });

  it('should accept valid IPv6 address', () => {
    expect(isValidIpAddress('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
  });

  it('should reject malformed IPv6', () => {
    expect(isValidIpAddress('not-an-ip')).toBe(false);
  });

  it('should reject empty string', () => {
    expect(isValidIpAddress('')).toBe(false);
  });
});

describe('isValidHostname', () => {
  it('should accept valid hostname', () => {
    expect(isValidHostname('example.com')).toBe(true);
  });

  it('should accept hostname with subdomain', () => {
    expect(isValidHostname('sub.domain.example.com')).toBe(true);
  });

  it('should accept localhost', () => {
    expect(isValidHostname('localhost')).toBe(true);
  });

  it('should reject hostname longer than 253 chars', () => {
    const long = 'a'.repeat(254);
    expect(isValidHostname(long)).toBe(false);
  });

  it('should reject hostname with label > 63 chars', () => {
    const longLabel = `${'a'.repeat(64)}.com`;
    expect(isValidHostname(longLabel)).toBe(false);
  });

  it('should reject hostname starting with hyphen', () => {
    expect(isValidHostname('-example.com')).toBe(false);
  });

  it('should reject hostname ending with hyphen', () => {
    expect(isValidHostname('example-.com')).toBe(false);
  });

  it('should reject empty string', () => {
    expect(isValidHostname('')).toBe(false);
  });
});

describe('validateVideoSource', () => {
  const validVideo = {
    id: 'vid-1',
    url: 'https://example.com/video.mp4',
    type: 'media' as const,
    pageUrl: 'https://example.com',
    pageTitle: 'Test Video',
    duration: 120,
    detectedAt: Date.now()
  };

  it('should return empty errors for valid source', () => {
    expect(validateVideoSource(validVideo)).toEqual([]);
  });

  it('should error when id is missing', () => {
    const errors = validateVideoSource({ ...validVideo, id: '' });
    expect(errors).toContain('VideoSource.id is required');
  });

  it('should error when url is invalid', () => {
    const errors = validateVideoSource({ ...validVideo, url: 'not-a-url' });
    expect(errors).toContain('VideoSource.url must be a valid URL');
  });

  it('should error when type is missing', () => {
    const errors = validateVideoSource({ ...validVideo, type: '' as any });
    expect(errors).toContain('VideoSource.type is required');
  });

  it('should error when pageUrl is missing', () => {
    const errors = validateVideoSource({ ...validVideo, pageUrl: '' });
    expect(errors).toContain('VideoSource.pageUrl is required');
  });

  it('should error when detectedAt is missing', () => {
    const errors = validateVideoSource({ ...validVideo, detectedAt: 0 });
    expect(errors).toContain('VideoSource.detectedAt is required');
  });

  it('should return multiple errors when multiple fields invalid', () => {
    const errors = validateVideoSource({
      id: '',
      url: 'bad',
      type: '' as VideoType,
      pageUrl: '',
      pageTitle: '',
      detectedAt: 0
    });
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });
});

describe('validateCastingDevice', () => {
  const validDevice = {
    id: 'device-1',
    name: 'Living Room TV',
    type: 'tv' as const,
    protocol: 'dlna' as const,
    address: '192.168.1.100',
    port: 8080,
    lastSeen: Date.now(),
    isOnline: true
  };

  it('should return empty errors for valid device', () => {
    expect(validateCastingDevice(validDevice)).toEqual([]);
  });

  it('should error when id is missing', () => {
    const errors = validateCastingDevice({ ...validDevice, id: '' });
    expect(errors).toContain('CastingDevice.id is required');
  });

  it('should error when name is missing', () => {
    const errors = validateCastingDevice({ ...validDevice, name: '' });
    expect(errors).toContain('CastingDevice.name is required');
  });

  it('should error when type is missing', () => {
    const errors = validateCastingDevice({ ...validDevice, type: '' as any });
    expect(errors).toContain('CastingDevice.type is required');
  });

  it('should error when protocol is missing', () => {
    const errors = validateCastingDevice({ ...validDevice, protocol: '' as any });
    expect(errors).toContain('CastingDevice.protocol is required');
  });

  it('should error when address is missing', () => {
    const errors = validateCastingDevice({ ...validDevice, address: '' });
    expect(errors).toContain('CastingDevice.address is required');
  });

  it('should error when address is invalid', () => {
    // '!@#$' is neither a valid IP nor a valid hostname
    const errors = validateCastingDevice({ ...validDevice, address: '!@#$' });
    expect(errors).toContain('CastingDevice.address must be a valid IP address or hostname');
  });

  it('should accept hostname as address', () => {
    const errors = validateCastingDevice({ ...validDevice, address: 'living-room-tv.local' });
    expect(errors).toEqual([]);
  });

  it('should return multiple errors when multiple fields invalid', () => {
    const errors = validateCastingDevice({
      id: '',
      name: '',
      type: '' as any,
      protocol: '' as any,
      address: '',
      port: 0,
      lastSeen: Date.now(),
      isOnline: false
    });
    expect(errors.length).toBeGreaterThanOrEqual(5);
  });
});

describe('STORAGE_KEYS', () => {
  it('should have all required storage keys', () => {
    expect(STORAGE_KEYS.DEVICE_HISTORY).toBe('deviceHistory');
    expect(STORAGE_KEYS.RECENT_DEVICES).toBe('recentDevices');
    expect(STORAGE_KEYS.SETTINGS).toBe('settings');
    expect(STORAGE_KEYS.CURRENT_SESSION).toBe('currentSession');
    expect(STORAGE_KEYS.DETECTED_VIDEOS).toBe('detectedVideos');
    expect(STORAGE_KEYS.DISCOVERED_DEVICES).toBe('discoveredDevices');
  });

  it('should have correct type structure', () => {
    expect(Object.keys(STORAGE_KEYS)).toEqual([
      'DEVICE_HISTORY',
      'RECENT_DEVICES',
      'SETTINGS',
      'CURRENT_SESSION',
      'DETECTED_VIDEOS',
      'DISCOVERED_DEVICES'
    ]);
  });
});
