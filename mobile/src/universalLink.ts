/**
 * Where a tapped HiveOp link (Universal Link / verified App Link) goes inside the app. Pure; the
 * iOS and Android shells implement the same rule and run src/fixtures/universalLink.cases.json.
 *
 * The OS only hands us https://<site host>/... links (the site's apple-app-site-association and
 * assetlinks.json decide that), but the shell re-checks: exactly the site origin over https, no
 * credentials, no custom port, and not a path the site keeps out of the app (/api, /desktop-return,
 * /.well-known). What is left is the path+query+hash, run through the same sanitiser as a tapped
 * notification (pushPath.ts), so a link can never take the web view off the site.
 * Returns the full URL to load, or null to leave the app where it is.
 */
import { sanitizePushPath, pushTargetUrl } from './pushPath.ts';

const EXCLUDED_PREFIXES = ['/api', '/desktop-return', '/.well-known'];

function excluded(pathname: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname).toLowerCase();
  } catch {
    return true;
  }
  return EXCLUDED_PREFIXES.some((p) => decoded === p || decoded.startsWith(p + '/'));
}

export function universalLinkTarget(raw: unknown, siteOrigin: string): string | null {
  if (typeof raw !== 'string' || raw.length > 2048) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.origin !== siteOrigin) return null;
  if (u.username !== '' || u.password !== '') return null;
  if (excluded(u.pathname)) return null;
  const path = u.pathname + u.search + u.hash;
  if (sanitizePushPath(path) !== path) return null;
  return pushTargetUrl(path, siteOrigin);
}
