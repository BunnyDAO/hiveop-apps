import { describe, expect, it } from 'vitest';
import { createSupervisor, type BridgeState, type Child, type Discovery, type SupervisorDeps } from './bridgeSupervisor';

function harness(over: Partial<SupervisorDeps> = {}) {
  let discovery: Discovery | null = null;
  let token = true;
  let now = 0;
  let agentCount = 0;
  const timers: { at: number; fn: () => void; live: boolean }[] = [];
  const children: (Child & { exit(code: number | null): void; killed: number; pid: number })[] = [];
  const states: BridgeState[] = [];
  const deps: SupervisorDeps = {
    discover: async () => discovery,
    hasToken: () => token,
    spawn: () => {
      let cb: (c: number | null) => void = () => undefined;
      const child = {
        pid: 100 + children.length,
        killed: 0,
        kill() {
          child.killed++;
        },
        onExit(f: (c: number | null) => void) {
          cb = f;
        },
        exit(code: number | null) {
          cb(code);
        },
      };
      children.push(child);
      return child;
    },
    countAgents: async () => agentCount,
    schedule: (fn, ms) => {
      const t = { at: now + ms, fn, live: true };
      timers.push(t);
      return () => {
        t.live = false;
      };
    },
    backoffMs: (n) => 1000 * 2 ** n,
    pollMs: 1000,
    startTimeoutMs: 5000,
    ...over,
  };
  const sup = createSupervisor(deps);
  sup.onState((s) => states.push(s));
  const flush = async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  };
  async function advance(ms: number) {
    const end = now + ms;
    for (;;) {
      const due = timers.filter((t) => t.live && t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      now = due.at;
      due.live = false;
      due.fn();
      await flush();
    }
    now = end;
    await flush();
  }
  return {
    sup,
    children,
    states,
    advance,
    flush,
    setDiscovery: (d: Discovery | null) => (discovery = d),
    setToken: (b: boolean) => (token = b),
    setAgents: (n: number) => (agentCount = n),
  };
}

