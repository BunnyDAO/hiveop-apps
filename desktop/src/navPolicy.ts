export type Decision = 'in-window' | 'app-popup' | 'system-browser' | 'deny';

export interface NavContext {
  /** Origin of the site the shell loads, e.g. https://app.hiveop.io */
  siteOrigin: string;
}

// Backend auth chain for email / GitHub sign-in (https only).
const AUTH_HOSTS = new Set(['api.hiveop.io', 'api.wenrwa.com']);
const POPUP_HOSTS = new Set(['checkout.stripe.com', 'billing.stripe.com']);

/** Where a URL the site wants to show should open. Pure. */
export function decide(rawUrl: string, ctx: NavContext): Decision {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return 'deny';
  }
  if (u.protocol === 'hiveop:') return 'in-window';
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'deny';

  if (u.origin === ctx.siteOrigin) return 'in-window';

  if (u.protocol === 'https:' && u.port === '') {
    if (AUTH_HOSTS.has(u.hostname)) return 'in-window';
    if (POPUP_HOSTS.has(u.hostname)) return 'app-popup';
    if (u.hostname === 'github.com') {
      if (/^\/login\/oauth(\/|$)/.test(u.pathname)) return 'in-window';
      if (/^\/apps\/[^/]+\/installations(\/|$)/.test(u.pathname)) return 'app-popup';
    }
  }
  return 'system-browser';
}
