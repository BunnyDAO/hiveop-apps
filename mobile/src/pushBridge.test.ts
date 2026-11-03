import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { buildBridgeScript } from './shellBridge.ts';

const SITE = 'https://app.hiveop.io';

/** A page with a fake Capacitor native bridge; records calls and lets the test fire events. */
function page(opts: { perm?: string; platform?: 'ios' | 'android'; token?: string; noPush?: boolean } = {}) {
  const calls: Array<[string, string, unknown]> = [];
  const listeners: Record<string, Array<(e: unknown) => void>> = {};
  const state = { perm: opts.perm ?? 'prompt' };
  const win: Record<string, any> = { location: { origin: SITE }, setTimeout, clearTimeout };
  win.window = win;
  if (opts.noPush) win.__hiveopNoPush = true;
  win.Capacitor = {
    nativePromise: async (plugin: string, method: string, o: unknown) => {
      calls.push([plugin, method, o]);
      if (method === 'checkPermissions') return { receive: state.perm };
      if (method === 'requestPermissions') {
        state.perm = opts.perm === 'denied' ? 'denied' : 'granted';
        return { receive: state.perm };
      }
      if (method === 'register' && opts.token) {
        queueMicrotask(() => (listeners.registration ?? []).forEach((cb) => cb({ value: opts.token })));
      }
      return {};
    },
    addListener: (_p: string, ev: string, cb: (e: unknown) => void) => {
      (listeners[ev] ||= []).push(cb);
      return { remove: async () => {} };
    },
  };
  runInNewContext(buildBridgeScript({ siteOrigin: SITE, version: '1.0.0', platform: opts.platform ?? 'android' }), win);
  return { win, calls, listeners, emit: (ev: string, e: unknown) => (listeners[ev] ?? []).forEach((cb) => cb(e)) };
}

describe('window.hiveopApp.push', () => {
  it('advertises push and open-settings', () => {
    const { win } = page();
    expect(win.hiveopApp.has('push')).toBe(true);
    expect(win.hiveopApp.has('open-settings')).toBe(true);
    expect(typeof win.hiveopApp.openSettings).toBe('function');
  });

  it('a shell without Firebase config drops push but keeps open-settings', () => {
    const { win } = page({ noPush: true });
    expect(win.hiveopApp.has('push')).toBe(false);
    expect(win.hiveopApp.push).toBeUndefined();
    expect(win.hiveopApp.has('open-settings')).toBe(true);
  });

  it.each([
    ['prompt', 'unknown'],
    ['prompt-with-rationale', 'unknown'],
    ['granted', 'granted'],
    ['denied', 'denied'],
    ['weird', 'unknown'],
  ])('state(): OS %s -> %s', async (perm, want) => {
    const { win } = page({ perm });
    expect(await win.hiveopApp.push.state()).toBe(want);
  });

  it('request(): granted registers for a token', async () => {
    const { win, calls } = page({ token: 'T1' });
    expect(await win.hiveopApp.push.request()).toBe('granted');
    expect(calls.map((c) => c[1])).toEqual(['requestPermissions', 'register']);
  });

  it('request(): denied does not register', async () => {
    const { win, calls } = page({ perm: 'denied' });
    expect(await win.hiveopApp.push.request()).toBe('denied');
    expect(calls.map((c) => c[1])).toEqual(['requestPermissions']);
  });

  it('onToken delivers {platform, token} for every registration and can be removed', async () => {
    const { win, emit } = page({ platform: 'ios' });
    const seen: unknown[] = [];
    const off = win.hiveopApp.push.onToken((t: unknown) => seen.push(t));
    emit('registration', { value: 'abc' });
    off();
    emit('registration', { value: 'def' });
    expect(seen).toEqual([{ platform: 'ios', token: 'abc' }]);
  });

  it('onToken ignores malformed registrations', () => {
    const { win, emit } = page();
    const seen: unknown[] = [];
    win.hiveopApp.push.onToken((t: unknown) => seen.push(t));
    emit('registration', { value: '' });
    emit('registration', {});
    emit('registration', null);
    expect(seen).toEqual([]);
  });

  it('token(): null unless granted', async () => {
    const { win, calls } = page({ perm: 'prompt', token: 'T' });
    expect(await win.hiveopApp.push.token()).toBeNull();
    expect(calls.map((c) => c[1])).toEqual(['checkPermissions']);
  });

  it('token(): when granted, registers and resolves with the token', async () => {
    const { win } = page({ perm: 'granted', token: 'TOK', platform: 'android' });
    expect(await win.hiveopApp.push.token()).toEqual({ platform: 'android', token: 'TOK' });
  });

  it('token(): a registration error resolves null', async () => {
    const { win, emit } = page({ perm: 'granted' });
    const p = win.hiveopApp.push.token();
    await new Promise((r) => setTimeout(r, 0));
    emit('registrationError', { error: 'no entitlement' });
    expect(await p).toBeNull();
  });

  it('openSettings asks the native shell', async () => {
    const { win, calls } = page();
    await win.hiveopApp.openSettings();
    expect(calls).toContainEqual(['HiveOpShell', 'openSettings', {}]);
  });

  it('without a native Capacitor, calls reject instead of throwing synchronously', async () => {
    const w: Record<string, any> = { location: { origin: SITE } };
    w.window = w;
    runInNewContext(buildBridgeScript({ siteOrigin: SITE, version: '1', platform: 'ios' }), w);
    await expect(w.hiveopApp.push.state()).rejects.toBeTruthy();
  });
});
