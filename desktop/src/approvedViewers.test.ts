import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { APPROVED_VIEWERS_FILE, listApprovedViewers, removeApprovedViewer } from './approvedViewers';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hiveop-av-'));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const write = (o: unknown): void => fs.writeFileSync(path.join(dir, APPROVED_VIEWERS_FILE), JSON.stringify(o), { mode: 0o600 });
const read = (): any => JSON.parse(fs.readFileSync(path.join(dir, APPROVED_VIEWERS_FILE), 'utf8'));

describe('approvedViewers', () => {
  it('lists nothing when the file is missing or broken', () => {
    expect(listApprovedViewers(dir)).toEqual([]);
    fs.writeFileSync(path.join(dir, APPROVED_VIEWERS_FILE), 'nope');
    expect(listApprovedViewers(dir)).toEqual([]);
  });

  it('lists approved devices', () => {
    write({ v: 1, approved: [{ keyId: 'aaa', publicKey: 'P', name: 'iPhone', approvedAt: '2026-11-14T10:00:00Z' }, { name: 'no id' }, { keyId: 'bbb', publicKey: 'Q', name: '  ' }], removed: [] });
    expect(listApprovedViewers(dir)).toEqual([
      { keyId: 'aaa', name: 'iPhone', approvedAt: '2026-11-14T10:00:00Z' },
      { keyId: 'bbb', name: 'Unnamed device', approvedAt: '' },
    ]);
  });

  it('removes one key atomically, keeps the rest untouched, and logs the removal', () => {
    write({ v: 1, approved: [{ keyId: 'aaa', publicKey: 'P', name: 'iPhone', approvedAt: 'x' }, { keyId: 'bbb', publicKey: 'Q', name: 'Pixel', approvedAt: 'y' }], removed: [] });
    expect(removeApprovedViewer(dir, 'aaa', new Date('2026-11-16T00:00:00Z'))).toBe(true);
    const after = read();
    expect(after.approved).toEqual([{ keyId: 'bbb', publicKey: 'Q', name: 'Pixel', approvedAt: 'y' }]);
    expect(after.removed).toEqual([{ keyId: 'aaa', name: 'iPhone', removedAt: '2026-11-16T00:00:00.000Z', by: 'cli' }]);
    expect(fs.statSync(path.join(dir, APPROVED_VIEWERS_FILE)).mode & 0o777).toBe(0o600);
    expect(fs.readdirSync(dir)).toEqual([APPROVED_VIEWERS_FILE]); // no temp file left behind
  });

  it('removing an unknown key changes nothing', () => {
    write({ v: 1, approved: [{ keyId: 'aaa', publicKey: 'P', name: 'iPhone' }], removed: [] });
    const before = fs.readFileSync(path.join(dir, APPROVED_VIEWERS_FILE), 'utf8');
    expect(removeApprovedViewer(dir, 'zzz')).toBe(false);
    expect(removeApprovedViewer(dir, 'aa')).toBe(false); // full ids only
    expect(fs.readFileSync(path.join(dir, APPROVED_VIEWERS_FILE), 'utf8')).toBe(before);
  });
});
