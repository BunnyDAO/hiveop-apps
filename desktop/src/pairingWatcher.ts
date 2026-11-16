// ryc (PRD reach-your-computer D3) — notices a phone asking to pair with this Mac.
// Polls the bridge's control route only while a bridge with relay dial-out is running (its
// control file exists): every 2s then, slower when there is none, backing off on errors.
// Electron-free so it is tested with fakes; devicesUi.ts wires it to windows.
import type { ControlInfo, PendingPairing } from './viewerControlClient';

export interface WatcherDeps {
  readInfo(): ControlInfo | null;
  fetchPending(info: ControlInfo): Promise<PendingPairing[]>;
  schedule(fn: () => void, ms: number): () => void;
  /** A pairing appeared that we have not shown yet. */
  onNew(p: PendingPairing): void;
  /** A pairing we saw is no longer pending (approved elsewhere, expired, bridge gone). */
  onGone(pairingId: string): void;
  activeMs?: number;
  idleMs?: number;
  maxBackoffMs?: number;
}

export interface PairingWatcher {
  start(): void;
  stop(): void;
  /** One poll now; resolves with the delay chosen for the next one. */
  poll(): Promise<number>;
  /** The current pending entry for an id, or undefined. */
  get(pairingId: string): PendingPairing | undefined;
}

export function createPairingWatcher(d: WatcherDeps): PairingWatcher {
  const activeMs = d.activeMs ?? 2000;
  const idleMs = d.idleMs ?? 10_000;
  const maxBackoffMs = d.maxBackoffMs ?? 30_000;
  let current = new Map<string, PendingPairing>();
  let failures = 0;
  let cancel: (() => void) | null = null;
  let running = false;
  let inFlight = false;

  const replace = (next: PendingPairing[]): void => {
    const fresh = new Map(next.map((p) => [p.pairingId, p]));
    const prev = current;
    current = fresh;
    for (const id of prev.keys()) if (!fresh.has(id)) d.onGone(id);
    for (const [id, p] of fresh) if (!prev.has(id)) d.onNew(p);
  };

  async function poll(): Promise<number> {
    const info = d.readInfo();
    if (!info) {
      failures = 0;
      replace([]);
      return idleMs;
    }
    try {
      const list = await d.fetchPending(info);
      failures = 0;
      replace(list);
      return activeMs;
    } catch {
      // A blip keeps what we had: clearing would close an open dialog and re-pop it next poll.
      // The bridge going away for good shows up as its control file disappearing.
      failures++;
      return Math.min(activeMs * 2 ** failures, maxBackoffMs);
    }
  }

  const tick = async (): Promise<void> => {
    cancel = null;
    if (!running || inFlight) return;
    inFlight = true;
    let next = activeMs;
    try {
      next = await poll();
    } finally {
      inFlight = false;
    }
    if (running) cancel = d.schedule(() => void tick(), next);
  };

  return {
    start() {
      if (running) return;
      running = true;
      void tick();
    },
    stop() {
      running = false;
      cancel?.();
      cancel = null;
    },
    poll,
    get: (id) => current.get(id),
  };
}
