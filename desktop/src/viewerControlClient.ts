// ryc (PRD reach-your-computer D3) — the desktop side of the bridge's viewer CONTROL channel.
// Approving a viewer key is native-only: the bridge refuses any request carrying an Origin
// header and wants a per-run token it writes only to ~/.wen-market/viewer-control.json (0600).
// So this runs in the MAIN process with plain Node http — never from a renderer, never fetch()
// from a page. Mirrors the CLI's cli/src/bridge/viewerControl.ts (PROTOCOL.md, ryc-03).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

export const VIEWER_CONTROL_FILE = 'viewer-control.json';
export const CONTROL_TOKEN_HEADER = 'x-hiveop-control-token';

export interface ControlInfo {
  port: number;
  token: string;
  pid: number;
}

/** What the bridge reports. The bridge never serves its copy of the code: the person reads it off the phone. */
export interface PendingPairing {
  pairingId: string;
  name: string;
  keyId: string;
  expiresAt: string;
}

export interface ApprovedViewerRef {
  keyId: string;
  name: string;
}

export type ApproveResult = { ok: true; viewer: ApprovedViewerRef } | { ok: false; reason: string };

/** No bridge is accepting pairings: no control file, nothing listening, or a stale token. */
export class NoControlBridgeError extends Error {
  constructor() {
    super('no bridge is accepting device pairings');
  }
}

export function readControlInfo(dir: string): ControlInfo | null {
  try {
    const p = JSON.parse(fs.readFileSync(path.join(dir, VIEWER_CONTROL_FILE), 'utf8'));
    if (p && Number.isInteger(p.port) && p.port > 0 && p.port < 65536 && typeof p.token === 'string' && p.token.length > 0) {
      return { port: p.port, token: p.token, pid: typeof p.pid === 'number' ? p.pid : 0 };
    }
  } catch {
    /* absent or broken */
  }
  return null;
}

/** Headers for a control request. Exported so the test can pin it: never an Origin. */
export function controlHeaders(info: ControlInfo, body?: string): Record<string, string> {
  return {
    [CONTROL_TOKEN_HEADER]: info.token,
    ...(body !== undefined ? { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(body)) } : {}),
  };
}

function call(info: ControlInfo, method: 'GET' | 'POST', pathname: string, payload?: unknown, timeoutMs = 3000): Promise<{ status: number; body: unknown }> {
  const body = payload === undefined ? undefined : JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    // Node sets Host to 127.0.0.1:<port> (the bridge's DNS-rebinding guard wants loopback).
    const req = http.request(
      { host: '127.0.0.1', port: info.port, path: pathname, method, headers: controlHeaders(info, body), timeout: timeoutMs },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (c) => {
          raw += c;
          if (raw.length > 256 * 1024) req.destroy(new Error('response too large'));
        });
        res.on('end', () => {
          let parsed: unknown = null;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch {
            parsed = null;
          }
          resolve({ status: res.statusCode ?? 0, body: parsed });
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', () => reject(new NoControlBridgeError()));
    if (body !== undefined) req.write(body);
    req.end();
  });
}

function isPending(x: unknown): x is PendingPairing {
  const p = x as Partial<PendingPairing> | null;
  return !!p && typeof p.pairingId === 'string' && typeof p.name === 'string' && typeof p.keyId === 'string';
}

export async function fetchPending(info: ControlInfo): Promise<PendingPairing[]> {
  const { status, body } = await call(info, 'GET', '/control/viewer-pairings');
  if (status === 401 || status === 404) throw new NoControlBridgeError(); // stale file / bridge without the routes
  const list = (body as { pending?: unknown } | null)?.pending;
  if (status !== 200 || !Array.isArray(list)) throw new Error(`bridge answered ${status}`);
  return list.filter(isPending).map((p) => ({
    pairingId: p.pairingId,
    name: p.name,
    keyId: p.keyId,
    expiresAt: typeof p.expiresAt === 'string' ? p.expiresAt : typeof p.expiresAt === 'number' ? new Date(p.expiresAt).toISOString() : '',
  }));
}

/** One attempt. The code is what the person TYPED, read off their phone — never the bridge's copy. */
export async function approveCode(info: ControlInfo, code: string, pairingId: string): Promise<ApproveResult> {
  if (!/^\d{6}$/.test(code)) return { ok: false, reason: 'invalid-code' };
  // pairingId scopes the one attempt to THIS request; the bridge spends it on a wrong code.
  const { status, body } = await call(info, 'POST', '/control/viewer-pairings/approve', { code, pairingId });
  if (status === 401) throw new NoControlBridgeError();
  const b = body as { ok?: unknown; viewer?: { keyId?: unknown; name?: unknown }; reason?: unknown } | null;
  if (b && b.ok === true && b.viewer && typeof b.viewer.keyId === 'string') {
    return { ok: true, viewer: { keyId: b.viewer.keyId, name: typeof b.viewer.name === 'string' ? b.viewer.name : 'Device' } };
  }
  return { ok: false, reason: b && typeof b.reason === 'string' ? b.reason : 'unknown' };
}

/** What the approval window shows after one attempt. */
export type ApprovalOutcome =
  | { kind: 'approved'; name: string }
  | { kind: 'mismatch' } // wrong code (or a 1-in-10^6 clash): this request is spent
  | { kind: 'invalid' } // not six digits; nothing was sent
  | { kind: 'unreachable' }; // the bridge did not answer: nothing was tried, so trying again is fine

export function approvalOutcome(r: ApproveResult | Error): ApprovalOutcome {
  if (r instanceof Error) return { kind: 'unreachable' };
  if (r.ok) return { kind: 'approved', name: r.viewer.name };
  if (r.reason === 'invalid-code') return { kind: 'invalid' };
  if (r.reason === 'no-match' || r.reason === 'ambiguous') return { kind: 'mismatch' };
  return { kind: 'unreachable' };
}
