/**
 * Where tapping a notification goes. Pure; the iOS and Android shells implement the same rule and
 * run src/fixtures/pushPath.cases.json. Same rule as the desktop deep link (desktop/src/deepLink.ts):
 * only a plain site path (one leading '/', no authority, no backslash, no control characters).
 * Anything else opens the site root. The payload comes from our server, but a notification is
 * still input the shell must not trust to leave the site.
 */
export const MAX_PUSH_PATH = 2048;

export function sanitizePushPath(raw: unknown): string {
  if (typeof raw !== 'string' || raw === '' || raw.length > MAX_PUSH_PATH) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return '/';
  return raw;
}

/** The URL the web view loads. Plain concatenation: the path starts with one '/', so it cannot change the origin. */
export function pushTargetUrl(raw: unknown, siteOrigin: string): string {
  return siteOrigin.replace(/\/+$/, '') + sanitizePushPath(raw);
}
