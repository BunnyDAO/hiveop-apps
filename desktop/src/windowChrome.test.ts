import { describe, expect, it } from 'vitest';
import { buildBridge } from './bridge';
import { windowChrome } from './windowChrome';

describe('windowChrome — no title bar on a Mac', () => {
  it('a Mac window hides its title bar and keeps its buttons inside the site top bar', () => {
    expect(windowChrome('darwin')).toEqual({ titleBarStyle: 'hidden', trafficLightPosition: { x: 16, y: 15 } });
  });
  it('Windows and Linux keep their native frame', () => {
    expect(windowChrome('win32')).toEqual({});
    expect(windowChrome('linux')).toEqual({});
  });
  it('the site learns about it through the inset-titlebar capability', () => {
    expect(buildBridge('0.1.1', { insetTitlebar: true }).capabilities).toEqual(['inset-titlebar']);
    expect(buildBridge('0.1.1', { insetTitlebar: false }).capabilities).toEqual([]);
  });
});
