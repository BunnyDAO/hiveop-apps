import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// The shared truth for the iOS AppleNonce rule (scripts/check-apple-nonce-swift.sh runs the same file through Swift)
// and for the backend's check: the token's nonce claim must equal lowercase-hex sha256 of the RAW nonce.
const cases = JSON.parse(readFileSync(new URL('./fixtures/appleNonce.cases.json', import.meta.url), 'utf8')) as {
  hash: [string, string, string][];
  random: { length: number; pattern: string };
};

describe('apple nonce fixtures', () => {
  it.each(cases.hash)('%s: sha256 hex', (_n, raw, hex) => {
    expect(createHash('sha256').update(raw).digest('hex')).toBe(hex);
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });
  it('random nonces are url-safe and long enough for Apple', () => {
    expect(cases.random.length).toBeGreaterThanOrEqual(32);
    expect(new RegExp(cases.random.pattern).test('A'.repeat(cases.random.length))).toBe(true);
  });
});
