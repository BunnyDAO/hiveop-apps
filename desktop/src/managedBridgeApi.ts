// `hiveopDesktop.bridge.*` (dsk-10, capability `managed-bridge`). Kept apart
// from bridge.ts: that file builds the base object; this wraps it.
import type { HiveopDesktop } from './bridge';
import { isConnectToken } from './bridgeToken';

/** What the page sees: the supervisor state plus whether a token is stored and the local agent count. */
export type BridgeView =
  | { kind: 'none' | 'unpaired' | 'starting'; paired: boolean; agents: number }
  | { kind: 'running'; owner: 'managed' | 'cli'; version?: string; paired: boolean; agents: number }
  | { kind: 'crashed'; attempt: number; retryInMs: number; paired: boolean; agents: number };

export interface ManagedBridgeApi {
  /** Hand the shell a connect token for this device. False if it is malformed or cannot be stored. */
  readonly pair: (token: string) => Promise<boolean>;
  readonly state: () => Promise<BridgeView | null>;
  /** Returns an unsubscribe. */
  readonly onState: (cb: (s: BridgeView) => void) => () => void;
}

export type HiveopDesktopWithBridge = HiveopDesktop & { readonly bridge?: ManagedBridgeApi };

/** What the preload wires in from the main process (IPC). */
export interface ManagedBridgeHost {
  pair(token: string): Promise<boolean>;
  state(): Promise<unknown>;
  onState(cb: (v: unknown) => void): () => void;
}

/** Copy only known, well-typed fields; anything else is not a state. */
export function sanitizeView(v: unknown): BridgeView | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const paired = o.paired === true;
  const agents = typeof o.agents === 'number' && Number.isFinite(o.agents) && o.agents >= 0 ? Math.floor(o.agents) : 0;
  switch (o.kind) {
    case 'none':
    case 'unpaired':
    case 'starting':
      return { kind: o.kind, paired, agents };
    case 'running':
      if (o.owner !== 'managed' && o.owner !== 'cli') return null;
      return { kind: 'running', owner: o.owner, ...(typeof o.version === 'string' ? { version: o.version } : {}), paired, agents };
    case 'crashed':
      if (typeof o.attempt !== 'number' || typeof o.retryInMs !== 'number') return null;
      return { kind: 'crashed', attempt: o.attempt, retryInMs: o.retryInMs, paired, agents };
    default:
      return null;
  }
}

export function withManagedBridge(base: HiveopDesktop, host: ManagedBridgeHost | undefined): HiveopDesktopWithBridge {
  if (!host) return base;
  const bridge: ManagedBridgeApi = Object.freeze({
    pair: async (token: string) => (isConnectToken(token) ? (await host.pair(token)) === true : false),
    state: async () => sanitizeView(await host.state()),
    onState: (cb: (s: BridgeView) => void) =>
      host.onState((v) => {
        const s = sanitizeView(v);
        if (s) cb(s);
      }),
  });
  return Object.freeze({ ...base, capabilities: Object.freeze([...base.capabilities, 'managed-bridge']), bridge });
}
