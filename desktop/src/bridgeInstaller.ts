// Bridge installer (dsk-10): puts a verified @wenrwa/marketplace-cli under
// <root>/versions/<v>/, with a `current` pointer file swapped atomically and
// the previous version kept for rollback. Effects (registry, download, unpack,
// dependency install) are injected; this module owns the on-disk protocol.
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface PackageDist {
  version: string;
  tarball: string;
  integrity: string | undefined;
}

export interface InstallerDeps {
  /** Registry metadata for the version to install (dist-tag latest, or a pinned one). */
  registryMeta(): Promise<PackageDist>;
  download(url: string): Promise<Buffer>;
  /** Unpack a .tgz so that the package root (npm's `package/`) lands directly in `dest`. */
  extract(tgzPath: string, dest: string): Promise<void>;
  /** Production dependencies into `dir`. */
  installDeps(dir: string): Promise<void>;
}

export type InstallResult =
  | { status: 'installed'; version: string }
  | { status: 'up-to-date'; version: string }
  | { status: 'refused'; reason: 'integrity' | 'network' | 'install'; current?: string; detail?: string };

export interface Current {
  version: string;
  dir: string;
}

const COMPLETE = '.complete';
const SAFE_VERSION = /^[0-9A-Za-z][0-9A-Za-z.+-]*$/;

/** True when `data` matches a sha512 entry of an npm `dist.integrity` value. Weaker algorithms never pass. */
export function verifyIntegrity(data: Buffer, integrity: string | undefined): boolean {
  if (!integrity) return false;
  const actual = createHash('sha512').update(data).digest();
  for (const entry of integrity.split(/\s+/)) {
    const m = /^sha512-([A-Za-z0-9+/]+=*)$/.exec(entry);
    if (m && Buffer.from(m[1], 'base64').equals(actual)) return true;
  }
  return false;
}

const versionsDir = (root: string): string => path.join(root, 'versions');
const readPointer = (root: string, name: string): string | undefined => {
  try {
    const v = fs.readFileSync(path.join(root, name), 'utf8').trim();
    return SAFE_VERSION.test(v) ? v : undefined;
  } catch {
    return undefined;
  }
};
const complete = (root: string, v: string): boolean => fs.existsSync(path.join(versionsDir(root), v, COMPLETE));

/** The version to run: `current`, or `previous` if `current` is missing or half-written. */
export function readCurrent(root: string): Current | null {
  for (const name of ['current', 'previous']) {
    const v = readPointer(root, name);
    if (v && complete(root, v)) return { version: v, dir: path.join(versionsDir(root), v) };
  }
  return null;
}

function writePointer(root: string, name: string, value: string): void {
  const tmp = path.join(root, `${name}.${randomBytes(4).toString('hex')}.tmp`);
  fs.writeFileSync(tmp, value);
  fs.renameSync(tmp, path.join(root, name)); // atomic on one volume
}

function prune(root: string, keep: Set<string>): void {
  for (const e of fs.readdirSync(versionsDir(root))) {
    if (!keep.has(e)) fs.rmSync(path.join(versionsDir(root), e), { recursive: true, force: true });
  }
}

export async function installBridge(
  root: string,
  deps: InstallerDeps,
  opts: { tarball?: string } = {},
): Promise<InstallResult> {
  fs.mkdirSync(versionsDir(root), { recursive: true });
  for (const e of fs.readdirSync(versionsDir(root))) {
    if (e.startsWith('.tmp-')) fs.rmSync(path.join(versionsDir(root), e), { recursive: true, force: true });
  }
  const cur = readCurrent(root)?.version;
  const refuse = (reason: 'integrity' | 'network' | 'install', detail?: string): InstallResult => ({
    status: 'refused',
    reason,
    ...(cur ? { current: cur } : {}),
    ...(detail ? { detail } : {}),
  });

  let bytes: Buffer;
  let version: string | undefined;
  if (opts.tarball) {
    bytes = fs.readFileSync(opts.tarball); // dev/test override: no registry, so no integrity to check
  } else {
    let meta: PackageDist;
    try {
      meta = await deps.registryMeta();
      if (!SAFE_VERSION.test(meta.version)) return refuse('network', 'bad version from registry');
      if (cur === meta.version) return { status: 'up-to-date', version: cur };
      bytes = await deps.download(meta.tarball);
    } catch (e) {
      return refuse('network', (e as Error).message);
    }
    if (!verifyIntegrity(bytes, meta.integrity)) return refuse('integrity');
    version = meta.version;
  }

  const tmp = path.join(versionsDir(root), `.tmp-${randomBytes(4).toString('hex')}`);
  const tgz = `${tmp}.tgz`;
  try {
    fs.writeFileSync(tgz, bytes);
    fs.mkdirSync(tmp);
    await deps.extract(tgz, tmp);
    if (!version) {
      version = (JSON.parse(fs.readFileSync(path.join(tmp, 'package.json'), 'utf8')) as { version?: string }).version;
      if (!version || !SAFE_VERSION.test(version)) throw new Error('tarball has no usable version');
    }
    await deps.installDeps(tmp);
    fs.writeFileSync(path.join(tmp, COMPLETE), '');
    const target = path.join(versionsDir(root), version);
    fs.rmSync(target, { recursive: true, force: true }); // only reachable for a re-install of the same dev version
    fs.renameSync(tmp, target);
  } catch (e) {
    fs.rmSync(tmp, { recursive: true, force: true });
    return refuse('install', (e as Error).message);
  } finally {
    fs.rmSync(tgz, { force: true });
  }

  if (cur && cur !== version) writePointer(root, 'previous', cur);
  writePointer(root, 'current', version);
  const prev = readPointer(root, 'previous');
  prune(root, new Set([version, ...(prev ? [prev] : [])]));
  return { status: 'installed', version };
}
