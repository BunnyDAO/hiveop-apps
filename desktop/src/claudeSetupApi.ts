// `hiveopDesktop.claude.*` (dsk-13, capability `claude-setup`).
import type { HiveopDesktop } from './bridge';

export type ClaudeView =
  | { kind: 'unknown' | 'installing' | 'git-missing'; canInstallGit: boolean }
  | { kind: 'ready'; source: 'user' | 'app'; canInstallGit: boolean }
  | { kind: 'failed'; detail: string; canInstallGit: boolean };

export interface ClaudeSetupApi {
  readonly state: () => Promise<ClaudeView | null>;
  /** Check git and claude, installing claude if needed. Also the "Try again". Resolves with the result. */
  readonly ensure: () => Promise<ClaudeView | null>;
  /** macOS only: opens Apple's developer-tools installer. Only ever from a click; false elsewhere. */
  readonly installGit: () => Promise<boolean>;
  readonly onState: (cb: (v: ClaudeView) => void) => () => void;
}

export type HiveopDesktopWithClaude = HiveopDesktop & { readonly claude?: ClaudeSetupApi };

export interface ClaudeSetupHost {
  state(): Promise<unknown>;
  ensure(): Promise<unknown>;
  installGit(): Promise<boolean>;
  onState(cb: (v: unknown) => void): () => void;
}

export function sanitizeClaudeView(v: unknown): ClaudeView | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const canInstallGit = o.canInstallGit === true;
  switch (o.kind) {
    case 'unknown':
    case 'installing':
    case 'git-missing':
      return { kind: o.kind, canInstallGit };
    case 'ready':
      return o.source === 'user' || o.source === 'app' ? { kind: 'ready', source: o.source, canInstallGit } : null;
    case 'failed':
      return { kind: 'failed', detail: typeof o.detail === 'string' ? o.detail.slice(0, 300) : '', canInstallGit };
    default:
      return null;
  }
}

export function withClaudeSetup<T extends HiveopDesktop>(base: T, host: ClaudeSetupHost | undefined): T & { readonly claude?: ClaudeSetupApi } {
  if (!host) return base;
  const claude: ClaudeSetupApi = Object.freeze({
    state: async () => sanitizeClaudeView(await host.state()),
    ensure: async () => sanitizeClaudeView(await host.ensure()),
    installGit: async () => (await host.installGit()) === true,
    onState: (cb: (v: ClaudeView) => void) =>
      host.onState((v) => {
        const s = sanitizeClaudeView(v);
        if (s) cb(s);
      }),
  });
  return Object.freeze({ ...base, capabilities: Object.freeze([...base.capabilities, 'claude-setup']), claude });
}
