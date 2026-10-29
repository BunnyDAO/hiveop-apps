// Bridge update scheduling (dsk-11). Pure: the host injects the registry check,
// the supervisor restart and the clock. A newer CLI is downloaded and verified
// in the background (the installer repoints `current`, the running process is
// untouched); it only takes over when no local agent is running, otherwise at
// the next app start. A version that dies right after starting is rolled back.
import type { InstallResult } from './bridgeInstaller';
import { EXIT_TOKEN_REFUSED } from './bridgeSupervisor';

export interface UpdaterDeps {
  /** installBridge against the registry. */
  check(): Promise<InstallResult>;
  /** Version `current` points at on disk. */
  current(): string | undefined;
  /** Version of the managed bridge process we last started; undefined when none. */
  running(): string | undefined;
  agents(): number;
  /** Stop our bridge and start it again from `current`. */
  restart(): void;
  /** A downloaded version is waiting (tray: "Bridge update ready"), or null. */
  onPending(version: string | null): void;
  schedule(fn: () => void, ms: number): () => void;
  checkEveryMs: number;
  /** Delay before the first check after start; defaults to checkEveryMs. */
  firstCheckMs?: number;
  pollMs: number;
}

export interface Updater {
  start(): void;
  stop(): void;
  checkNow(): Promise<void>;
  evaluate(): void;
  pending(): string | null;
}

export function createUpdater(deps: UpdaterDeps): Updater {
  let pending: string | null = null;
  let swappingFrom: string | undefined;
  let stopped = true;
  let pollCancel: (() => void) | null = null;
  let checkCancel: (() => void) | null = null;

  function evaluate(): void {
    pollCancel?.();
    pollCancel = null;
    const cur = deps.current();
    const run = deps.running();
    if (swappingFrom !== undefined && run !== swappingFrom) swappingFrom = undefined;
    const next = cur && run && cur !== run ? cur : null;
    if (next && deps.agents() === 0 && swappingFrom === undefined) {
      swappingFrom = run; // idle: swap now, no announcement needed
      deps.restart();
      evaluate(); // the restart may have landed already
      return;
    }
    if (next !== pending) {
      pending = next;
      deps.onPending(pending);
    }
    if (pending) pollCancel = deps.schedule(evaluate, deps.pollMs);
  }

  async function checkNow(): Promise<void> {
    if (pending) return; // one waiting is enough
    try {
      await deps.check();
    } catch {
      /* offline: next hour */
    }
    evaluate();
  }

  function armCheck(ms: number): void {
    checkCancel = deps.schedule(() => {
      void checkNow().finally(() => {
        if (!stopped) armCheck(deps.checkEveryMs);
      });
    }, ms);
  }

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      evaluate();
      armCheck(deps.firstCheckMs ?? deps.checkEveryMs);
    },
    stop() {
      stopped = true;
      pollCancel?.();
      checkCancel?.();
      pollCancel = checkCancel = null;
    },
    checkNow,
    evaluate,
    pending: () => pending,
  };
}

/**
 * True when a bridge process that exited was the new version failing, not us
 * stopping it, a clean exit, or the server refusing the token.
 */
export function earlyExitRollback(i: {
  startedAt: number;
  now: number;
  minUptimeMs: number;
  stoppedByUs: boolean;
  code: number | null;
}): boolean {
  if (i.stoppedByUs || i.code === 0 || i.code === EXIT_TOKEN_REFUSED) return false;
  return i.now - i.startedAt < i.minUptimeMs;
}
