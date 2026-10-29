import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { challengeFor, createAuthBounce, startUrl } from './authBounce';

const OAUTH = 'https://api.hiveop.io/api/v1';
const SITE = 'https://app.hiveop.io';

function harness(ttlMs = 600_000) {
  let t = 1_000;
  let n = 0;
  const opened: string[] = [];
  const b = createAuthBounce({
    oauthApi: OAUTH,
    siteOrigin: SITE,
    ttlMs,
    now: () => t,
    randomBytes: (len) => Buffer.alloc(len, ++n),
    open: (u) => {
      opened.push(u);
    },
  });
  return { b, opened, advance: (ms: number) => (t += ms) };
}

describe('challengeFor', () => {
  it('is the unpadded base64url SHA-256 of the verifier (43 chars)', () => {
    const c = challengeFor('abc');
    expect(c).toBe(createHash('sha256').update('abc').digest('base64url'));
    expect(c).toHaveLength(43);
    expect(c).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe('startUrl', () => {
  it('asks the backend for Google with the desktop return and an S256 challenge', () => {
    const u = new URL(startUrl(OAUTH, SITE, 'C'.repeat(43)));
    expect(u.origin + u.pathname).toBe('https://api.hiveop.io/api/v1/auth/oauth/google');
    expect(u.searchParams.get('returnTo')).toBe('https://app.hiveop.io/desktop-return');
    expect(u.searchParams.get('code_challenge')).toBe('C'.repeat(43));
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
  });
});

describe('createAuthBounce', () => {
  it('start opens the system browser with the challenge of a 32-byte verifier', () => {
    const { b, opened } = harness();
    b.start();
    expect(opened).toHaveLength(1);
    const verifier = Buffer.alloc(32, 1).toString('base64url');
    expect(new URL(opened[0]).searchParams.get('code_challenge')).toBe(challengeFor(verifier));
  });

  it('take returns the verifier once, then forgets it', () => {
    const { b } = harness();
    b.start();
    const first = b.take('tok_abcdefghijklmnop');
    expect(first).toEqual({ handoff: 'tok_abcdefghijklmnop', verifier: Buffer.alloc(32, 1).toString('base64url') });
    expect(b.take('tok_abcdefghijklmnop')).toBeNull();
  });

  it('take without a pending bounce is null', () => {
    expect(harness().b.take('tok_abcdefghijklmnop')).toBeNull();
  });

  it('a pending bounce expires after the ttl', () => {
    const { b, advance } = harness(600_000);
    b.start();
    advance(600_001);
    expect(b.take('tok_abcdefghijklmnop')).toBeNull();
  });

  it('only one is pending: a new start replaces the old verifier', () => {
    const { b } = harness();
    b.start();
    b.start();
    expect(b.take('tok_abcdefghijklmnop')?.verifier).toBe(Buffer.alloc(32, 2).toString('base64url'));
  });

  it('cancel forgets the verifier', () => {
    const { b } = harness();
    b.start();
    b.cancel();
    expect(b.take('tok_abcdefghijklmnop')).toBeNull();
  });

  it('does not keep a verifier if opening the browser fails', async () => {
    const b = createAuthBounce({
      oauthApi: OAUTH,
      siteOrigin: SITE,
      now: () => 0,
      randomBytes: (n) => Buffer.alloc(n, 9),
      open: () => Promise.reject(new Error('no browser')),
    });
    await expect(b.start()).rejects.toThrow();
    expect(b.take('tok_abcdefghijklmnop')).toBeNull();
  });
});
