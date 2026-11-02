import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../page/offline.html', import.meta.url), 'utf8');

describe('offline page', () => {
  it('says Can\'t reach HiveOp with a Try again button', () => {
    expect(html).toContain("Can't reach HiveOp");
    expect(html).toContain('Try again');
  });
  it('has no text under 12px', () => {
    const sizes = [...html.matchAll(/font(?:-size)?:\s*(?:[^;}]*?\s)?(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
  });
  it('text colours are light on the dark background (no faint grey)', () => {
    const colors = [...html.matchAll(/(?<![-\w])color:\s*(#[0-9a-f]{6})/gi)].map((m) => m[1]);
    for (const c of colors.filter((c) => c.toLowerCase() !== '#111111')) {
      const lum = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)).reduce((a, b) => a + b, 0) / 3;
      expect(lum).toBeGreaterThanOrEqual(200);
    }
  });
});
