import { describe, expect, it } from 'vitest';
import { createPairingWatcher, type WatcherDeps } from './pairingWatcher';
import type { ControlInfo, PendingPairing } from './viewerControlClient';

const INFO: ControlInfo = { port: 1, token: 't', pid: 1 };
const p = (id: string): PendingPairing => ({ pairingId: id, name: `dev ${id}`, keyId: `k${id}`, expiresAt: '' });

function harness(over: Partial<WatcherDeps> = {}) {
  let info: ControlInfo | null = INFO;
  let list: PendingPairing[] = [];
  let fail = false;
  const events: string[] = [];
  const timers: { fn: () => void; ms: number; live: boolean }[] = [];
  const w = createPairingWatcher({
    readInfo: () => info,
    fetchPending: async () => {
      if (fail) throw new Error('down');
      return list;
    },
    schedule: (fn, ms) => {
      const t = { fn, ms, live: true };
      timers.push(t);
      return () => (t.live = false);
    },
    onNew: (x) => events.push(`new ${x.pairingId}`),
    onGone: (id) => events.push(`gone ${id}`),
    ...over,
  });
  return {
    w,
    events,
    timers,
    setInfo: (i: ControlInfo | null) => (info = i),
    setList: (l: PendingPairing[]) => (list = l),
    setFail: (f: boolean) => (fail = f),
  };
}

describe('pairingWatcher', () => {
  it('polls slowly while no bridge has a control file, every 2s while one does', async () => {
    const h = harness();
    h.setInfo(null);
    expect(await h.w.poll()).toBe(10_000);
    h.setInfo(INFO);
    expect(await h.w.poll()).toBe(2000);
  });

  it('reports a new pairing once, and when it goes away', async () => {
    const h = harness();
    h.setList([p('a')]);
    await h.w.poll();
    await h.w.poll();
    h.setList([p('a'), p('b')]);
    await h.w.poll();
    h.setList([p('b')]);
    await h.w.poll();
    expect(h.events).toEqual(['new a', 'new b', 'gone a']);
    expect(h.w.get('b')?.name).toBe('dev b');
    expect(h.w.get('a')).toBeUndefined();
  });

  it('backs off on errors without dropping what it knows (an open dialog stays open)', async () => {
    const h = harness();
    h.setList([p('a')]);
    await h.w.poll();
    h.setFail(true);
    expect(await h.w.poll()).toBe(4000);
    expect(await h.w.poll()).toBe(8000);
    expect(await h.w.poll()).toBe(16_000);
    expect(await h.w.poll()).toBe(30_000);
    expect(await h.w.poll()).toBe(30_000);
    expect(h.events).toEqual(['new a']);
    h.setFail(false);
    h.setList([p('a')]);
    expect(await h.w.poll()).toBe(2000);
    expect(h.events).toEqual(['new a']);
  });

  it('the bridge stopping (control file gone) ends every pairing', async () => {
    const h = harness();
    h.setList([p('a'), p('b')]);
    await h.w.poll();
    h.setInfo(null);
    await h.w.poll();
    expect(h.events).toEqual(['new a', 'new b', 'gone a', 'gone b']);
  });

  it('start schedules the next poll; stop cancels it', async () => {
    const h = harness();
    h.w.start();
    await new Promise((r) => setTimeout(r, 0));
    expect(h.timers).toHaveLength(1);
    expect(h.timers[0].ms).toBe(2000);
    h.w.stop();
    expect(h.timers[0].live).toBe(false);
  });
});
