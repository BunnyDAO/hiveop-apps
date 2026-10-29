import { describe, expect, it } from 'vitest';
import { decide, type Decision } from './navPolicy';

const ctx = { siteOrigin: 'https://app.hiveop.io' };

const table: Array<[string, string, Decision]> = [
  ['site root', 'https://app.hiveop.io/', 'in-window'],
  ['site deep path + query', 'https://app.hiveop.io/w/abc?x=1#h', 'in-window'],
  ['backend api.hiveop.io', 'https://api.hiveop.io/auth/github/callback?code=1', 'in-window'],
  ['backend api.wenrwa.com', 'https://api.wenrwa.com/auth/email/verify', 'in-window'],
  ['github oauth authorize', 'https://github.com/login/oauth/authorize?client_id=x', 'in-window'],
  ['github login (non-oauth)', 'https://github.com/login', 'system-browser'],
  ['github repo link', 'https://github.com/BunnyDAO/Wenrwa-Hive', 'system-browser'],
  ['google accounts', 'https://accounts.google.com/o/oauth2/v2/auth?x=1', 'system-browser'],
  ['stripe checkout', 'https://checkout.stripe.com/c/pay/cs_1', 'app-popup'],
  ['stripe portal', 'https://billing.stripe.com/p/session/x', 'app-popup'],
  ['github app install', 'https://github.com/apps/hiveop/installations/new', 'app-popup'],
  ['github app install select', 'https://github.com/apps/hiveop/installations/select_target', 'app-popup'],
  ['github apps page w/o installations', 'https://github.com/apps/hiveop', 'system-browser'],
  ['random https', 'https://example.com/', 'system-browser'],
  ['plain http elsewhere', 'http://example.com/', 'system-browser'],
  ['http api host (not https)', 'http://api.hiveop.io/x', 'system-browser'],
  ['lookalike suffix host', 'https://app.hiveop.io.evil.com/', 'system-browser'],
  ['lookalike prefix host', 'https://evilapp.hiveop.io/', 'system-browser'],
  ['site on other port', 'https://app.hiveop.io:8443/', 'system-browser'],
  ['site over http', 'http://app.hiveop.io/', 'system-browser'],
  ['userinfo trick', 'https://app.hiveop.io@evil.com/', 'system-browser'],
  ['hiveop deep link', 'hiveop://auth?t=1', 'in-window'],
  ['javascript:', 'javascript:alert(1)', 'deny'],
  ['file:', 'file:///etc/passwd', 'deny'],
  ['data:', 'data:text/html,<b>x</b>', 'deny'],
  ['about:blank', 'about:blank', 'deny'],
  ['mailto:', 'mailto:a@b.c', 'deny'],
  ['custom scheme', 'vscode://open', 'deny'],
  ['garbage', 'not a url', 'deny'],
  ['empty', '', 'deny'],
];

describe('decide', () => {
  it.each(table)('%s', (_n, url, want) => {
    expect(decide(url, ctx)).toBe(want);
  });

  it('honours a localhost site origin', () => {
    const dev = { siteOrigin: 'http://localhost:3000' };
    expect(decide('http://localhost:3000/w/1', dev)).toBe('in-window');
    expect(decide('http://localhost:3001/', dev)).toBe('system-browser');
    expect(decide('https://app.hiveop.io/', dev)).toBe('system-browser');
    expect(decide('https://api.hiveop.io/x', dev)).toBe('in-window');
  });
});
