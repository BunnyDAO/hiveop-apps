import { describe, expect, it } from 'vitest';
import { buildConfig, resolveSiteUrl, userAgentSuffix } from './appConfig';

describe('resolveSiteUrl', () => {
  it('defaults to the live site', () => {
    expect(resolveSiteUrl({})).toEqual({ url: 'https://app.hiveop.io/', origin: 'https://app.hiveop.io' });
  });
  it('HIVEOP_SITE_URL overrides (staging, dev)', () => {
    expect(resolveSiteUrl({ HIVEOP_SITE_URL: 'http://10.0.2.2:3000/' }).origin).toBe('http://10.0.2.2:3000');
  });
  it('ignores a malformed or non-http override', () => {
    for (const bad of ['nope', 'file:///x', 'javascript:1', '']) {
      expect(resolveSiteUrl({ HIVEOP_SITE_URL: bad }).origin).toBe('https://app.hiveop.io');
    }
  });
});

describe('userAgentSuffix', () => {
  it('is HiveOpApp/<version> (<platform>)', () => {
    expect(userAgentSuffix('1.2.3', 'ios')).toBe('HiveOpApp/1.2.3 (ios)');
    expect(userAgentSuffix('1.2.3', 'android')).toBe('HiveOpApp/1.2.3 (android)');
  });
});

describe('buildConfig', () => {
  const cfg = buildConfig({}, '0.1.0');
  it('identifies the app', () => {
    expect(cfg.appId).toBe('io.hiveop.app');
    expect(cfg.appName).toBe('HiveOp');
  });
  it('loads the site and shows the local offline page on failure', () => {
    expect(cfg.server?.url).toBe('https://app.hiveop.io/');
    expect(cfg.server?.errorPath).toBe('offline.html');
    expect(cfg.webDir).toBe('www');
  });
  it('keeps navigation to the nav policy in-app hosts', () => {
    expect(cfg.server?.allowNavigation).toEqual(['app.hiveop.io', 'api.hiveop.io', 'api.wenrwa.com']);
  });
  it('allows cleartext only when the override is plain http', () => {
    expect(cfg.server?.cleartext).toBe(false);
    const dev = buildConfig({ HIVEOP_SITE_URL: 'http://10.0.2.2:3000' }, '0.1.0');
    expect(dev.server?.cleartext).toBe(true);
    // the local offline page (https://localhost on Android) must be able to probe an http dev site
    expect(dev.android?.allowMixedContent).toBe(true);
    expect(cfg.android?.allowMixedContent).toBe(false);
  });
  it('appends the app user agent on both platforms', () => {
    expect(cfg.ios?.appendUserAgent).toBe('HiveOpApp/0.1.0 (ios)');
    expect(cfg.android?.appendUserAgent).toBe('HiveOpApp/0.1.0 (android)');
  });
  it('splash is HiveOp dark, hides itself when the page loads, no spinner', () => {
    const s = cfg.plugins?.SplashScreen as Record<string, unknown>;
    expect(s.backgroundColor).toBe('#0b0d12');
    expect(s.showSpinner).toBe(false);
    expect(cfg.backgroundColor).toBe('#0b0d12');
  });
  it('system bars use light icons over the dark app', () => {
    expect((cfg.plugins?.SystemBars as Record<string, unknown>).style).toBe('DARK');
  });
});
