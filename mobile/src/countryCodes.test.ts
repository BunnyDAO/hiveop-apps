import { describe, expect, it } from 'vitest';
import { ALPHA3_TO_ALPHA2, toAlpha2 } from './countryCodes';

describe('toAlpha2', () => {
  it('converts the StoreKit alpha-3 form', () => {
    expect(toAlpha2('USA')).toBe('US');
    expect(toAlpha2('GBR')).toBe('GB');
    expect(toAlpha2('DEU')).toBe('DE');
    expect(toAlpha2('PRI')).toBe('PR');
    expect(toAlpha2('usa')).toBe('US');
  });
  it('passes alpha-2 through (Play Billing)', () => {
    expect(toAlpha2('US')).toBe('US');
    expect(toAlpha2('de')).toBe('DE');
  });
  it('is null for anything else', () => {
    for (const v of ['', 'U', 'USAA', 'ZZZ', '12', null, undefined, 7, {}]) expect(toAlpha2(v)).toBeNull();
  });
  it('is a clean ISO table', () => {
    const pairs = Object.entries(ALPHA3_TO_ALPHA2);
    expect(pairs.length).toBeGreaterThanOrEqual(245);
    expect(new Set(pairs.map(([, b]) => b)).size).toBe(pairs.length); // alpha-2 values unique
    for (const [a3, a2] of pairs) {
      expect(a3).toMatch(/^[A-Z]{3}$/);
      expect(a2).toMatch(/^[A-Z]{2}$/);
    }
    // the only alpha-3 that may map to US
    expect(pairs.filter(([, b]) => b === 'US').map(([a]) => a)).toEqual(['USA']);
  });
});
