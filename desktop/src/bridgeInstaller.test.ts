import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installBridge, readCurrent, verifyIntegrity, type InstallerDeps } from './bridgeInstaller';

const sri = (b: Buffer, algo = 'sha512') => `${algo}-${createHash(algo).update(b).digest('base64')}`;

describe('verifyIntegrity', () => {
  const data = Buffer.from('tarball bytes');
  it('accepts a matching sha512', () => expect(verifyIntegrity(data, sri(data))).toBe(true));
  it('rejects a mismatch', () => expect(verifyIntegrity(Buffer.from('other'), sri(data))).toBe(false));
  it('rejects weak or missing algorithms', () => {
    expect(verifyIntegrity(data, sri(data, 'sha1'))).toBe(false);
    expect(verifyIntegrity(data, '')).toBe(false);
    expect(verifyIntegrity(data, undefined)).toBe(false);
  });
  it('accepts any matching sha512 in a space-separated list', () => {
    expect(verifyIntegrity(data, `${sri(Buffer.from('x'))} ${sri(data)}`)).toBe(true);
  });
});

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'hiveop-inst-'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

function fakeRegistry(versions: Record<string, Buffer>, opts: { badIntegrityFor?: string } = {}) {
  const calls = { meta: 0, download: 0, installDeps: 0 };
  let latest = Object.keys(versions).at(-1)!;
  const deps: InstallerDeps = {
    async registryMeta() {
      calls.meta++;
      return {
        version: latest,
        tarball: `https://registry.example/${latest}.tgz`,
        integrity: opts.badIntegrityFor === latest ? sri(Buffer.from('not it')) : sri(versions[latest]),
      };
    },
    async download(url) {
      calls.download++;
      const v = /([^/]+)\.tgz$/.exec(url)![1];
      return versions[v];
    },
    async extract(tgz, dest) {
      const bytes = fs.readFileSync(tgz);
      fs.mkdirSync(path.join(dest, 'dist'), { recursive: true });
      fs.writeFileSync(path.join(dest, 'dist', 'index.js'), bytes);
      fs.writeFileSync(path.join(dest, 'package.json'), JSON.stringify({ name: '@wenrwa/marketplace-cli', version: bytes.toString() }));
    },
    async installDeps() {
      calls.installDeps++;
    },
  };
  return { deps, calls, setLatest: (v: string) => (latest = v) };
}

const v = (s: string) => Buffer.from(s);

describe('installBridge', () => {
  it('installs into versions/<v>, points current at it, and reports it', async () => {
    const r = fakeRegistry({ '0.9.0': v('0.9.0') });
    const res = await installBridge(root, r.deps);
    expect(res).toEqual({ status: 'installed', version: '0.9.0' });
    expect(readCurrent(root)).toEqual({ version: '0.9.0', dir: path.join(root, 'versions', '0.9.0') });
    expect(fs.existsSync(path.join(root, 'versions', '0.9.0', 'dist', 'index.js'))).toBe(true);
    expect(r.calls.installDeps).toBe(1);
  });

  it('is a no-op when the latest version is already current', async () => {
    const r = fakeRegistry({ '0.9.0': v('0.9.0') });
    await installBridge(root, r.deps);
    const again = await installBridge(root, r.deps);
    expect(again).toEqual({ status: 'up-to-date', version: '0.9.0' });
    expect(r.calls.download).toBe(1);
  });

  it('keeps the previous version for rollback and prunes older ones', async () => {
    const r = fakeRegistry({ '0.9.0': v('0.9.0'), '0.9.1': v('0.9.1'), '0.9.2': v('0.9.2') });
    for (const ver of ['0.9.0', '0.9.1', '0.9.2']) {
      r.setLatest(ver);
      await installBridge(root, r.deps);
    }
    expect(readCurrent(root)?.version).toBe('0.9.2');
    expect(fs.readdirSync(path.join(root, 'versions')).sort()).toEqual(['0.9.1', '0.9.2']);
    expect(fs.readFileSync(path.join(root, 'previous'), 'utf8')).toBe('0.9.1');
  });

  it('refuses an integrity mismatch before unpacking and keeps the current version', async () => {
    const r = fakeRegistry({ '0.9.0': v('0.9.0'), '0.9.1': v('0.9.1') }, { badIntegrityFor: '0.9.1' });
    r.setLatest('0.9.0');
    await installBridge(root, r.deps);
    r.setLatest('0.9.1');
    const res = await installBridge(root, r.deps);
    expect(res).toEqual({ status: 'refused', reason: 'integrity', current: '0.9.0' });
    expect(readCurrent(root)?.version).toBe('0.9.0');
    expect(fs.readdirSync(path.join(root, 'versions'))).toEqual(['0.9.0']);
    expect(r.calls.installDeps).toBe(1);
  });

  it('refuses when the registry or download fails, without touching current', async () => {
    const r = fakeRegistry({ '0.9.0': v('0.9.0') });
    await installBridge(root, r.deps);
    const res = await installBridge(root, { ...r.deps, registryMeta: async () => { throw new Error('offline'); } });
    expect(res).toMatchObject({ status: 'refused', reason: 'network', current: '0.9.0' });
    expect(readCurrent(root)?.version).toBe('0.9.0');
  });

  it('a failed dependency install leaves no half version and keeps current', async () => {
    const r = fakeRegistry({ '0.9.0': v('0.9.0'), '0.9.1': v('0.9.1') });
    r.setLatest('0.9.0');
    await installBridge(root, r.deps);
    r.setLatest('0.9.1');
    const res = await installBridge(root, { ...r.deps, installDeps: async () => { throw new Error('npm exploded'); } });
    expect(res).toMatchObject({ status: 'refused', reason: 'install', current: '0.9.0' });
    expect(fs.readdirSync(path.join(root, 'versions'))).toEqual(['0.9.0']);
  });

  it('cleans up an interrupted install and ignores a pointer to an incomplete version', async () => {
    const r = fakeRegistry({ '0.9.0': v('0.9.0'), '0.9.1': v('0.9.1') });
    r.setLatest('0.9.0');
    await installBridge(root, r.deps);
    fs.mkdirSync(path.join(root, 'versions', '.tmp-dead'), { recursive: true });
    fs.mkdirSync(path.join(root, 'versions', '0.9.1')); // pointer target without its completion marker
    fs.writeFileSync(path.join(root, 'previous'), '0.9.0');
    fs.writeFileSync(path.join(root, 'current'), '0.9.1');
    expect(readCurrent(root)?.version).toBe('0.9.0');
    r.setLatest('0.9.1');
    const res = await installBridge(root, r.deps);
    expect(res).toEqual({ status: 'installed', version: '0.9.1' });
    expect(fs.readdirSync(path.join(root, 'versions')).sort()).toEqual(['0.9.0', '0.9.1']);
    expect(readCurrent(root)?.version).toBe('0.9.1');
  });

  it('readCurrent is null on a fresh folder', () => expect(readCurrent(root)).toBeNull());

  it('a local tarball (dev override) installs without registry integrity', async () => {
    const r = fakeRegistry({ '0.9.0': v('0.9.0') });
    const tgz = path.join(root, 'local.tgz');
    fs.writeFileSync(tgz, v('0.9.5-dev'));
    const res = await installBridge(root, { ...r.deps, registryMeta: async () => { throw new Error('unused'); } }, { tarball: tgz });
    expect(res).toEqual({ status: 'installed', version: '0.9.5-dev' });
    expect(readCurrent(root)?.version).toBe('0.9.5-dev');
  });
});
