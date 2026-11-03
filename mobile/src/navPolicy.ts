/**
 * Where a URL the site wants to show should open. Pure; shape mirrors desktop/src/navPolicy.ts.
 *
 * - in-app: the site, the backend auth chain, `hiveop:` deep links.
 * - sheet: any other http(s) page (GitHub App install, Stripe billing portal, docs, github.com):
 *   SFSafariViewController / Custom Tabs over the app; closing it leaves the main view untouched.
 * - system-browser: only when the caller says the page must leave the app (`linkOut`, the US
 *   checkout link-out in a later slice).
 * - deny: every other scheme (javascript:, file:, data:, blob:, about:, intent:, mailto:, ...).
 * - auth-session (OAuth) arrives in the browser-bounce slice; until then OAuth hosts are sheets.
 *
 * The native shells mirror this table (same decisions, fed by www/hiveop-shell.json); a page can
 * never take the main web view off the site.
 */
export type Decision = 'in-app' | 'sheet' | 'auth-session' | 'system-browser' | 'deny';

export interface NavContext {
  /** Origin of the site the shell loads, e.g. https://app.hiveop.io */
  siteOrigin: string;
  /** The page is a deliberate leave-the-app link (system browser, not a sheet). */
  linkOut?: boolean;
}

// Backend auth chain for the email-code sign-in (https only).
export const AUTH_HOSTS = ['api.hiveop.io', 'api.wenrwa.com'];

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
  return ctx.linkOut ? 'system-browser' : 'sheet';
}

/** Hosts that decide() keeps in the app, for the native navigation allow-list. */
export function inAppHosts(ctx: NavContext): string[] {
  return [new URL(ctx.siteOrigin).hostname, ...AUTH_HOSTS];
}
