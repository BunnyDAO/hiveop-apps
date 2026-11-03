import { describe, expect, it } from 'vitest';
import { decide, inAppHosts, type Decision } from './navPolicy';

const ctx = { siteOrigin: 'https://app.hiveop.io' };

const table: Array<[string, string, Decision]> = [
  ['site root', 'https://app.hiveop.io/', 'in-app'],
  ['site deep path + query', 'https://app.hiveop.io/w/abc?x=1#h', 'in-app'],
  ['backend api.hiveop.io', 'https://api.hiveop.io/auth/email/verify', 'in-app'],
  ['backend api.wenrwa.com', 'https://api.wenrwa.com/auth/email/verify', 'in-app'],
  ['hiveop deep link', 'hiveop://auth?handoff=1', 'in-app'],
  ['lookalike suffix host', 'https://app.hiveop.io.evil.com/', 'sheet'],
  ['lookalike prefix host', 'https://evilapp.hiveop.io/', 'sheet'],
  ['site on other port', 'https://app.hiveop.io:8443/', 'sheet'],
  ['site over http', 'http://app.hiveop.io/', 'sheet'],
  ['http api host (not https)', 'http://api.hiveop.io/x', 'sheet'],
  ['userinfo trick', 'https://app.hiveop.io@evil.com/', 'sheet'],
  ['random https', 'https://example.com/', 'sheet'],
  ['GitHub App install', 'https://github.com/apps/hiveop/installations/new?state=abc', 'sheet'],
  ['GitHub install, settings', 'https://github.com/settings/installations/123', 'sheet'],
  ['Stripe billing portal', 'https://billing.stripe.com/p/session/live_abc', 'sheet'],
  ['docs', 'https://docs.hiveop.io/start', 'sheet'],
  ['marketing site', 'https://hiveop.io/', 'sheet'],
  ['about:blank', 'about:blank', 'deny'],
  ['blob:', 'blob:https://app.hiveop.io/uuid', 'deny'],
  ['mailto:', 'mailto:a@b.co', 'deny'],
  ['sms:', 'sms:+1555', 'deny'],
  ['vbscript:', 'vbscript:x', 'deny'],
  ['custom scheme', 'myapp://x', 'deny'],
  ['ftp:', 'ftp://example.com/x', 'deny'],
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

  it('a link-out intent sends outside http(s) to the system browser', () => {
    expect(decide('https://example.com/checkout', { ...ctx, linkOut: true })).toBe('system-browser');
    expect(decide('https://app.hiveop.io/x', { ...ctx, linkOut: true })).toBe('in-app');
    expect(decide('javascript:1', { ...ctx, linkOut: true })).toBe('deny');
  });

  it('a dev/staging site origin is in-app (override)', () => {
    expect(decide('http://localhost:3000/x', { siteOrigin: 'http://localhost:3000' })).toBe('in-app');
    expect(decide('https://app.hiveop.io/', { siteOrigin: 'http://localhost:3000' })).toBe('sheet');
  });
});

describe('inAppHosts', () => {
  it('lists the site host plus the backend auth chain, for native allow-lists', () => {
    expect(inAppHosts(ctx)).toEqual(['app.hiveop.io', 'api.hiveop.io', 'api.wenrwa.com']);
  });
});
