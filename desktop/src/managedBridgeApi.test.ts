import { describe, expect, it } from 'vitest';
import { buildBridge } from './bridge';
import { withManagedBridge, type ManagedBridgeHost } from './managedBridgeApi';

function host(over: Partial<ManagedBridgeHost> = {}) {
  const pairs: string[] = [];
  let push: ((v: unknown) => void) | null = null;
  const h: ManagedBridgeHost = {
    pair: async (t) => (pairs.push(t), true),
    state: async () => ({ kind: 'none', paired: false, agents: 0 }),
    onState: (cb) => ((push = cb), () => (push = null)),
    ...over,
  };
  return { h, pairs, emit: (v: unknown) => push?.(v), isSubscribed: () => push !== null };
}

describe('withManagedBridge', () => {
  it('adds the managed-bridge capability next to existing ones', () => {
    const base = buildBridge('0.1.0', { onOpenTab: () => () => undefined });
    const d = withManagedBridge(base, host().h);
    expect(d.capabilities).toEqual(['native-browser', 'managed-bridge']);
    expect(d.version).toBe('0.1.0');
    expect(d.browser).toBe(base.browser);
    expect(Object.isFrozen(d)).toBe(true);
    expect(Object.isFrozen(d.bridge)).toBe(true);
  });
  it('returns the base untouched without a host', () => {
    const base = buildBridge('0.1.0');
    expect(withManagedBridge(base, undefined)).toBe(base);
  });
  it('pair only forwards well-formed connect tokens', async () => {
    const { h, pairs } = host();
    const d = withManagedBridge(buildBridge('0.1.0'), h);
    expect(await d.bridge!.pair('wm_ct_abc')).toBe(true);
    expect(await d.bridge!.pair('hello')).toBe(false);
    expect(await d.bridge!.pair(undefined as unknown as string)).toBe(false);
    expect(pairs).toEqual(['wm_ct_abc']);
  });
  it('state and onState hand the page only known, well-typed fields', async () => {
    const { h, emit } = host({
      state: async () => ({ kind: 'running', owner: 'managed', version: '0.9.0', paired: true, agents: 2, secret: 'x' } as never),
    });
    const d = withManagedBridge(buildBridge('0.1.0'), h);
    expect(await d.bridge!.state()).toEqual({ kind: 'running', owner: 'managed', version: '0.9.0', paired: true, agents: 2 });
    const seen: unknown[] = [];
    const off = d.bridge!.onState((s) => seen.push(s));
    emit({ kind: 'crashed', attempt: 2, retryInMs: 4000, paired: true, agents: 0 });
    emit({ kind: 'bogus' });
    emit('junk');
    expect(seen).toEqual([{ kind: 'crashed', attempt: 2, retryInMs: 4000, paired: true, agents: 0 }]);
    off();
  });
});
