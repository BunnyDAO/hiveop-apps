/**
 * Where a URL the site wants to show should open. Pure; shape mirrors desktop/src/navPolicy.ts.
 *
 * Only `in-app` and `deny` are fully wired in slice ph-01. `sheet` and `auth-session`
 * (OAuth, billing portal, GitHub App install) arrive in later slices; until then every
 * other http(s) URL falls to `system-browser`.
 */
export type Decision = 'in-app' | 'sheet' | 'auth-session' | 'system-browser' | 'deny';

export interface NavContext {
  /** Origin of the site the shell loads, e.g. https://app.hiveop.io */
  siteOrigin: string;
}

// Backend auth chain for the email-code sign-in (https only).
const AUTH_HOSTS = ['api.hiveop.io', 'api.wenrwa.com'];

export function decide(rawUrl: string, ctx: NavContext): Decision {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return 'deny';
  }
  if (u.protocol === 'hiveop:') return 'in-app';
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'deny';

  if (u.origin === ctx.siteOrigin) return 'in-app';
  if (u.protocol === 'https:' && u.port === '' && AUTH_HOSTS.includes(u.hostname)) return 'in-app';
  return 'system-browser';
}

/** Hosts that decide() keeps in the app, for the native navigation allow-list. */
export function inAppHosts(ctx: NavContext): string[] {
  return [new URL(ctx.siteOrigin).hostname, ...AUTH_HOSTS];
}
