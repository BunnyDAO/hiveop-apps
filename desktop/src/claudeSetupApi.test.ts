import { describe, expect, it } from 'vitest';
import { buildBridge } from './bridge';
import { withClaudeSetup, type ClaudeSetupHost } from './claudeSetupApi';
import { withManagedBridge } from './managedBridgeApi';

function host(over: Partial<ClaudeSetupHost> = {}) {
  let push: ((v: unknown) => void) | null = null;
  const calls: string[] = [];
  const h: ClaudeSetupHost = {
    state: async () => ({ kind: 'unknown', canInstallGit: true }),
    ensure: async () => (calls.push('ensure'), { kind: 'ready', source: 'app' }),
    installGit: async () => (calls.push('installGit'), true),
    onState: (cb) => ((push = cb), () => (push = null)),
    ...over,
  };
  return { h, calls, emit: (v: unknown) => push?.(v) };
}

describe('withClaudeSetup', () => {
  it('adds the claude-setup capability next to the others, frozen', () => {
    const base = withManagedBridge(buildBridge('0.1.0'), undefined);
    const d = withClaudeSetup(base, host().h);
    expect(d.capabilities).toContain('claude-setup');
    expect(Object.isFrozen(d.claude)).toBe(true);
    expect(d.version).toBe('0.1.0');
  });
  it('returns the base untouched without a host', () => {
    const base = buildBridge('0.1.0');
    expect(withClaudeSetup(base, undefined)).toBe(base);
  });
  it('hands the page only known, well-typed fields', async () => {
    const { h, emit } = host({ state: async () => ({ kind: 'failed', detail: 'boom', canInstallGit: false, secret: 'x' } as never) });
    const d = withClaudeSetup(buildBridge('0.1.0'), h);
    expect(await d.claude!.state()).toEqual({ kind: 'failed', detail: 'boom', canInstallGit: false });
    const seen: unknown[] = [];
    d.claude!.onState((s) => seen.push(s));
    emit({ kind: 'installing', canInstallGit: true });
    emit({ kind: 'nope' });
    emit(7);
    expect(seen).toEqual([{ kind: 'installing', canInstallGit: true }]);
  });
  it('ensure returns the resulting view; installGit returns a boolean', async () => {
    const { h, calls } = host();
    const d = withClaudeSetup(buildBridge('0.1.0'), h);
    expect(await d.claude!.ensure()).toEqual({ kind: 'ready', source: 'app', canInstallGit: false });
    expect(await d.claude!.installGit()).toBe(true);
    expect(calls).toEqual(['ensure', 'installGit']);
  });
  it('a ready view keeps its source', async () => {
    const { h } = host({ state: async () => ({ kind: 'ready', source: 'user', canInstallGit: false }) });
    expect(await withClaudeSetup(buildBridge('0.1.0'), h).claude!.state()).toEqual({ kind: 'ready', source: 'user', canInstallGit: false });
  });
});
