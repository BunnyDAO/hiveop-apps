import { createHash } from 'node:crypto';

/** PKCE S256: unpadded base64url SHA-256 of the verifier. */
export function challengeFor(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/** The backend URL that starts Google sign-in bound to `challenge`, returning to /desktop-return. */
export function startUrl(oauthApi: string, siteOrigin: string, challenge: string): string {
  const u = new URL(`${oauthApi.replace(/\/+$/, '')}/auth/oauth/google`);
  u.searchParams.set('returnTo', `${siteOrigin}/desktop-return`);
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  return u.href;
}

export interface AuthBounceDeps {
  oauthApi: string;
  siteOrigin: string;
  /** Open a URL in the system browser. */
  open(url: string): void | Promise<void>;
  randomBytes(len: number): Buffer;
  now(): number;
  /** Default 10 minutes. */
  ttlMs?: number;
}

export interface AuthBounce {
  /** Begin a bounce (replaces any pending one). */
  start(): Promise<void>;
  /** Pair a handoff with the pending verifier, once. Null if none pending or expired. */
  take(handoff: string): { handoff: string; verifier: string } | null;
  cancel(): void;
}

/** The verifier lives here, in main-process memory, one at a time, and is forgotten on use. */
export function createAuthBounce(d: AuthBounceDeps): AuthBounce {
  const ttl = d.ttlMs ?? 10 * 60_000;
  let pending: { verifier: string; expires: number } | null = null;
  return {
    async start() {
      const verifier = d.randomBytes(32).toString('base64url');
      pending = { verifier, expires: d.now() + ttl };
      try {
        await d.open(startUrl(d.oauthApi, d.siteOrigin, challengeFor(verifier)));
      } catch (err) {
        pending = null;
        throw err;
      }
    },
    take(handoff) {
      const p = pending;
      pending = null;
      if (!p || d.now() > p.expires) return null;
      return { handoff, verifier: p.verifier };
    },
    cancel() {
      pending = null;
    },
  };
}
