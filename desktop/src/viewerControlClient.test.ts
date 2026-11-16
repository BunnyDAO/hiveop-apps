import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  approvalOutcome,
  approveCode,
  CONTROL_TOKEN_HEADER,
  controlHeaders,
  fetchPending,
  NoControlBridgeError,
  readControlInfo,
  VIEWER_CONTROL_FILE,
  type ControlInfo,
} from './viewerControlClient';

const TOKEN = 'a'.repeat(64);

/** A fake bridge with the CLI's rules: refuse any Origin, loopback Host only, token required. */
function fakeBridge() {
  const seen: http.IncomingHttpHeaders[] = [];
  const bodies: string[] = [];
  let pending: unknown[] = [];
  let answer: { status: number; body: unknown } = { status: 200, body: { ok: true, viewer: { keyId: 'k1', name: 'Pixel' } } };
  const server = http.createServer((req, res) => {
    seen.push(req.headers);
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      bodies.push(raw);
      const send = (status: number, body?: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(body === undefined ? '' : JSON.stringify(body));
      };
      if (req.headers.origin !== undefined) return send(403);
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(String(req.headers.host))) return send(403);
      if (req.headers[CONTROL_TOKEN_HEADER] !== TOKEN) return send(401);
      if (req.method === 'GET' && req.url === '/control/viewer-pairings') return send(200, { pending });
      if (req.method === 'POST' && req.url === '/control/viewer-pairings/approve') return send(answer.status, answer.body);
      send(404);
    });
  });
  return {
    seen,
    bodies,
    setPending: (p: unknown[]) => (pending = p),
    setAnswer: (a: typeof answer) => (answer = a),
    listen: () => new Promise<number>((r) => server.listen(0, '127.0.0.1', () => r((server.address() as { port: number }).port))),
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

let dir: string;
let bridge: ReturnType<typeof fakeBridge>;
let info: ControlInfo;

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hiveop-vc-'));
  bridge = fakeBridge();
  info = { port: await bridge.listen(), token: TOKEN, pid: 1 };
});
afterEach(async () => {
  await bridge.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('readControlInfo', () => {
  it('is null with no file, a broken file, or a file without a token', () => {
    expect(readControlInfo(dir)).toBeNull();
    fs.writeFileSync(path.join(dir, VIEWER_CONTROL_FILE), '{nope');
    expect(readControlInfo(dir)).toBeNull();
    fs.writeFileSync(path.join(dir, VIEWER_CONTROL_FILE), JSON.stringify({ v: 1, port: 9000, token: '' }));
    expect(readControlInfo(dir)).toBeNull();
  });
  it('reads the bridge-written file', () => {
    fs.writeFileSync(path.join(dir, VIEWER_CONTROL_FILE), JSON.stringify({ v: 1, port: 9000, token: TOKEN, pid: 42 }));
    expect(readControlInfo(dir)).toEqual({ port: 9000, token: TOKEN, pid: 42 });
  });
});

describe('control requests', () => {
  it('never send an Origin header, and send the token to a loopback Host', async () => {
    expect(Object.keys(controlHeaders(info, '{}')).map((k) => k.toLowerCase())).not.toContain('origin');
    await fetchPending(info);
    await approveCode(info, '123456', 'p1');
    expect(bridge.seen).toHaveLength(2);
    for (const h of bridge.seen) {
      expect(h.origin).toBeUndefined();
      expect(h.referer).toBeUndefined();
      expect(h[CONTROL_TOKEN_HEADER]).toBe(TOKEN);
      expect(h.host).toBe(`127.0.0.1:${info.port}`);
    }
  });

  it('lists pending pairings', async () => {
    bridge.setPending([{ pairingId: 'p1', name: 'iPhone', keyId: 'k', expiresAt: Date.parse('2026-11-16T00:05:00Z') }, { junk: true }]);
    expect(await fetchPending(info)).toEqual([{ pairingId: 'p1', name: 'iPhone', keyId: 'k', expiresAt: '2026-11-16T00:05:00.000Z' }]);
  });

  it('a wrong token reads as no bridge (a stale file from an earlier run)', async () => {
    await expect(fetchPending({ ...info, token: 'b'.repeat(64) })).rejects.toBeInstanceOf(NoControlBridgeError);
    await expect(approveCode({ ...info, token: 'b'.repeat(64) }, '123456', 'p1')).rejects.toBeInstanceOf(NoControlBridgeError);
  });

  it('nothing listening reads as no bridge', async () => {
    await bridge.close();
    bridge = fakeBridge();
    await expect(fetchPending(info)).rejects.toBeInstanceOf(NoControlBridgeError);
    await bridge.listen();
  });

  it('approve sends only the typed code', async () => {
    expect(await approveCode(info, '654321', 'p1')).toEqual({ ok: true, viewer: { keyId: 'k1', name: 'Pixel' } });
    expect(JSON.parse(bridge.bodies[0])).toEqual({ code: '654321', pairingId: 'p1' });
  });

  it('a non 6-digit code is refused without a request', async () => {
    expect(await approveCode(info, '12345', 'p1')).toEqual({ ok: false, reason: 'invalid-code' });
    expect(await approveCode(info, '12a456', 'p1')).toEqual({ ok: false, reason: 'invalid-code' });
    expect(bridge.seen).toHaveLength(0);
  });

  it('a wrong code comes back as no-match', async () => {
    bridge.setAnswer({ status: 404, body: { ok: false, reason: 'no-match' } });
    expect(await approveCode(info, '000000', 'p1')).toEqual({ ok: false, reason: 'no-match' });
  });
});

describe('approvalOutcome', () => {
  it('maps a result to what the window shows', () => {
    expect(approvalOutcome({ ok: true, viewer: { keyId: 'k', name: 'Pixel' } })).toEqual({ kind: 'approved', name: 'Pixel' });
    expect(approvalOutcome({ ok: false, reason: 'no-match' })).toEqual({ kind: 'mismatch' });
    expect(approvalOutcome({ ok: false, reason: 'ambiguous' })).toEqual({ kind: 'mismatch' });
    expect(approvalOutcome({ ok: false, reason: 'invalid-code' })).toEqual({ kind: 'invalid' });
    expect(approvalOutcome(new NoControlBridgeError())).toEqual({ kind: 'unreachable' });
    expect(approvalOutcome({ ok: false, reason: 'boom' })).toEqual({ kind: 'unreachable' });
  });
});
