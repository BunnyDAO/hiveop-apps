import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { challengeFor, createAuthBounce, parseAuthReturn, startUrl } from './authBounce';

const cases = JSON.parse(readFileSync(new URL('./fixtures/authReturn.cases.json', import.meta.url), 'utf8')) as {
  return: [string, string, string | null][];
};
const API = 'https://api.wenrwa.com/api/v1';
const SITE = 'https://app.hiveop.io';

describe('parseAuthReturn (desktop deepLink rules)', () => {
  it.each(cases.return)('%s', (_n, url, want) => {
    expect(parseAuthReturn(url)).toEqual(want === null ? null : { handoff: want });
  });
});

describe('startUrl', () => {
  it.each(['google', 'github', 'apple'] as const)('%s start carries returnTo and the S256 challenge', (p) => {
    const u = new URL(startUrl(API, SITE, p, 'CHAL'));
    expect(u.origin + u.pathname).toBe(`${API}/auth/oauth/${p}`);
    expect(u.searchParams.get('returnTo')).toBe(`${SITE}/desktop-return`);
    expect(u.searchParams.get('code_challenge')).toBe('CHAL');
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
  });
  it('tolerates a trailing slash on the api base', () => {
    expect(startUrl(`${API}/`, SITE, 'google', 'C')).toContain('/api/v1/auth/oauth/google?');
  });
});

describe('challengeFor', () => {
  it('is unpadded base64url SHA-256', () => {
    expect(challengeFor('v')).toBe(createHash('sha256').update('v').digest('base64url'));
  });
});

describe('createAuthBounce', () => {
  const mk = (now = { t: 0 }) =>
    createAuthBounce({ oauthApi: API, siteOrigin: SITE, randomBytes: () => Buffer.alloc(32, 7), now: () => now.t });
  it('start gives a URL whose challenge matches the kept verifier', () => {
    const b = mk();
    const url = new URL(b.start('github'));
    const done = b.complete('hiveop://auth?handoff=abcdefghijklmnop1234');
    expect(done).toEqual({ handoff: 'abcdefghijklmnop1234', verifier: Buffer.alloc(32, 7).toString('base64url') });
    expect(url.searchParams.get('code_challenge')).toBe(challengeFor((done as { verifier: string }).verifier));
  });
  it('a return pairs once, then is forgotten', () => {
    const b = mk();
    b.start('google');
    expect(b.complete('hiveop://auth?handoff=abcdefghijklmnop1234')).not.toBe('cancelled');
    expect(b.complete('hiveop://auth?handoff=abcdefghijklmnop1234')).toBe('cancelled');
  });
  it('a return that is not an auth link is a cancel', () => {
    const b = mk();
    b.start('google');
    expect(b.complete('hiveop://open')).toBe('cancelled');
    expect(b.complete(null)).toBe('cancelled');
  });
  it('an expired bounce is a cancel', () => {
    const now = { t: 0 };
    const b = mk(now);
    b.start('google');
    now.t = 10 * 60_000 + 1;
    expect(b.complete('hiveop://auth?handoff=abcdefghijklmnop1234')).toBe('cancelled');
  });
  it('a stray auth link with nothing pending is dropped', () => {
    expect(mk().complete('hiveop://auth?handoff=abcdefghijklmnop1234')).toBe('cancelled');
  });
});
