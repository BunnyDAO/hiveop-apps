import { describe, expect, it } from 'vitest';
import { vm } from './testVm';
import { BRIDGE_CAPABILITIES, buildBridgeScript, buildBridge, isSiteOrigin } from './shellBridge';

const SITE = 'https://app.hiveop.io';

describe('isSiteOrigin', () => {
  it.each([
    [SITE, SITE, true],
    ['https://app.hiveop.io:8443', SITE, false],
    ['http://app.hiveop.io', SITE, false],
    ['https://app.hiveop.io.evil.com', SITE, false],
    ['https://example.com', SITE, false],
    ['null', SITE, false],
    ['', SITE, false],
    ['capacitor://localhost', SITE, false],
  ])('%s vs %s', (page, site, want) => {
    expect(isSiteOrigin(page, site)).toBe(want);
  });
});

describe('buildBridge', () => {
  it('has the fixed shape', () => {
    const b = buildBridge({ version: '1.2.3', platform: 'ios', capabilities: ['open-sheet'] });
    expect(b.version).toBe('1.2.3');
    expect(b.platform).toBe('ios');
    expect(b.capabilities).toEqual(['open-sheet']);
    expect(b.has('open-sheet')).toBe(true);
    expect(b.has('push')).toBe(false);
    expect(b.has(undefined as unknown as string)).toBe(false);
  });
  it('launch capabilities are just open-sheet for now', () => {
    expect(BRIDGE_CAPABILITIES).toEqual(['open-sheet']);
  });
});

describe('buildBridgeScript', () => {
  const run = (pageOrigin: string, platform: 'ios' | 'android' = 'android') => {
    const script = buildBridgeScript({ siteOrigin: SITE, version: '0.1.0', platform });
    return vm(script, pageOrigin) as { hiveopApp?: any };
  };

  it('defines window.hiveopApp on the site origin', () => {
    const w = run(SITE);
    expect(w.hiveopApp.version).toBe('0.1.0');
    expect(w.hiveopApp.platform).toBe('android');
    expect(w.hiveopApp.capabilities).toEqual(['open-sheet']);
    expect(w.hiveopApp.has('open-sheet')).toBe(true);
    expect(w.hiveopApp.has('nope')).toBe(false);
  });
  it('reports the platform it was built for', () => {
    expect(run(SITE, 'ios').hiveopApp.platform).toBe('ios');
  });
  it.each(['https://example.com', 'https://github.com', 'capacitor://localhost', 'https://app.hiveop.io.evil.com', 'null'])(
    'defines nothing on %s',
    (origin) => {
      expect('hiveopApp' in run(origin)).toBe(false);
    },
  );
  it('does not let the page mutate has() results by editing capabilities', () => {
    const w = run(SITE);
    try {
      w.hiveopApp.capabilities.push('push');
    } catch {
      /* frozen */
    }
    expect(w.hiveopApp.has('push')).toBe(false);
  });
  it('is not overwritable', () => {
    const w = run(SITE);
    try {
      w.hiveopApp = {};
    } catch {
      /* strict mode */
    }
    expect(w.hiveopApp.version).toBe('0.1.0');
  });
  it('survives odd characters in the origin/version (JSON-escaped)', () => {
    const s = buildBridgeScript({ siteOrigin: SITE, version: '1.0"</script>', platform: 'ios' });
    expect(s).not.toContain('</script>');
    expect((vm(s, SITE) as any).hiveopApp.version).toBe('1.0"</script>');
  });
});
