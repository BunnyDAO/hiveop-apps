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
  it('is the version plus an empty capability list when no host hooks are given', () => {
    expect(buildBridge('0.1.0')).toEqual({ version: '0.1.0', capabilities: [] });
  });
  it('adds native-browser and browser.onOpenTab when the host can deliver popups', () => {
    let handler: ((url: string, from: number) => void) | null = null;
    const b = buildBridge('0.1.0', {
      onOpenTab: (cb) => {
        handler = cb;
        return () => {
          handler = null;
        };
      },
    });
    expect(b.capabilities).toEqual(['native-browser']);
    const seen: Array<[string, number]> = [];
    const off = b.browser!.onOpenTab((u, from) => seen.push([u, from]));
    handler!('https://github.com/login', 7);
    expect(seen).toEqual([['https://github.com/login', 7]]);
    off();
    expect(handler).toBeNull();
  });
  it('only forwards http(s) urls to the page', () => {
    let handler: ((url: string, from: number) => void) | null = null;
    const b = buildBridge('0.1.0', { onOpenTab: (cb) => ((handler = cb), () => undefined) });
    const seen: string[] = [];
    b.browser!.onOpenTab((u) => seen.push(u));
    handler!('javascript:alert(1)', 1);
    handler!('file:///x', 1);
    handler!('http://localhost:3000/', 1);
    expect(seen).toEqual(['http://localhost:3000/']);
  });
  it('is frozen so the page cannot widen it', () => {
    const b = buildBridge('0.1.0');
    expect(Object.isFrozen(b)).toBe(true);
    expect(Object.isFrozen(b.capabilities)).toBe(true);
    const n = buildBridge('0.1.0', { onOpenTab: () => () => undefined });
    expect(Object.isFrozen(n.browser)).toBe(true);
    expect(Object.isFrozen(n.capabilities)).toBe(true);
  });
});
