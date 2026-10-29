import { describe, expect, it } from 'vitest';
import {
  compareVersions,
  isNewer,
  latestReleaseFeed,
  parseLatestRelease,
  updateMode,
  updatesEnabled,
  updateMenuItem,
  RELEASES_PAGE,
  CHECK_INTERVAL_MS,
} from './shellUpdater';

describe('compareVersions', () => {
  it('orders numerically, not lexically', () => {
    expect(compareVersions('0.10.0', '0.9.0')).toBe(1);
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('1.2.3', '1.3.0')).toBe(-1);
  });
  it('ignores a leading v and build metadata', () => {
    expect(compareVersions('v1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.0+abc', '1.0.0')).toBe(0);
  });
  it('treats a prerelease as older than its release', () => {
    expect(compareVersions('1.0.0-beta.1', '1.0.0')).toBe(-1);
    expect(compareVersions('1.0.0-beta.2', '1.0.0-beta.10')).toBe(-1);
    expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1);
    expect(compareVersions('1.0.0-1', '1.0.0-alpha')).toBe(-1);
  });
  it('pads missing parts', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
  });
  it('returns null for garbage', () => {
    expect(compareVersions('latest', '1.0.0')).toBeNull();
    expect(compareVersions('1.0.0', '')).toBeNull();
  });
  it('isNewer is false for garbage and equal', () => {
    expect(isNewer('0.2.0', '0.1.0')).toBe(true);
    expect(isNewer('0.1.0', '0.1.0')).toBe(false);
    expect(isNewer('nope', '0.1.0')).toBe(false);
  });
});

describe('parseLatestRelease', () => {
  it('reads tag and page from the GitHub latest-release json', () => {
    expect(parseLatestRelease({ tag_name: 'v0.2.0', html_url: 'https://github.com/BunnyDAO/hiveop-apps/releases/tag/v0.2.0' })).toEqual({
      version: '0.2.0',
      url: 'https://github.com/BunnyDAO/hiveop-apps/releases/tag/v0.2.0',
    });
  });
  it('falls back to the releases page for a missing or foreign url', () => {
    expect(parseLatestRelease({ tag_name: '0.2.0' })?.url).toBe(RELEASES_PAGE);
    expect(parseLatestRelease({ tag_name: '0.2.0', html_url: 'javascript:alert(1)' })?.url).toBe(RELEASES_PAGE);
  });
  it('rejects drafts, prereleases and junk', () => {
    expect(parseLatestRelease({ tag_name: 'v1.0.0', draft: true })).toBeNull();
    expect(parseLatestRelease({ tag_name: 'v1.0.0', prerelease: true })).toBeNull();
    expect(parseLatestRelease({ tag_name: 'banana' })).toBeNull();
    expect(parseLatestRelease(null)).toBeNull();
    expect(parseLatestRelease('x')).toBeNull();
  });
});

describe('updateMode', () => {
  const base = { packaged: true, platform: 'linux' as NodeJS.Platform, appImage: undefined as string | undefined };
  it('auto-updates Windows and AppImage', () => {
    expect(updateMode({ ...base, platform: 'win32' })).toBe('auto');
    expect(updateMode({ ...base, appImage: '/x/HiveOp.AppImage' })).toBe('auto');
  });
  it('only notifies on mac and deb', () => {
    expect(updateMode({ ...base, platform: 'darwin' })).toBe('notify');
    expect(updateMode(base)).toBe('notify');
  });
  it('does nothing unpackaged', () => {
    expect(updateMode({ ...base, packaged: false, platform: 'win32' })).toBe('off');
  });
});

describe('updatesEnabled', () => {
  it('is on normally and off in smoke', () => {
    expect(updatesEnabled({})).toEqual({ enabled: true });
    expect(updatesEnabled({ HIVEOP_SMOKE: '1' })).toEqual({ enabled: false });
  });
  it('smoke plus a feed url enables checks against that feed only', () => {
    expect(updatesEnabled({ HIVEOP_SMOKE: '1', HIVEOP_UPDATE_FEED: 'http://127.0.0.1:9/feed' })).toEqual({
      enabled: true,
      feed: 'http://127.0.0.1:9/feed',
    });
  });
  it('ignores a non-http feed', () => {
    expect(updatesEnabled({ HIVEOP_SMOKE: '1', HIVEOP_UPDATE_FEED: 'file:///etc/passwd' })).toEqual({ enabled: false });
  });
});

describe('latestReleaseFeed', () => {
  it('is the GitHub API by default and the override otherwise', () => {
    expect(latestReleaseFeed(undefined)).toBe('https://api.github.com/repos/BunnyDAO/hiveop-apps/releases/latest');
    expect(latestReleaseFeed('http://127.0.0.1:1/x')).toBe('http://127.0.0.1:1/x');
  });
});

describe('updateMenuItem', () => {
  it('shows nothing until something is found', () => {
    expect(updateMenuItem({ kind: 'idle' })).toBeNull();
  });
  it('offers a download for notify-only platforms', () => {
    expect(updateMenuItem({ kind: 'available', version: '0.2.0', url: 'u' })).toEqual({
      label: 'Update available — Download',
      action: 'open-release',
    });
  });
  it('offers restart once downloaded, and shows progress before', () => {
    expect(updateMenuItem({ kind: 'downloading', version: '0.2.0' })).toEqual({ label: 'Downloading update…', action: null });
    expect(updateMenuItem({ kind: 'ready', version: '0.2.0' })).toEqual({ label: 'Restart to update', action: 'restart' });
  });
});

it('checks daily', () => {
  expect(CHECK_INTERVAL_MS).toBe(24 * 60 * 60 * 1000);
});
