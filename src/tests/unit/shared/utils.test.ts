/**
 * Unit tests for shared utility functions.
 *
 * @file src/tests/unit/shared/utils.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateUUID,
  formatDuration,
  debounce,
  throttle,
  extractDomain,
  isVideoUrl,
  parseQueryString,
  sleep,
  safeJsonParse,
  isExtensionContext,
  formatRelativeTime
} from '@shared/utils';

describe('generateUUID', () => {
  it('should generate a UUID v4 string', () => {
    const uuid = generateUUID();
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it('should generate unique UUIDs', () => {
    const uuids = new Set(Array.from({ length: 100 }, () => generateUUID()));
    expect(uuids.size).toBe(100);
  });
});

describe('formatDuration', () => {
  it('should format seconds to MM:SS', () => {
    expect(formatDuration(125)).toBe('2:05');
  });

  it('should format zero seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
  });

  it('should format single minute', () => {
    expect(formatDuration(60)).toBe('1:00');
  });

  it('should format hours to HH:MM:SS', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
  });

  it('should format multiple hours', () => {
    expect(formatDuration(7200)).toBe('2:00:00');
  });

  it('should pad minutes and seconds correctly', () => {
    expect(formatDuration(5)).toBe('0:05');
  });
});

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should debounce function calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced();
    debounced();

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should pass arguments to debounced function', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('arg1', 'arg2');
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('should reset timer on subsequent calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(50);
    debounced(); // reset timer
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should throttle function calls', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    expect(fn).toHaveBeenCalledTimes(1);

    throttled();
    expect(fn).toHaveBeenCalledTimes(1); // should be ignored

    vi.advanceTimersByTime(100);
    throttled();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should pass arguments to throttled function', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled('test');
    expect(fn).toHaveBeenCalledWith('test');
  });
});

describe('extractDomain', () => {
  it('should extract hostname from HTTPS URL', () => {
    expect(extractDomain('https://www.example.com/path')).toBe('www.example.com');
  });

  it('should extract hostname from HTTP URL', () => {
    expect(extractDomain('http://example.com:8080/path')).toBe('example.com');
  });

  it('should handle URL with subdomain', () => {
    expect(extractDomain('https://sub.domain.example.com/video')).toBe('sub.domain.example.com');
  });

  it('should return empty string for invalid URL', () => {
    expect(extractDomain('not-a-url')).toBe('');
  });

  it('should return empty string for empty string', () => {
    expect(extractDomain('')).toBe('');
  });
});

describe('isVideoUrl', () => {
  it('should detect .mp4 URL', () => {
    expect(isVideoUrl('https://example.com/video.mp4')).toBe(true);
  });

  it('should detect .webm URL', () => {
    expect(isVideoUrl('https://example.com/video.webm')).toBe(true);
  });

  it('should detect .m3u8 URL', () => {
    expect(isVideoUrl('https://example.com/stream.m3u8')).toBe(true);
  });

  it('should detect .mpd URL', () => {
    expect(isVideoUrl('https://example.com/manifest.mpd')).toBe(true);
  });

  it('should detect video URL with query params', () => {
    expect(isVideoUrl('https://example.com/video.mp4?token=abc')).toBe(true);
  });

  it('should return false for non-video URL', () => {
    expect(isVideoUrl('https://example.com/page.html')).toBe(false);
  });

  it('should return false for invalid URL', () => {
    expect(isVideoUrl('not-a-url')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isVideoUrl('')).toBe(false);
  });
});

describe('parseQueryString', () => {
  it('should parse query parameters', () => {
    const params = parseQueryString('https://example.com?foo=bar&baz=qux');
    expect(params).toEqual({ foo: 'bar', baz: 'qux' });
  });

  it('should return empty object for URL without query', () => {
    const params = parseQueryString('https://example.com');
    expect(params).toEqual({});
  });

  it('should handle multiple values with same key', () => {
    const params = parseQueryString('https://example.com?key=a&key=b');
    expect(params).toEqual({ key: 'b' }); // URLSearchParams keeps last value
  });

  it('should return empty object for invalid URL', () => {
    expect(parseQueryString('not-a-url')).toEqual({});
  });

  it('should decode encoded values', () => {
    const params = parseQueryString('https://example.com?q=hello%20world');
    expect(params).toEqual({ q: 'hello world' });
  });
});

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should resolve after specified time', async () => {
    const promise = sleep(100);
    
    vi.advanceTimersByTime(100);
    await expect(promise).resolves.toBeUndefined();
  });
});

describe('safeJsonParse', () => {
  it('should parse valid JSON', () => {
    expect(safeJsonParse('{"key":"value"}', {})).toEqual({ key: 'value' });
  });

  it('should parse JSON array', () => {
    expect(safeJsonParse('[1,2,3]', [])).toEqual([1, 2, 3]);
  });

  it('should return fallback for invalid JSON', () => {
    expect(safeJsonParse('not-json', { default: true })).toEqual({ default: true });
  });

  it('should return fallback for empty string', () => {
    expect(safeJsonParse('', null)).toBeNull();
  });

  it('should parse primitive values', () => {
    expect(safeJsonParse('42', 0)).toBe(42);
    expect(safeJsonParse('true', false)).toBe(true);
  });
});

describe('isExtensionContext', () => {
  beforeEach(() => {
    // Save original chrome
    (globalThis as any).__originalChrome = globalThis.chrome;
  });

  afterEach(() => {
    // Restore original chrome
    (globalThis as any).chrome = (globalThis as any).__originalChrome;
    delete (globalThis as any).__originalChrome;
  });

  it('should return true when chrome.runtime exists', () => {
    (globalThis as any).chrome = {
      runtime: { id: 'test-extension-id' }
    };
    expect(isExtensionContext()).toBe(true);
  });

  it('should return false when chrome is undefined', () => {
    (globalThis as any).chrome = undefined;
    expect(isExtensionContext()).toBe(false);
  });

  it('should return false when chrome.runtime is undefined', () => {
    (globalThis as any).chrome = {};
    expect(isExtensionContext()).toBe(false);
  });

  it('should return false when chrome.runtime.id is undefined', () => {
    (globalThis as any).chrome = { runtime: {} };
    expect(isExtensionContext()).toBe(false);
  });
});

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-27T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "刚刚" for recent timestamps', () => {
    expect(formatRelativeTime(Date.now())).toBe('刚刚');
  });

  it('should return minutes ago', () => {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    expect(formatRelativeTime(fiveMinAgo)).toBe('5分钟前');
  });

  it('should return hours ago', () => {
    const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
    expect(formatRelativeTime(threeHoursAgo)).toBe('3小时前');
  });

  it('should return days ago', () => {
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
    expect(formatRelativeTime(twoDaysAgo)).toBe('2天前');
  });

  it('should handle exact boundaries', () => {
    const oneMinAgo = Date.now() - 60 * 1000;
    expect(formatRelativeTime(oneMinAgo)).toBe('1分钟前');
  });
});
