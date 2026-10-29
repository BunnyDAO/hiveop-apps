// Bridge supervisor (dsk-10): a state machine over one local bridge.
//   none -> starting -> running(managed | cli) -> crashed(backoff) -> starting
// It never touches a CLI bridge (takeover is dsk-12). All effects are injected,
// so the machine is tested with a fake bridge, fake clock and fake process.

export interface Discovery {
  managed: boolean;
  version?: string;
}

export interface Child {
  pid: number | undefined;
  kill(): void;
  onExit(cb: (code: number | null) => void): void;
}

export type BridgeState =
  | { kind: 'none' }
  | { kind: 'unpaired' } // no token yet, or the bridge refused it
  | { kind: 'starting' }
  | { kind: 'running'; owner: 'managed' | 'cli'; version?: string }
  | { kind: 'crashed'; attempt: number; retryInMs: number };

export interface SupervisorDeps {
  /** GET /discovery; null when nothing answers. */
  discover(): Promise<Discovery | null>;
  hasToken(): boolean;
  spawn(): Child;
  /** Running local agents under the managed bridge process. */
  countAgents(pid: number): Promise<number>;
  schedule(fn: () => void, ms: number): () => void;
  backoffMs(attempt: number): number;
  pollMs: number;
  startTimeoutMs: number;
}

export const EXIT_TOKEN_REFUSED = 2;

export interface Supervisor {
  state(): BridgeState;
  localAgents(): number;
  start(): Promise<void>;
  /** The stored token changed (paired, re-paired). */
  tokenChanged(): Promise<void>;
  /** Stop our own bridge, if any. A CLI bridge is left alone. */
  stop(): void;
  onState(cb: (s: BridgeState) => void): () => void;
}

const same = (a: BridgeState, b: BridgeState): boolean => JSON.stringify(a) === JSON.stringify(b);

export function createSupervisor(deps: SupervisorDeps): Supervisor {
  let state: BridgeState = { kind: 'none' };
  let agents = 0;
  let child: Child | null = null;
  let attempt = 0;
  let restarting = false;
  let stopped = true;
  let gen = 0; // bumps on stop/start so stale async results are dropped
  const cancels = new Set<() => void>();
  const listeners = new Set<(s: BridgeState) => void>();

  const set = (s: BridgeState): void => {
    if (same(state, s)) return;
    state = s;
    for (const l of [...listeners]) l(s);
  };
  const later = (fn: () => void, ms: number): void => {
    let cancel: () => void = () => undefined;
    cancel = deps.schedule(() => {
      cancels.delete(cancel);
      fn();
    }, ms);
    cancels.add(cancel);
  };
  const clearTimers = (): void => {
    for (const c of cancels) c();
    cancels.clear();
  };

  async function settle(): Promise<void> {
    const my = gen;
    const d = await deps.discover();
    if (my !== gen) return;
    if (d) {
      attempt = 0;
      set({ kind: 'running', owner: d.managed ? 'managed' : 'cli', ...(d.version ? { version: d.version } : {}) });
      watch();
      return;
    }
    if (!deps.hasToken()) {
      set({ kind: 'unpaired' });
      return;
    }
    launch();
  }

  function launch(): void {
    set({ kind: 'starting' });
    const mine = deps.spawn();
    child = mine;
    mine.onExit((code) => onExit(mine, code));
    const t0 = gen;
    let waited = 0;
    const probe = (): void => {
      if (t0 !== gen || child !== mine) return;
      void deps.discover().then((d) => {
        if (t0 !== gen || child !== mine) return;
        if (d) {
          attempt = 0;
          if (!d.managed) {
            // Someone else's bridge owns the port; ours will fail to bind. Leave theirs be.
            child = null;
            mine.kill();
          }
          set({ kind: 'running', owner: d.managed ? 'managed' : 'cli', ...(d.version ? { version: d.version } : {}) });
          watch();
          return;
        }
        waited += deps.pollMs;
        if (waited >= deps.startTimeoutMs) mine.kill();
        else later(probe, deps.pollMs);
      });
    };
    later(probe, deps.pollMs);
  }

  function onExit(who: Child, code: number | null): void {
    if (child !== who) return;
    child = null;
    agents = 0;
    clearTimers();
    if (stopped) return;
    if (restarting) {
      restarting = false;
      attempt = 0;
      void settle();
      return;
    }
    if (code === EXIT_TOKEN_REFUSED) {
      set({ kind: 'unpaired' });
      return;
    }
    attempt += 1;
    const retryInMs = deps.backoffMs(attempt - 1);
    set({ kind: 'crashed', attempt, retryInMs });
    const my = gen;
    later(() => {
      if (my === gen) void settle();
    }, retryInMs);
  }

  /** While running: notice a vanished bridge and count agents. */
  function watch(): void {
    const my = gen;
    const tick = (): void => {
      if (my !== gen || state.kind !== 'running') return;
      void (async () => {
        const owned = child;
        if (!owned) {
          // A bridge we did not spawn (CLI, or a managed one left by an earlier run).
          const d = await deps.discover();
          if (my !== gen) return;
          if (!d) {
            clearTimers();
            await settle();
            return;
          }
        }
        if (owned && owned.pid !== undefined) {
          const n = await deps.countAgents(owned.pid).catch(() => 0);
          if (my === gen && child === owned) agents = n;
        }
        if (my === gen && state.kind === 'running') later(tick, deps.pollMs);
      })();
    };
    later(tick, deps.pollMs);
  }

  return {
    state: () => state,
    localAgents: () => (state.kind === 'running' && state.owner === 'managed' ? agents : 0),
    async start() {
      if (!stopped) return;
      stopped = false;
      gen++;
      await settle();
    },
    async tokenChanged() {
      if (stopped) return this.start();
      if (child) {
        restarting = true;
        child.kill();
        return;
      }
      if (state.kind === 'unpaired' || state.kind === 'none' || state.kind === 'crashed') {
        gen++;
        clearTimers();
        await settle();
      }
    },
    stop() {
      stopped = true;
      gen++;
      clearTimers();
      const c = child;
      child = null;
      agents = 0;
      c?.kill();
      set({ kind: 'none' });
    },
    onState(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
