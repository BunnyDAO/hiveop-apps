import { createHash } from 'node:crypto';

/**
 * The phone app's sign-in bounce (ph-04), same rules as desktop/src/authBounce.ts + deepLink.ts.
 * The native shells run the real thing (ASWebAuthenticationSession / Custom Tabs) and mirror this
 * file; src/fixtures/authReturn.cases.json is the shared truth for return parsing.
 */
export type Provider = 'google' | 'github' | 'apple'; // apple: Android's web flow; iOS uses the native sheet

/** PKCE S256: unpadded base64url SHA-256 of the verifier. */
export function challengeFor(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/** Backend OAuth start for `provider`, bound to `challenge`, returning to the site's /desktop-return. */
export function startUrl(oauthApi: string, siteOrigin: string, provider: Provider, challenge: string): string {
  const u = new URL(`${oauthApi.replace(/\/+$/, '')}/auth/oauth/${provider}`);
  u.searchParams.set('returnTo', `${siteOrigin}/desktop-return`);
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  return u.href;
}

const HANDOFF_RE = /^[A-Za-z0-9._~-]{16,512}$/;

/** hiveop://auth?handoff=<token>: strict on charset, length and a single param. */
export function parseAuthReturn(raw: string): { handoff: string } | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'hiveop:' || u.hostname !== 'auth') return null;
  const all = u.searchParams.getAll('handoff');
  if (all.length !== 1 || !HANDOFF_RE.test(all[0])) return null;
  return { handoff: all[0] };
}

export interface AuthBounceDeps {
  oauthApi: string;
  siteOrigin: string;
  randomBytes(len: number): Buffer;
  now(): number;
  /** Default 10 minutes. */
  ttlMs?: number;
}

export interface PhoneAuthBounce {
  /** Begin a bounce (replaces any pending one); returns the URL for the secure sheet. */
  start(provider: Provider): string;
  /** The sheet ended with `returnUrl` (null = closed). Pairs the verifier once, else 'cancelled'. */
  complete(returnUrl: string | null): { handoff: string; verifier: string } | 'cancelled';
}

/** The verifier lives here, in the shell, one at a time, and is forgotten on use. */
export function createAuthBounce(d: AuthBounceDeps): PhoneAuthBounce {
  const ttl = d.ttlMs ?? 10 * 60_000;
  let pending: { verifier: string; expires: number } | null = null;
  return {
    start(provider) {
      const verifier = d.randomBytes(32).toString('base64url');
      pending = { verifier, expires: d.now() + ttl };
      return startUrl(d.oauthApi, d.siteOrigin, provider, challengeFor(verifier));
    },
    complete(returnUrl) {
      const p = pending;
      pending = null;
      if (!p || d.now() > p.expires || returnUrl === null) return 'cancelled';
      const r = parseAuthReturn(returnUrl);
      return r ? { handoff: r.handoff, verifier: p.verifier } : 'cancelled';
    },
  };
}
