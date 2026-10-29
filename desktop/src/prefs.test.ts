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
    expect(parsePrefs(serializePrefs({ startAtLogin: false }))).toEqual({ startAtLogin: false });
  });
});
