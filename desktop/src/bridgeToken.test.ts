import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTokenStore, isConnectToken, type Cipher } from './bridgeToken';

const cipher: Cipher = {
  available: () => true,
  encrypt: (s) => Buffer.from(`enc:${s.split('').reverse().join('')}`),
  decrypt: (b) => b.toString().slice(4).split('').reverse().join(''),
};

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hiveop-tok-'));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('isConnectToken', () => {
  it('wants the wm_ct_ prefix and no whitespace', () => {
    expect(isConnectToken('wm_ct_abc123')).toBe(true);
    expect(isConnectToken('wm_ct_')).toBe(false);
    expect(isConnectToken('abc')).toBe(false);
    expect(isConnectToken('wm_ct_a b')).toBe(false);
    expect(isConnectToken(42)).toBe(false);
  });
});

describe('token store', () => {
  it('round-trips through the cipher and never writes the plaintext', () => {
    const s = createTokenStore(path.join(dir, 't.bin'), cipher);
    expect(s.get()).toBeUndefined();
    expect(s.set('wm_ct_secret')).toBe(true);
    expect(s.get()).toBe('wm_ct_secret');
    expect(fs.readFileSync(path.join(dir, 't.bin'), 'utf8')).not.toContain('wm_ct_secret');
  });
  it('refuses a malformed token and stores nothing', () => {
    const s = createTokenStore(path.join(dir, 't.bin'), cipher);
    expect(s.set('nope')).toBe(false);
    expect(s.has()).toBe(false);
  });
  it('refuses to store when OS encryption is unavailable (no plaintext fallback)', () => {
    const s = createTokenStore(path.join(dir, 't.bin'), { ...cipher, available: () => false });
    expect(s.set('wm_ct_secret')).toBe(false);
    expect(fs.existsSync(path.join(dir, 't.bin'))).toBe(false);
  });
  it('a corrupt file reads as no token', () => {
    fs.writeFileSync(path.join(dir, 't.bin'), 'junk');
    const s = createTokenStore(path.join(dir, 't.bin'), { ...cipher, decrypt: () => { throw new Error('bad'); } });
    expect(s.get()).toBeUndefined();
  });
  it('clear removes it', () => {
    const s = createTokenStore(path.join(dir, 't.bin'), cipher);
    s.set('wm_ct_secret');
    s.clear();
    expect(s.has()).toBe(false);
  });
});
