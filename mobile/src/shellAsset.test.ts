import { describe, expect, it } from 'vitest';
import { buildShellAsset } from './shellAsset';
import { vm } from './testVm';

describe('buildShellAsset', () => {
  const a = buildShellAsset({}, '0.1.0');
  it('carries the site origin and in-app auth hosts for the native policy', () => {
    expect(a.siteOrigin).toBe('https://app.hiveop.io');
    expect(a.authHosts).toEqual(['api.hiveop.io', 'api.wenrwa.com']);
  });
  it('follows HIVEOP_SITE_URL', () => {
    expect(buildShellAsset({ HIVEOP_SITE_URL: 'http://localhost:3000/x' }, '1').siteOrigin).toBe('http://localhost:3000');
  });
  it('has one bridge script per platform, active only on the site origin', () => {
    expect((vm(a.bridgeScripts.ios, a.siteOrigin) as any).hiveopApp.platform).toBe('ios');
    expect((vm(a.bridgeScripts.android, a.siteOrigin) as any).hiveopApp.platform).toBe('android');
    expect('hiveopApp' in vm(a.bridgeScripts.ios, 'https://github.com')).toBe(false);
  });
});
