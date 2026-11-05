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
  it('launch capabilities include open-sheet, auth-bounce and storefront', () => {
    expect(BRIDGE_CAPABILITIES).toEqual(['open-sheet', 'auth-bounce', 'storefront', 'push', 'open-settings', 'apple-sign-in']);
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
    expect(w.hiveopApp.capabilities).toEqual(BRIDGE_CAPABILITIES.filter((c) => c !== 'apple-sign-in')); // Android: web flow
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
      w.hiveopApp.capabilities.push('teleport');
    } catch {
      /* frozen */
    }
    expect(w.hiveopApp.has('teleport')).toBe(false);
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

describe('storefront capability (ph-08)', () => {
  type Sent = { m: string; a: any };
  /** iOS: webkit.messageHandlers.hiveop.postMessage returns a Promise (WKScriptMessageHandlerWithReply). */
  const ios = (reply: (m: Sent) => unknown) => {
    const sent: Sent[] = [];
    const extra = { webkit: { messageHandlers: { hiveop: { postMessage: (m: Sent) => { sent.push(m); return Promise.resolve(reply(m)); } } } } };
    const script = buildBridgeScript({ siteOrigin: SITE, version: '0.1.0', platform: 'ios' });
    return { app: (vm(script, SITE, extra) as any).hiveopApp, sent };
  };
  /** Android: hiveopNative.postMessage(json) answers later through .onmessage({data: json}). */
  const android = (reply: (m: any) => { ok: boolean; value?: unknown; error?: string }) => {
    const sent: any[] = [];
    const channel: any = {
      onmessage: null as null | ((e: { data: string }) => void),
      postMessage(json: string) {
        const m = JSON.parse(json);
        sent.push(m);
        queueMicrotask(() => channel.onmessage?.({ data: JSON.stringify({ id: m.id, ...reply(m) }) }));
      },
    };
    const script = buildBridgeScript({ siteOrigin: SITE, version: '0.1.0', platform: 'android' });
    return { app: (vm(script, SITE, { hiveopNative: channel }) as any).hiveopApp, sent };
  };

  it('is advertised and has() it', () => {
    const { app } = ios(() => ({}));
    expect(app.capabilities).toContain('storefront');
    expect(app.has('storefront')).toBe(true);
    expect(typeof app.storefront).toBe('function');
    expect(typeof app.openExternal).toBe('function');
  });

  it('iOS: converts the StoreKit alpha-3 storefront to alpha-2', async () => {
    const { app, sent } = ios(() => ({ country: 'USA' }));
    await expect(app.storefront()).resolves.toEqual({ country: 'US' });
    expect(sent).toEqual([{ m: 'storefront', a: null }]);
    const de = ios(() => ({ country: 'DEU' }));
    await expect(de.app.storefront()).resolves.toEqual({ country: 'DE' });
  });

  it('Android: passes the Play Billing alpha-2 through, uppercase', async () => {
    const { app, sent } = android(() => ({ ok: true, value: { country: 'us' } }));
    await expect(app.storefront()).resolves.toEqual({ country: 'US' });
    expect(sent[0].m).toBe('storefront');
  });

  it.each([null, '', 'ZZZ', 'USAA', 7, undefined])('an unknown or odd country (%s) is null', async (country) => {
    await expect(ios(() => ({ country })).app.storefront()).resolves.toEqual({ country: null });
    await expect(ios(() => null).app.storefront()).resolves.toEqual({ country: null });
  });

  it('openExternal sends https URLs to the shell and nothing else', async () => {
    const { app, sent } = ios(() => null);
    await app.openExternal('https://hiveop.io/?from=app#pricing');
    expect(sent).toEqual([{ m: 'openExternal', a: { url: 'https://hiveop.io/?from=app#pricing' } }]);
    for (const bad of ['http://hiveop.io', 'javascript:alert(1)', 'intent://x', 'file:///etc/passwd', 'data:text/html,x', '//hiveop.io', '', 7, null]) {
      await expect(app.openExternal(bad)).rejects.toThrow();
    }
    expect(sent).toHaveLength(1);
  });

  it('Android: correlates concurrent calls and surfaces native errors', async () => {
    const { app } = android((m) => (m.m === 'openExternal' ? { ok: false, error: 'blocked' } : { ok: true, value: { country: 'US' } }));
    const [sf, open] = await Promise.allSettled([app.storefront(), app.openExternal('https://hiveop.io/')]);
    expect(sf).toMatchObject({ status: 'fulfilled', value: { country: 'US' } });
    expect(open.status).toBe('rejected');
  });

  it('without a native channel the calls reject (the site reads that as unknown)', async () => {
    const script = buildBridgeScript({ siteOrigin: SITE, version: '0.1.0', platform: 'android' });
    const app = (vm(script, SITE) as any).hiveopApp;
    await expect(app.storefront()).rejects.toThrow();
    await expect(app.openExternal('https://hiveop.io/')).rejects.toThrow();
  });

  it('exposes nothing off the site origin', () => {
    const script = buildBridgeScript({ siteOrigin: SITE, version: '0.1.0', platform: 'ios' });
    expect('hiveopApp' in (vm(script, 'https://evil.example', { webkit: { messageHandlers: { hiveop: { postMessage: () => Promise.resolve({}) } } } }))).toBe(false);
  });
});

describe('apple-sign-in capability (ph-06)', () => {
  type Sent = { m: string; a: any };
  const ios = (reply: (m: Sent) => unknown) => {
    const sent: Sent[] = [];
    const extra = { webkit: { messageHandlers: { hiveop: { postMessage: (m: Sent) => { sent.push(m); return Promise.resolve(reply(m)); } } } } };
    const script = buildBridgeScript({ siteOrigin: SITE, version: '0.1.0', platform: 'ios' });
    return { app: (vm(script, SITE, extra) as any).hiveopApp, sent };
  };

  it('iOS advertises it and exposes appleSignIn()', () => {
    const { app } = ios(() => null);
    expect(app.capabilities).toContain('apple-sign-in');
    expect(app.has('apple-sign-in')).toBe(true);
    expect(typeof app.appleSignIn).toBe('function');
  });

  it('Android does not: it runs the web flow in the auth sheet', () => {
    const script = buildBridgeScript({ siteOrigin: SITE, version: '0.1.0', platform: 'android' });
    const app = (vm(script, SITE, { hiveopNative: { postMessage() {} } }) as any).hiveopApp;
    expect(app.capabilities).not.toContain('apple-sign-in');
    expect(app.has('apple-sign-in')).toBe(false);
    expect('appleSignIn' in app).toBe(false);
  });

  it('asks the native sheet and returns the token, the RAW nonce and the name', async () => {
    const { app, sent } = ios(() => ({ identityToken: 'idt', nonce: 'raw', name: 'Ada Lovelace' }));
    await expect(app.appleSignIn()).resolves.toEqual({ identityToken: 'idt', nonce: 'raw', name: 'Ada Lovelace' });
    expect(sent).toEqual([{ m: 'appleSignIn', a: null }]);
  });

  it('a closed sheet resolves null', async () => {
    await expect(ios(() => null).app.appleSignIn()).resolves.toBeNull();
  });

  it('a reply without a token or nonce is treated as cancelled, not as a credential', async () => {
    await expect(ios(() => ({ identityToken: 'x' })).app.appleSignIn()).resolves.toBeNull();
    await expect(ios(() => ({ nonce: 'x' })).app.appleSignIn()).resolves.toBeNull();
  });

  it('a native failure rejects', async () => {
    const send = { webkit: { messageHandlers: { hiveop: { postMessage: () => Promise.reject(new Error('apple failed')) } } } };
    const script = buildBridgeScript({ siteOrigin: SITE, version: '0.1.0', platform: 'ios' });
    const app = (vm(script, SITE, send) as any).hiveopApp;
    await expect(app.appleSignIn()).rejects.toThrow('apple failed');
  });

  it('the Android auth bounce takes apple; unknown providers are still refused', async () => {
    const script = buildBridgeScript({ siteOrigin: SITE, version: '0.1.0', platform: 'android' });
    const posted: string[] = [];
    const ch: any = { postMessage: (j: string) => posted.push(j) };
    const app = (vm(script, SITE, { hiveopNative: { postMessage() {} }, hiveopAuthNative: ch }) as any).hiveopApp;
    void app.bounce('apple');
    expect(JSON.parse(posted[0]).provider).toBe('apple');
    await expect(app.bounce('twitter')).rejects.toThrow('unknown provider');
  });
});
