import { describe, expect, it } from 'vitest';
import { vm } from './testVm';
import { BRIDGE_CAPABILITIES, buildBridgeScript, buildBridge, isSiteOrigin } from './shellBridge';

const SITE = 'https://app.hiveop.io';

describe('isSiteOrigin', () => {
  it.each([
    [SITE, SITE, true],
    ['https://app.hiveop.io:8443', SITE, false],
    ['http://app.hiveop.io', SITE, false],
    ['https://app.hiveop.io.evil.com', SITE, false],
    ['https://example.com', SITE, false],
    ['null', SITE, false],
    ['', SITE, false],
    ['capacitor://localhost', SITE, false],
  ])('%s vs %s', (page, site, want) => {
    expect(isSiteOrigin(page, site)).toBe(want);
  });
});

describe('buildBridge', () => {
  it('has the fixed shape', () => {
    const b = buildBridge({ version: '1.2.3', platform: 'ios', capabilities: ['open-sheet'] });
    expect(b.version).toBe('1.2.3');
    expect(b.platform).toBe('ios');
    expect(b.capabilities).toEqual(['open-sheet']);
    expect(b.has('open-sheet')).toBe(true);
    expect(b.has('push')).toBe(false);
    expect(b.has(undefined as unknown as string)).toBe(false);
  });
  it('launch capabilities include open-sheet and auth-bounce', () => {
    expect(BRIDGE_CAPABILITIES).toContain('open-sheet');
    expect(BRIDGE_CAPABILITIES).toContain('auth-bounce');
  });
});

describe('buildBridgeScript', () => {
  const run = (pageOrigin: string, platform: 'ios' | 'android' = 'android') => {
    const script = buildBridgeScript({ siteOrigin: SITE, version: '0.1.0', platform });
    return vm(script, pageOrigin) as { hiveopApp?: any };
  };

  it('defines window.hiveopApp on the site origin', () => {
    const w = run(SITE);
    expect(w.hiveopApp.version).toBe('0.1.0');
    expect(w.hiveopApp.platform).toBe('android');
    expect(w.hiveopApp.capabilities).toEqual([...BRIDGE_CAPABILITIES]);
    expect(w.hiveopApp.has('open-sheet')).toBe(true);
    expect(w.hiveopApp.has('nope')).toBe(false);
  });
  it('reports the platform it was built for', () => {
    expect(run(SITE, 'ios').hiveopApp.platform).toBe('ios');
  });
  it.each(['https://example.com', 'https://github.com', 'capacitor://localhost', 'https://app.hiveop.io.evil.com', 'null'])(
    'defines nothing on %s',
    (origin) => {
      expect('hiveopApp' in run(origin)).toBe(false);
    },
  );
  it('does not let the page mutate has() results by editing capabilities', () => {
    const w = run(SITE);
    try {
      w.hiveopApp.capabilities.push('push');
    } catch {
      /* frozen */
    }
    expect(w.hiveopApp.has('push')).toBe(false);
  });
  it('is not overwritable', () => {
    const w = run(SITE);
    try {
      w.hiveopApp = {};
    } catch {
      /* strict mode */
    }
    expect(w.hiveopApp.version).toBe('0.1.0');
  });
  it('survives odd characters in the origin/version (JSON-escaped)', () => {
    const s = buildBridgeScript({ siteOrigin: SITE, version: '1.0"</script>', platform: 'ios' });
    expect(s).not.toContain('</script>');
    expect((vm(s, SITE) as any).hiveopApp.version).toBe('1.0"</script>');
  });
});

describe('auth-bounce members', () => {
  const HO = { handoff: 'abcdefghijklmnop1234', verifier: 'VER' };
  const script = (platform: 'ios' | 'android') => buildBridgeScript({ siteOrigin: SITE, version: '1', platform });

  it('ios: bounce posts the provider to the native handler and resolves its result', async () => {
    const posted: unknown[] = [];
    const w = vm(script('ios'), SITE, {
      webkit: { messageHandlers: { hiveopAuth: { postMessage: async (m: unknown) => (posted.push(m), { result: 'cancelled' }) } } },
    }) as any;
    expect(await w.hiveopApp.bounce('github')).toBe('cancelled');
    expect(posted).toEqual([{ provider: 'github' }]);
  });

  it('ios: a returned handoff resolves opened and reaches onHandoff with the verifier', async () => {
    const w = vm(script('ios'), SITE, {
      webkit: { messageHandlers: { hiveopAuth: { postMessage: async () => ({ result: 'handoff', ...HO }) } } },
    }) as any;
    const got: unknown[] = [];
    w.hiveopApp.onHandoff((p: unknown) => got.push(p));
    expect(await w.hiveopApp.bounce('google')).toBe('opened');
    expect(got).toEqual([HO]);
  });

  it('onHandoff unsubscribes', async () => {
    const w = vm(script('ios'), SITE, {
      webkit: { messageHandlers: { hiveopAuth: { postMessage: async () => ({ result: 'handoff', ...HO }) } } },
    }) as any;
    const got: unknown[] = [];
    const off = w.hiveopApp.onHandoff((p: unknown) => got.push(p));
    off();
    await w.hiveopApp.bounce('google');
    expect(got).toEqual([]);
  });

  it('android: correlates the native message by id', async () => {
    const native: any = {
      postMessage(raw: string) {
        const m = JSON.parse(raw);
        expect(m.provider).toBe('google');
        queueMicrotask(() => native.onmessage({ data: JSON.stringify({ id: m.id, result: 'handoff', ...HO }) }));
      },
    };
    const w = vm(script('android'), SITE, { hiveopAuthNative: native }) as any;
    const got: unknown[] = [];
    w.hiveopApp.onHandoff((p: unknown) => got.push(p));
    expect(await w.hiveopApp.bounce('google')).toBe('opened');
    expect(got).toEqual([HO]);
  });

  it('android: cancelled', async () => {
    const native: any = {
      postMessage(raw: string) {
        const m = JSON.parse(raw);
        queueMicrotask(() => native.onmessage({ data: JSON.stringify({ id: m.id, result: 'cancelled' }) }));
      },
    };
    const w = vm(script('android'), SITE, { hiveopAuthNative: native }) as any;
    expect(await w.hiveopApp.bounce('github')).toBe('cancelled');
  });

  it('rejects an unknown provider and a missing transport', async () => {
    const w = vm(script('ios'), SITE) as any;
    await expect(w.hiveopApp.bounce('google')).rejects.toThrow();
    await expect(w.hiveopApp.bounce('apple')).rejects.toThrow();
  });

  it('a malformed native reply is a rejection, not a handoff', async () => {
    const w = vm(script('ios'), SITE, {
      webkit: { messageHandlers: { hiveopAuth: { postMessage: async () => ({ result: 'handoff', handoff: 5 }) } } },
    }) as any;
    await expect(w.hiveopApp.bounce('google')).rejects.toThrow();
  });
});
