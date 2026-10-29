import { describe, expect, it } from 'vitest';
import { resolveSiteUrl, userAgentFor } from './site';

describe('resolveSiteUrl', () => {
  it('defaults to the live site', () => {
    expect(resolveSiteUrl({})).toEqual({ url: 'https://app.hiveop.io/', origin: 'https://app.hiveop.io' });
  });
  it('accepts an override', () => {
    expect(resolveSiteUrl({ HIVEOP_SITE_URL: 'http://localhost:3000' })).toEqual({ url: 'http://localhost:3000/', origin: 'http://localhost:3000' });
  });
  it('ignores empty or non-http overrides', () => {
    expect(resolveSiteUrl({ HIVEOP_SITE_URL: '' }).origin).toBe('https://app.hiveop.io');
    expect(resolveSiteUrl({ HIVEOP_SITE_URL: 'file:///x' }).origin).toBe('https://app.hiveop.io');
    expect(resolveSiteUrl({ HIVEOP_SITE_URL: 'nope' }).origin).toBe('https://app.hiveop.io');
  });
});

describe('userAgentFor', () => {
  it('appends the shell token', () => {
    expect(userAgentFor('Mozilla/5.0 Chrome/1', '0.1.0')).toBe('Mozilla/5.0 Chrome/1 HiveOpDesktop/0.1.0');
  });
});
