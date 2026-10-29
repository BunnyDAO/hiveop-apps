import { describe, expect, it } from 'vitest';
import { countChildPtys } from './agentCount';

const ps = (rows: [number, number, string][]) => rows.map(([a, b, c]) => `${String(a).padStart(6)} ${String(b).padStart(6)} ${c}`).join('\n');

describe('countChildPtys', () => {
  it('counts direct children of the bridge (one per terminal)', () => {
    const out = ps([[10, 1, '/sbin/launchd'], [100, 10, 'Electron'], [200, 100, '/bin/zsh'], [201, 100, 'claude'], [300, 200, 'node']]);
    expect(countChildPtys(out, 100)).toBe(2);
  });
  it('ignores short-lived helpers and browser processes', () => {
    const out = ps([[200, 100, '/usr/bin/git'], [201, 100, 'ps'], [202, 100, 'Google Chrome Helper'], [203, 100, '/bin/bash']]);
    expect(countChildPtys(out, 100)).toBe(1);
  });
  it('is zero for no children, junk, or empty output', () => {
    expect(countChildPtys('', 100)).toBe(0);
    expect(countChildPtys('garbage\nlines here', 100)).toBe(0);
    expect(countChildPtys(ps([[5, 4, 'x']]), 100)).toBe(0);
  });
});
