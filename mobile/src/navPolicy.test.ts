import { describe, expect, it } from 'vitest';
import { decide, inAppHosts, type Decision } from './navPolicy';

const ctx = { siteOrigin: 'https://app.hiveop.io' };

const table: Array<[string, string, Decision]> = [
  ['site root', 'https://app.hiveop.io/', 'in-app'],
  ['site deep path + query', 'https://app.hiveop.io/w/abc?x=1#h', 'in-app'],
  ['backend api.hiveop.io', 'https://api.hiveop.io/auth/email/verify', 'in-app'],
  ['backend api.wenrwa.com', 'https://api.wenrwa.com/auth/email/verify', 'in-app'],
  ['hiveop deep link', 'hiveop://auth?handoff=1', 'in-app'],
  ['lookalike suffix host', 'https://app.hiveop.io.evil.com/', 'system-browser'],
  ['lookalike prefix host', 'https://evilapp.hiveop.io/', 'system-browser'],
  ['site on other port', 'https://app.hiveop.io:8443/', 'system-browser'],
  ['site over http', 'http://app.hiveop.io/', 'system-browser'],
  ['http api host (not https)', 'http://api.hiveop.io/x', 'system-browser'],
  ['userinfo trick', 'https://app.hiveop.io@evil.com/', 'system-browser'],
  ['random https', 'https://example.com/', 'system-browser'],
  ['javascript:', 'javascript:alert(1)', 'deny'],
  ['file:', 'file:///etc/passwd', 'deny'],
  ['data:', 'data:text/html,hi', 'deny'],
  ['intent:', 'intent://x#Intent;scheme=http;end', 'deny'],
  ['tel:', 'tel:+15555555555', 'deny'],
  ['garbage', 'not a url', 'deny'],
  ['empty', '', 'deny'],
];

describe('decide', () => {
  it.each(table)('%s', (_name, url, want) => {
    expect(decide(url, ctx)).toBe(want);
  });

  it('a dev/staging site origin is in-app (override)', () => {
    expect(decide('http://localhost:3000/x', { siteOrigin: 'http://localhost:3000' })).toBe('in-app');
    expect(decide('https://app.hiveop.io/', { siteOrigin: 'http://localhost:3000' })).toBe('system-browser');
  });
});

describe('inAppHosts', () => {
  it('lists the site host plus the backend auth chain, for native allow-lists', () => {
    expect(inAppHosts(ctx)).toEqual(['app.hiveop.io', 'api.hiveop.io', 'api.wenrwa.com']);
  });
});
