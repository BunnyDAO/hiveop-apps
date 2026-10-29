import { describe, expect, it } from 'vitest';
import { createTakeover, parsePids, type TakeoverDeps, type TakeoverState } from './takeover';

function harness(over: Partial<TakeoverDeps> = {}) {
  const log: string[] = [];
  const states: TakeoverState[] = [];
  let agents = 0;
  let pid: number | null = 4242;
  const timers: { fn: () => void; live: boolean }[] = [];
  const deps: TakeoverDeps = {
    prepare: async () => (log.push('prepare'), true),
    findCliPid: async () => pid,
    countAgents: async () => agents,
    removeAutostart: async () => void log.push('removeAutostart'),
    terminate: async (p) => (log.push(`terminate ${p}`), (pid = null), true),
    startManaged: async () => void log.push('startManaged'),
    schedule: (fn) => {
      const t = { fn, live: true };
      timers.push(t);
      return () => (t.live = false);
    },
    pollMs: 1000,
    onState: (s) => states.push(s),
    ...over,
  };
  const t = createTakeover(deps);
  const tick = async () => {
    const due = timers.filter((x) => x.live);
    for (const x of due) {
      x.live = false;
      x.fn();
    }
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };
  return { t, log, states, tick, setAgents: (n: number) => (agents = n), setPid: (p: number | null) => (pid = p) };
}

describe('takeover', () => {
  it('with no agents: removes autostart, stops the CLI bridge, starts the managed one', async () => {
    const h = harness();
    expect(h.t.state()).toBe('idle');
    expect(await h.t.run()).toBe('done');
    expect(h.log).toEqual(['prepare', 'removeAutostart', 'terminate 4242', 'startManaged']);
    expect(h.states).toEqual(['waiting', 'switching', 'idle']);
  });

  it('with an agent running: touches nothing until it stops, then switches', async () => {
    const h = harness();
    h.setAgents(2);
    const p = h.t.run();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(h.t.state()).toBe('waiting');
    expect(h.log).toEqual(['prepare']);
    await h.tick();
    expect(h.log).toEqual(['prepare']);
    h.setAgents(0);
    await h.tick();
    expect(await p).toBe('done');
    expect(h.log).toEqual(['prepare', 'removeAutostart', 'terminate 4242', 'startManaged']);
  });

  it('an agent that starts while autostart is removed is not cut off: it waits again', async () => {
    const h = harness();
    let calls = 0;
    const h2 = harness({
      countAgents: async () => (++calls === 2 ? 1 : 0), // free on the first look, busy on the re-check before acting
    });
    const p = h2.t.run();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(h2.log).toEqual(['prepare']);
    await h2.tick();
    expect(await p).toBe('done');
    void h;
  });

  it('a managed bridge that cannot be prepared aborts before touching the CLI bridge', async () => {
    const h = harness({ prepare: async () => false });
    expect(await h.t.run()).toBe('failed');
    expect(h.t.state()).toBe('failed');
    expect(h.log).toEqual([]);
  });

  it('stops nothing when removing autostart fails', async () => {
    const h = harness({
      removeAutostart: async () => {
        throw new Error('launchctl said no');
      },
    });
    expect(await h.t.run()).toBe('failed');
    expect(h.log).toEqual(['prepare']);
    expect(h.t.state()).toBe('failed');
  });

  it('does not start the managed bridge when the CLI bridge will not stop', async () => {
    const h = harness({ terminate: async () => false });
    expect(await h.t.run()).toBe('failed');
    expect(h.log).not.toContain('startManaged');
  });

  it('autostart removal may already have stopped the bridge: nothing to terminate', async () => {
    const h = harness({
      removeAutostart: async () => {
        h.log.push('removeAutostart');
        h.setPid(null); // launchctl bootout took it down
      },
    });
    expect(await h.t.run()).toBe('done');
    expect(h.log).toEqual(['prepare', 'removeAutostart', 'startManaged']);
  });

  it('a second run while one is in flight joins it instead of starting another', async () => {
    const h = harness();
    h.setAgents(1);
    const a = h.t.run();
    const b = h.t.run();
    h.setAgents(0);
    await h.tick();
    expect(await a).toBe('done');
    expect(await b).toBe('done');
    expect(h.log.filter((l) => l === 'removeAutostart')).toHaveLength(1);
  });

  it('can be run again after a failure', async () => {
    let ok = false;
    const h = harness({ prepare: async () => ok });
    expect(await h.t.run()).toBe('failed');
    ok = true;
    expect(await h.t.run()).toBe('done');
    expect(h.t.state()).toBe('idle');
  });
});

describe('parsePids', () => {
  it('reads lsof -t output', () => expect(parsePids('123\n456\n')).toEqual([123, 456]));
  it('ignores junk and non-positive numbers', () => expect(parsePids('x\n0\n-4\n 77 \n')).toEqual([77]));
  it('is empty for nothing', () => expect(parsePids('')).toEqual([]));
});