describe('bridge supervisor', () => {
  it('starts none, and with no token and no bridge reports unpaired without spawning', async () => {
    const h = harness();
    expect(h.sup.state()).toEqual({ kind: 'none' });
    h.setToken(false);
    await h.sup.start();
    expect(h.sup.state()).toEqual({ kind: 'unpaired' });
    expect(h.children).toHaveLength(0);
  });

  it('spawns the managed bridge and goes starting -> running(managed) once /discovery answers', async () => {
    const h = harness();
    await h.sup.start();
    expect(h.sup.state()).toEqual({ kind: 'starting' });
    expect(h.children).toHaveLength(1);
    h.setDiscovery({ managed: true, version: '0.9.0' });
    await h.advance(1000);
    expect(h.sup.state()).toEqual({ kind: 'running', owner: 'managed', version: '0.9.0' });
  });

  it('detects an existing CLI bridge, reports running(cli), and never spawns or kills', async () => {
    const h = harness();
    h.setDiscovery({ managed: false, version: '0.8.15' });
    await h.sup.start();
    expect(h.sup.state()).toEqual({ kind: 'running', owner: 'cli', version: '0.8.15' });
    expect(h.children).toHaveLength(0);
    await h.advance(10_000);
    expect(h.children).toHaveLength(0);
    h.sup.stop();
    expect(h.sup.state()).toEqual({ kind: 'none' });
  });

  it('a CLI bridge that goes away is replaced by the managed one', async () => {
    const h = harness();
    h.setDiscovery({ managed: false });
    await h.sup.start();
    h.setDiscovery(null);
    await h.advance(1000);
    expect(h.children).toHaveLength(1);
    expect(h.sup.state()).toEqual({ kind: 'starting' });
  });

  it('restarts a crashed bridge with growing backoff, and resets after it runs', async () => {
    const h = harness();
    await h.sup.start();
    h.setDiscovery({ managed: true });
    await h.advance(1000);
    h.setDiscovery(null);
    h.children[0].exit(1);
    expect(h.sup.state()).toEqual({ kind: 'crashed', attempt: 1, retryInMs: 1000 });
    await h.advance(999);
    expect(h.children).toHaveLength(1);
    await h.advance(1);
    expect(h.children).toHaveLength(2);
    h.children[1].exit(1); // never became ready
    expect(h.sup.state()).toEqual({ kind: 'crashed', attempt: 2, retryInMs: 2000 });
    await h.advance(2000);
    expect(h.children).toHaveLength(3);
    h.setDiscovery({ managed: true });
    await h.advance(1000);
    expect(h.sup.state().kind).toBe('running');
    h.setDiscovery(null);
    h.children[2].exit(null);
    expect(h.sup.state()).toEqual({ kind: 'crashed', attempt: 1, retryInMs: 1000 });
  });

  it('exit code 2 means the token was refused: unpaired, no restart loop', async () => {
    const h = harness();
    await h.sup.start();
    h.children[0].exit(2);
    expect(h.sup.state()).toEqual({ kind: 'unpaired' });
    await h.advance(60_000);
    expect(h.children).toHaveLength(1);
  });

  it('a bridge that never answers is killed after the start timeout', async () => {
    const h = harness();
    await h.sup.start();
    await h.advance(5000);
    expect(h.children[0].killed).toBe(1);
    h.children[0].exit(null);
    expect(h.sup.state().kind).toBe('crashed');
  });

  it('pairing from unpaired starts the bridge; pairing over a running one restarts it at once', async () => {
    const h = harness();
    h.setToken(false);
    await h.sup.start();
    h.setToken(true);
    await h.sup.tokenChanged();
    expect(h.children).toHaveLength(1);
    h.setDiscovery({ managed: true });
    await h.advance(1000);
    await h.sup.tokenChanged();
    expect(h.children[0].killed).toBe(1);
    h.setDiscovery(null);
    h.children[0].exit(null);
    await h.flush();
    expect(h.children).toHaveLength(2);
    expect(h.sup.state()).toEqual({ kind: 'starting' });
  });

  it('a token arriving before start() just starts it', async () => {
    const h = harness();
    await h.sup.tokenChanged();
    expect(h.sup.state()).toEqual({ kind: 'starting' });
    expect(h.children).toHaveLength(1);
  });

  it('counts local agents from the managed bridge only, and zero otherwise', async () => {
    const h = harness();
    await h.sup.start();
    h.setDiscovery({ managed: true });
    h.setAgents(3);
    await h.advance(1000);
    await h.advance(1000);
    expect(h.sup.localAgents()).toBe(3);
    h.setDiscovery(null);
    h.children[0].exit(1);
    expect(h.sup.localAgents()).toBe(0);
    const cli = harness();
    cli.setDiscovery({ managed: false });
    cli.setAgents(5);
    await cli.sup.start();
    await cli.advance(3000);
    expect(cli.sup.localAgents()).toBe(0);
  });

  it('stop kills only its own child and goes none', async () => {
    const h = harness();
    await h.sup.start();
    h.sup.stop();
    expect(h.children[0].killed).toBe(1);
    expect(h.sup.state()).toEqual({ kind: 'none' });
    h.children[0].exit(null);
    await h.advance(60_000);
    expect(h.children).toHaveLength(1);
  });

  it('emits each distinct state once', async () => {
    const h = harness();
    await h.sup.start();
    h.setDiscovery({ managed: true });
    await h.advance(3000);
    expect(h.states.map((s) => s.kind)).toEqual(['starting', 'running']);
  });
});

describe('bridge supervisor — restart and recheck (dsk-11/12)', () => {
  it('restart kills our bridge and starts a fresh one without backoff', async () => {
    const h = harness();
    await h.sup.start();
    h.setDiscovery({ managed: true, version: '1.0.0' });
    await h.advance(1000);
    h.setDiscovery(null);
    h.sup.restart();
    expect(h.children[0].killed).toBe(1);
    h.children[0].exit(null);
    await h.flush();
    expect(h.children).toHaveLength(2);
    expect(h.sup.state()).toEqual({ kind: 'starting' });
  });

  it('restart does nothing for a CLI bridge', async () => {
    const h = harness();
    h.setDiscovery({ managed: false });
    await h.sup.start();
    h.sup.restart();
    expect(h.children).toHaveLength(0);
  });

  it('recheck after the CLI bridge stopped starts the managed one at once', async () => {
    const h = harness();
    h.setDiscovery({ managed: false });
    await h.sup.start();
    h.setDiscovery(null);
    await h.sup.recheck();
    expect(h.children).toHaveLength(1);
    expect(h.sup.state()).toEqual({ kind: 'starting' });
  });
});
