import { describe, expect, it } from 'vitest';
import { bridgePath, LOGIN_PATH_PROBE, parseLoginPath } from './loginPath';

describe('parseLoginPath', () => {
  it('reads the PATH between the markers, ignoring rc-file noise', () => {
    const out = `Welcome back!\nnvm: using v22\n${LOGIN_PATH_PROBE.start}/opt/homebrew/bin:/usr/bin${LOGIN_PATH_PROBE.end}\nbye\n`;
    expect(parseLoginPath(out)).toBe('/opt/homebrew/bin:/usr/bin');
  });
  it('is undefined when markers are missing or the PATH is empty', () => {
    expect(parseLoginPath('/usr/bin:/bin')).toBeUndefined();
    expect(parseLoginPath(`${LOGIN_PATH_PROBE.start}${LOGIN_PATH_PROBE.end}`)).toBeUndefined();
    expect(parseLoginPath(undefined)).toBeUndefined();
  });
});

describe('bridgePath', () => {
  it('puts the tools dir first, then the login PATH, then the inherited PATH, de-duplicated', () => {
    expect(bridgePath({ toolsDir: '/app/tools/bin', loginPath: '/opt/homebrew/bin:/usr/bin', inheritedPath: '/usr/bin:/bin', delimiter: ':' }))
      .toBe('/app/tools/bin:/opt/homebrew/bin:/usr/bin:/bin');
  });
  it('works without a login PATH', () => {
    expect(bridgePath({ toolsDir: '/t', inheritedPath: '/usr/bin', delimiter: ':' })).toBe('/t:/usr/bin');
  });
  it('drops empty segments and uses the given delimiter', () => {
    expect(bridgePath({ toolsDir: 'C:\\t', loginPath: ';C:\\a;;C:\\a', delimiter: ';' })).toBe('C:\\t;C:\\a');
  });
});
