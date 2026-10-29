// Shell update checks (dsk-16). Pure decisions only; shellUpdaterHost.ts does the I/O.
// A shell update is a new release of the app itself, never the bridge (see CONTEXT.md).

export const GITHUB_OWNER = 'BunnyDAO';
export const GITHUB_REPO = 'hiveop-apps';
export const RELEASES_PAGE = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
export const LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

type Pre = (number | string)[];
interface Parsed {
  core: [number, number, number];
  pre: Pre;
}

function parse(v: string): Parsed | null {
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(v.trim());
  if (!m) return null;
  const pre: Pre = m[4] ? m[4].split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : p)) : [];
  return { core: [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)], pre };
}

/** Semver order: -1, 0, 1, or null if either side is not a version. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 | null {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i++) {
    if (pa.core[i] !== pb.core[i]) return pa.core[i]! < pb.core[i]! ? -1 : 1;
  }
  if (!pa.pre.length || !pb.pre.length) {
    if (pa.pre.length === pb.pre.length) return 0;
    return pa.pre.length ? -1 : 1; // a prerelease sorts before its release
  }
  const n = Math.max(pa.pre.length, pb.pre.length);
  for (let i = 0; i < n; i++) {
    const x = pa.pre[i];
    const y = pb.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') return x < y ? -1 : 1;
    if (typeof x === 'number') return -1; // numeric identifiers sort before alphanumeric
    if (typeof y === 'number') return 1;
    return x < y ? -1 : 1;
  }
  return 0;
}

export function isNewer(candidate: string, current: string): boolean {
  return compareVersions(candidate, current) === 1;
}

export interface ReleaseInfo {
  version: string;
  url: string;
}

/** Read GitHub's "latest release" JSON. Drafts, prereleases and junk give null. */
export function parseLatestRelease(json: unknown): ReleaseInfo | null {
  if (!json || typeof json !== 'object') return null;
  const r = json as Record<string, unknown>;
  if (r.draft === true || r.prerelease === true) return null;
  if (typeof r.tag_name !== 'string' || !parse(r.tag_name)) return null;
  const html = typeof r.html_url === 'string' ? r.html_url : '';
  const url = html.startsWith('https://') ? html : RELEASES_PAGE;
  return { version: r.tag_name.replace(/^v/, ''), url };
}

export type UpdateMode = 'auto' | 'notify' | 'off';

/** Windows (NSIS) and Linux AppImage self-update; unsigned mac and deb can only point at the download. */
export function updateMode(i: { packaged: boolean; platform: NodeJS.Platform; appImage: string | undefined }): UpdateMode {
  if (!i.packaged) return 'off';
  if (i.platform === 'win32') return 'auto';
  if (i.platform === 'linux' && i.appImage) return 'auto';
  return 'notify';
}

/** Smoke runs never check, unless a test feed is given. Only http(s) feeds count. */
export function updatesEnabled(env: Record<string, string | undefined>): { enabled: boolean; feed?: string } {
  const feed = env.HIVEOP_UPDATE_FEED;
  const okFeed = feed && /^https?:\/\//i.test(feed) ? feed : undefined;
  if (env.HIVEOP_SMOKE === '1') return okFeed ? { enabled: true, feed: okFeed } : { enabled: false };
  return okFeed ? { enabled: true, feed: okFeed } : { enabled: true };
}

export function latestReleaseFeed(override: string | undefined): string {
  return override ?? LATEST_RELEASE_API;
}

export type UpdateState =
  | { kind: 'idle' }
  | { kind: 'available'; version: string; url: string }
  | { kind: 'downloading'; version: string }
  | { kind: 'ready'; version: string };

export interface UpdateItem {
  label: string;
  action: 'open-release' | 'restart' | null;
}

export function updateMenuItem(s: UpdateState): UpdateItem | null {
  switch (s.kind) {
    case 'idle':
      return null;
    case 'available':
      return { label: 'Update available — Download', action: 'open-release' };
    case 'downloading':
      return { label: 'Downloading update…', action: null };
    case 'ready':
      return { label: 'Restart to update', action: 'restart' };
  }
}
