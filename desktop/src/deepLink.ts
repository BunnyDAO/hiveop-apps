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

export interface AuthLink {
  kind: 'auth';
  /** Single-use handoff token: URL-safe characters only. */
  handoff: string;
}

const HANDOFF_RE = /^[A-Za-z0-9._~-]{16,512}$/;

/** Parse hiveop://auth?handoff=<token>. Pure; strict on charset, length and a single param. */
export function parseAuthLink(raw: string): AuthLink | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'hiveop:' || u.hostname !== 'auth') return null;
  const all = u.searchParams.getAll('handoff');
  if (all.length !== 1 || !HANDOFF_RE.test(all[0])) return null;
  return { kind: 'auth', handoff: all[0] };
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
