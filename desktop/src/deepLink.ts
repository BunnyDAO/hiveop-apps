export interface OpenLink {
  kind: 'open';
  /** Site-relative path (plus query/hash). Always starts with a single '/'. */
  path: string;
}

/** Accept only a plain site path: one leading '/', no authority, no backslash, no control chars. */
function safePath(p: string): boolean {
  if (!p.startsWith('/') || p.startsWith('//')) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(p)) return false;
  return true;
}

/** Parse a hiveop:// link. Pure. Returns null for anything that is not a safe in-site open. */
export function parseDeepLink(raw: string): OpenLink | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'hiveop:' || u.hostname !== 'open') return null;
  // Read the raw value: URLSearchParams would also work, but we want exactly one `path` param.
  const path = u.searchParams.get('path');
  if (path === null) return { kind: 'open', path: '/' };
  return safePath(path) ? { kind: 'open', path } : null;
}

/** Join a validated path onto the site origin. Never yields another origin. */
export function toSiteUrl(path: string, siteOrigin: string): string {
  const u = new URL(path, siteOrigin);
  if (u.origin !== new URL(siteOrigin).origin) throw new Error('deep link left the site origin');
  return u.href;
}

/** Windows/Linux deliver the link as a command-line argument. */
export function deepLinkFromArgv(argv: readonly string[]): string | undefined {
  return argv.find((a) => /^hiveop:\/\//i.test(a));
}
