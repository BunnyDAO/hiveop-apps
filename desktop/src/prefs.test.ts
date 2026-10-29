import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, parsePrefs, serializePrefs } from './prefs';

describe('prefs', () => {
  it('defaults start-at-login on (first run)', () => {
    expect(parsePrefs(undefined)).toEqual(DEFAULT_PREFS);
    expect(DEFAULT_PREFS.startAtLogin).toBe(true);
  });
  it('survives garbage', () => {
    expect(parsePrefs('{nope')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('{"startAtLogin":"yes"}')).toEqual(DEFAULT_PREFS);
  });
  it('round-trips the users choice', () => {
    expect(parsePrefs(serializePrefs({ startAtLogin: false, takeoverDeclined: false }))).toEqual({ startAtLogin: false, takeoverDeclined: false });
  });
  it('remembers a declined takeover (dsk-12), off by default', () => {
    expect(DEFAULT_PREFS.takeoverDeclined).toBe(false);
    const p = { startAtLogin: true, takeoverDeclined: true };
    expect(parsePrefs(serializePrefs(p))).toEqual(p);
  });
  it('an old prefs file without the field still loads', () => {
    expect(parsePrefs('{"startAtLogin":false}')).toEqual({ startAtLogin: false, takeoverDeclined: false });
  });
});
