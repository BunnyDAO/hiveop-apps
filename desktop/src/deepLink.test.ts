import { describe, expect, it } from 'vitest';
import { deepLinkFromArgv, parseAuthLink, parseDeepLink, toSiteUrl } from './deepLink';

describe('parseDeepLink', () => {
  const ok: Array<[string, string]> = [
    ['hiveop://open?path=/fleet', '/fleet'],
    ['hiveop://open?path=/w/abc?x=1', '/w/abc?x=1'],
    ['hiveop://open?path=%2Ffleet%3Ftab%3D2', '/fleet?tab=2'],
    ['hiveop://open?path=/', '/'],
    ['hiveop://open', '/'],
    ['HIVEOP://open?path=/a', '/a'],
  ];
  it.each(ok)('accepts %s', (raw, path) => {
    expect(parseDeepLink(raw)).toEqual({ kind: 'open', path });
  });

  const bad = [
    'hiveop://open?path=https://evil.com/',
    'hiveop://open?path=//evil.com/x',
    'hiveop://open?path=/\\evil.com',
    'hiveop://open?path=%5Cevil.com',
    'hiveop://open?path=fleet',
    'hiveop://open?path=javascript:alert(1)',
    'hiveop://open?path=/a%0d%0ab',
    'hiveop://evil?path=/fleet',
    'https://app.hiveop.io/fleet',
    'hiveop-retry://x',
    'not a url',
    '',
  ];
  it.each(bad)('rejects %s', (raw) => {
    expect(parseDeepLink(raw)).toBeNull();
  });
});

describe('toSiteUrl', () => {
  it('joins onto the site origin only', () => {
    expect(toSiteUrl('/fleet?x=1', 'https://app.hiveop.io')).toBe('https://app.hiveop.io/fleet?x=1');
    expect(toSiteUrl('/', 'http://localhost:3000')).toBe('http://localhost:3000/');
  });
});

describe('deepLinkFromArgv', () => {
  it('finds the first hiveop:// argument', () => {
    expect(deepLinkFromArgv(['app.exe', '--flag', 'hiveop://open?path=/x'])).toBe('hiveop://open?path=/x');
    expect(deepLinkFromArgv(['app', 'foo'])).toBeUndefined();
  });
});

describe('parseAuthLink', () => {
  const token = 'abcDEF123_-.~abcDEF123_-';
  it('accepts hiveop://auth with a well-formed handoff', () => {
    expect(parseAuthLink(`hiveop://auth?handoff=${token}`)).toEqual({ kind: 'auth', handoff: token });
    expect(parseAuthLink(`HIVEOP://auth?handoff=${token}`)).toEqual({ kind: 'auth', handoff: token });
  });
  const bad = [
    'hiveop://auth',
    'hiveop://auth?handoff=',
    'hiveop://auth?handoff=short',
    `hiveop://auth?handoff=${'a'.repeat(513)}`,
    'hiveop://auth?handoff=abc def abc def abc def',
    'hiveop://auth?handoff=aaaaaaaaaaaaaaaaaaaaaaaa%0d%0a',
    'hiveop://auth?handoff=aaaaaaaaaaaaaaaaaaaaaaaa/../x',
    `hiveop://auth?handoff=${token}&handoff=${token}`,
    `hiveop://open?handoff=${token}`,
    `https://app.hiveop.io/?handoff=${token}`,
    'not a url',
  ];
  it.each(bad)('rejects %s', (raw) => {
    expect(parseAuthLink(raw)).toBeNull();
  });
  it('is not an open link', () => {
    expect(parseDeepLink(`hiveop://auth?handoff=${token}`)).toBeNull();
  });
});
