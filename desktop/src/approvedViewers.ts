// ryc (PRD reach-your-computer D3) — "Devices that can reach this Mac".
// Reads and edits ~/.wen-market/approved-viewers.json, the format PROTOCOL.md (ryc-03) documents
// and the CLI's `hiveop devices list|remove` use: {v:1, approved:[{keyId, publicKey, name,
// approvedAt}], removed:[{keyId, name, removedAt, by}]}. The bridge re-reads it on every open,
// so a removal applies with no restart. This module only ever REMOVES — adding a key happens in
// the bridge, after the person types the phone's code.
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const APPROVED_VIEWERS_FILE = 'approved-viewers.json';
const MAX_REMOVED_LOG = 50;

export interface ViewerRow {
  keyId: string;
  name: string;
  approvedAt: string;
}

const file = (dir: string): string => path.join(dir, APPROVED_VIEWERS_FILE);

function readRaw(dir: string): { approved: Record<string, unknown>[]; removed: unknown[]; rest: Record<string, unknown> } | null {
  try {
    const p = JSON.parse(fs.readFileSync(file(dir), 'utf8'));
    if (p && typeof p === 'object' && Array.isArray(p.approved)) {
      return { approved: p.approved.filter((e: unknown) => !!e && typeof e === 'object'), removed: Array.isArray(p.removed) ? p.removed : [], rest: p };
    }
  } catch {
    /* absent or broken: nothing approved */
  }
  return null;
}

/** For display. The bridge does the real key checks; a row it would reject is still worth showing so it can be removed. */
export function listApprovedViewers(dir: string): ViewerRow[] {
  const raw = readRaw(dir);
  if (!raw) return [];
  return raw.approved
    .filter((e) => typeof e.keyId === 'string' && (e.keyId as string).length > 0)
    .map((e) => ({
      keyId: e.keyId as string,
      name: typeof e.name === 'string' && e.name.trim() ? (e.name as string).trim().slice(0, 64) : 'Unnamed device',
      approvedAt: typeof e.approvedAt === 'string' ? (e.approvedAt as string) : '',
    }));
}

/** Remove one key by its full id. Atomic (0600 temp + rename), like the CLI. False when it was not on the list. */
export function removeApprovedViewer(dir: string, keyId: string, now: Date = new Date()): boolean {
  const raw = readRaw(dir);
  if (!raw) return false;
  const hit = raw.approved.find((e) => e.keyId === keyId);
  if (!hit) return false;
  const next = {
    ...raw.rest,
    v: 1,
    approved: raw.approved.filter((e) => e.keyId !== keyId),
    removed: [...raw.removed, { keyId, name: typeof hit.name === 'string' ? hit.name : '', removedAt: now.toISOString(), by: 'cli' }].slice(-MAX_REMOVED_LOG),
  };
  const target = file(dir);
  const tmp = `${target}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    fs.chmodSync(tmp, 0o600);
    fs.renameSync(tmp, target);
  } catch (e) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* never written */
    }
    throw e;
  }
  return true;
}
