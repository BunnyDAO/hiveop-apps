// Taking over a CLI bridge (dsk-12). The user said yes: HiveOp should manage the
// bridge from now on. Order matters and every step can fail without harm:
//   prepare (managed bridge installed) -> wait for zero agents -> remove the
//   CLI's autostart -> make sure the CLI bridge is stopped -> start ours.
// Agents are never cut off: the wait comes before anything is touched, and the
// count is looked at once more right before acting. All effects are injected.

export type TakeoverState = 'idle' | 'waiting' | 'switching' | 'failed';

export interface TakeoverDeps {
  /** The managed bridge is installed and a token is stored. False aborts before anything is touched. */
  prepare(): Promise<boolean>;
  /** The process listening on the bridge port, or null when nothing does. */
  findCliPid(): Promise<number | null>;
  countAgents(pid: number): Promise<number>;
  /** Remove the CLI's login autostart (macOS LaunchAgent). Throws if it could not. */
  removeAutostart(): Promise<void>;
  /** SIGTERM the exact pid, then verify it is gone. False if it is still there. */
  terminate(pid: number): Promise<boolean>;
  startManaged(): Promise<void>;
  schedule(fn: () => void, ms: number): () => void;
  pollMs: number;
  onState(s: TakeoverState): void;
}

export interface Takeover {
  state(): TakeoverState;
  /** Joins a run already in flight. */
  run(): Promise<'done' | 'failed'>;
}

/** Positive integers, one per line, as `lsof -t` prints them. */
export function parsePids(out: string): number[] {
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^\d+$/.test(l))
    .map(Number)
    .filter((n) => n > 0);
}

export function createTakeover(deps: TakeoverDeps): Takeover {
  let state: TakeoverState = 'idle';
  let inFlight: Promise<'done' | 'failed'> | null = null;
  const set = (s: TakeoverState): void => {
    if (s === state) return;
    state = s;
    deps.onState(s);
  };
  const sleep = (): Promise<void> => new Promise((r) => void deps.schedule(r, deps.pollMs));

  /** Zero agents on two looks in a row, so one starting right now is not cut off. */
  async function idle(): Promise<void> {
    for (;;) {
      const pid = await deps.findCliPid();
      if (pid === null) return; // nothing to wait for
      if ((await deps.countAgents(pid)) === 0 && (await deps.countAgents(pid)) === 0) return;
      await sleep();
    }
  }

  async function go(): Promise<'done' | 'failed'> {
    try {
      set('waiting');
      if (!(await deps.prepare())) throw new Error('managed bridge not ready');
      await idle();
      set('switching');
      await deps.removeAutostart();
      // Removing the job may already have stopped the bridge; otherwise stop the exact listener.
      const pid = await deps.findCliPid();
      if (pid !== null && !(await deps.terminate(pid))) throw new Error('CLI bridge did not stop');
      await deps.startManaged();
      set('idle');
      return 'done';
    } catch {
      set('failed');
      return 'failed';
    }
  }

  return {
    state: () => state,
    run() {
      inFlight ??= go().finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
  };
}
