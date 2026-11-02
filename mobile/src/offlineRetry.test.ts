import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error plain browser module, no types
import { createRetrier, retryDelayMs } from '../www/retry.js';

describe('retryDelayMs', () => {
  it('backs off 2s, 4s, 8s ... capped at 30s', () => {
    expect([0, 1, 2, 3, 4, 5, 20].map(retryDelayMs)).toEqual([2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });
  it('treats bad input as the first attempt', () => {
    expect(retryDelayMs(-1)).toBe(2000);
    expect(retryDelayMs(NaN)).toBe(2000);
  });
});

function harness(probeResults: boolean[]) {
  const timers: Array<{ fn: () => void; ms: number; id: number; live: boolean }> = [];
  const probe = vi.fn(async () => probeResults.shift() ?? false);
  const onReachable = vi.fn();
  const r = createRetrier({
    probe,
    onReachable,
    setTimer: (fn: () => void, ms: number) => {
      const t = { fn, ms, id: timers.length, live: true };
      timers.push(t);
      return t.id;
    },
    clearTimer: (id: number) => {
      if (timers[id]) timers[id].live = false;
    },
  });
  const fire = async () => {
    const t = timers.filter((x) => x.live).pop()!;
    t.live = false;
    t.fn();
    await Promise.resolve();
    await Promise.resolve();
  };
  return { r, timers, probe, onReachable, fire };
}

describe('createRetrier', () => {
  it('schedules the first probe after 2s, then backs off while unreachable', async () => {
    const h = harness([false, false, false]);
    h.r.start();
    expect(h.timers.at(-1)!.ms).toBe(2000);
    await h.fire();
    expect(h.timers.at(-1)!.ms).toBe(4000);
    await h.fire();
    expect(h.timers.at(-1)!.ms).toBe(8000);
    expect(h.onReachable).not.toHaveBeenCalled();
  });

  it('loads the site as soon as a probe succeeds, without a tap', async () => {
    const h = harness([false, true]);
    h.r.start();
    await h.fire();
    await h.fire();
    expect(h.onReachable).toHaveBeenCalledTimes(1);
    expect(h.timers.filter((t) => t.live)).toHaveLength(0);
  });

  it('a network change probes immediately and resets the backoff', async () => {
    const h = harness([false, false, false, true]);
    h.r.start();
    await h.fire();
    await h.fire(); // now waiting 8s
    h.r.networkChanged();
    await Promise.resolve();
    await Promise.resolve();
    expect(h.probe).toHaveBeenCalledTimes(3);
    expect(h.timers.filter((t) => t.live).at(-1)!.ms).toBe(2000);
  });

  it('Try again probes now', async () => {
    const h = harness([true]);
    h.r.start();
    h.r.tryNow();
    await Promise.resolve();
    await Promise.resolve();
    expect(h.onReachable).toHaveBeenCalledTimes(1);
  });

  it('reports the seconds until the next try so the page can say so', async () => {
    const h = harness([false]);
    h.r.start();
    expect(h.r.nextInMs()).toBe(2000);
  });
});
