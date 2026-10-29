import { describe, expect, it } from 'vitest';
import { buildBridge, isSiteOrigin } from './bridge';

describe('isSiteOrigin', () => {
  it('matches only the exact configured origin', () => {
    expect(isSiteOrigin('https://app.hiveop.io', 'https://app.hiveop.io')).toBe(true);
    expect(isSiteOrigin('https://evil.example', 'https://app.hiveop.io')).toBe(false);
    expect(isSiteOrigin('https://app.hiveop.io.evil.example', 'https://app.hiveop.io')).toBe(false);
    expect(isSiteOrigin('http://app.hiveop.io', 'https://app.hiveop.io')).toBe(false);
    expect(isSiteOrigin('http://localhost:3000', 'http://localhost:3001')).toBe(false);
  });
  it('rejects opaque and empty origins', () => {
    expect(isSiteOrigin('null', 'https://app.hiveop.io')).toBe(false);
    expect(isSiteOrigin('', '')).toBe(false);
    expect(isSiteOrigin('file://', 'file://')).toBe(false);
  });
});

describe('buildBridge', () => {
  it('is the version plus an empty capability list for now', () => {
    expect(buildBridge('0.1.0')).toEqual({ version: '0.1.0', capabilities: [] });
  });
  it('is frozen so the page cannot widen it', () => {
    const b = buildBridge('0.1.0');
    expect(Object.isFrozen(b)).toBe(true);
    expect(Object.isFrozen(b.capabilities)).toBe(true);
  });
});
