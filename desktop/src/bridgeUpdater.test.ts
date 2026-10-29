import { describe, expect, it } from 'vitest';
import { createUpdater, earlyExitRollback, type UpdaterDeps } from './bridgeUpdater';
import type { InstallResult } from './bridgeInstaller';

function harness(over: Partial<UpdaterDeps> = {}) {
  const s = { current: '1.0.0' as string | undefined, running: '1.0.0' as string | undefined, agents: 0, restarts: 0, pending: [] as (string | null)[], checks: 0 };
  let result: InstallResult = { status: 'up-to-date', version: '1.0.0' };
  const timers: { ms: number; fn: () => void; live: boolean }[] = [];
  const deps: UpdaterDeps = {
    check: async () => {
      s.checks++;
      if (result.status === 'installed') s.current = result.version;
      return result;
    },
    current: () => s.current,
    running: () => s.running,
    agents: () => s.agents,
    restart: () => {
      s.restarts++;
      s.running = s.current; // the supervisor respawns from the new current
    },
    onPending: (v) => s.pending.push(v),
    schedule: (fn, ms) => {
      const t = { ms, fn, live: true };
      timers.push(t);
      return () => (t.live = false);
    },
    checkEveryMs: 3_600_000,
    pollMs: 5000,
    ...over,
  };
  const u = createUpdater(deps);
  const fire = async (ms: number) => {
    const t = timers.find((x) => x.live && x.ms === ms);
    if (!t) throw new Error(`no timer ${ms}`);
    t.live = false;
    t.fn();
    for (let i = 0; i < 8; i++) await Promise.resolve();
  };
  return { s, u, setResult: (r: InstallResult) => (result = r), fire, timers };
}

describe('updater', () => {
  it('checks hourly and does nothing when up to date', async () => {
    const h = harness();
    await h.u.checkNow();
    expect(h.s.checks).toBe(1);
    expect(h.s.restarts).toBe(0);
    h.u.start();
    await h.fire(3_600_000);
    expect(h.s.checks).toBe(2);
    expect(h.timers.some((t) => t.live && t.ms === 3_600_000)).toBe(true); // re-armed
  });

  it('swaps and restarts at once when no agent is running', async () => {
    const h = harness();
    h.setResult({ status: 'installed', version: '1.1.0' });
    await h.u.checkNow();
    expect(h.s.restarts).toBe(1);
    expect(h.s.running).toBe('1.1.0');
    expect(h.u.pending()).toBeNull();
  });

  it('waits while an agent runs, announces the pending version, then swaps once it stops', async () => {
    const h = harness();
    h.s.agents = 1;
    h.setResult({ status: 'installed', version: '1.1.0' });
    await h.u.checkNow();
    expect(h.s.restarts).toBe(0);
    expect(h.u.pending()).toBe('1.1.0');
    expect(h.s.pending.at(-1)).toBe('1.1.0');
    await h.fire(5000);
    expect(h.s.restarts).toBe(0); // still busy
    h.s.agents = 0;
    await h.fire(5000);
    expect(h.s.restarts).toBe(1);
    expect(h.u.pending()).toBeNull();
    expect(h.s.pending.at(-1)).toBeNull();
  });

  it('does not restart twice for one pending version', async () => {
    let n = 0;
    const h = harness({ restart: () => void n++ }); // a restart that has not landed: running stays old
    h.s.agents = 1;
    h.setResult({ status: 'installed', version: '1.1.0' });
    await h.u.checkNow();
    h.s.agents = 0;
    await h.fire(5000);
    await h.fire(5000);
    expect(n).toBe(1);
  });

  it('does not download again while a version is already pending', async () => {
    const h = harness();
    h.s.agents = 2;
    h.setResult({ status: 'installed', version: '1.1.0' });
    await h.u.checkNow();
    await h.u.checkNow();
    expect(h.s.checks).toBe(1);
  });

  it('a pending version on disk at app start is simply the one that runs', async () => {
    const h = harness();
    h.s.running = undefined; // nothing running yet: the first spawn reads current
    h.u.evaluate();
    expect(h.s.restarts).toBe(0);
    expect(h.u.pending()).toBeNull();
  });

  it('a failed check is quiet and tries again next hour', async () => {
    const h = harness({
      check: async () => {
        throw new Error('offline');
      },
    });
    h.u.start();
    await h.fire(3_600_000);
    expect(h.timers.some((t) => t.live && t.ms === 3_600_000)).toBe(true);
  });

  it('stop cancels timers', async () => {
    const h = harness();
    h.u.start();
    h.u.stop();
    expect(h.timers.every((t) => !t.live)).toBe(true);
  });
});

describe('earlyExitRollback', () => {
  const base = { startedAt: 0, now: 5_000, minUptimeMs: 20_000, stoppedByUs: false, code: 1 as number | null };
  it('rolls back when the version dies right after starting', () => {
    expect(earlyExitRollback(base)).toBe(true);
    expect(earlyExitRollback({ ...base, code: null })).toBe(true);
  });
  it('does not when it ran for a while', () => {
    expect(earlyExitRollback({ ...base, now: 60_000 })).toBe(false);
  });
  it('does not when we stopped it, or it exited cleanly', () => {
    expect(earlyExitRollback({ ...base, stoppedByUs: true })).toBe(false);
    expect(earlyExitRollback({ ...base, code: 0 })).toBe(false);
  });
  it('does not blame the version for a refused token', () => {
    expect(earlyExitRollback({ ...base, code: 2 })).toBe(false);
  });
});
