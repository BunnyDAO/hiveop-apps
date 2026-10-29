import { describe, expect, it } from 'vitest';
import {
  BROWSER_PARTITION,
  browserUserAgent,
  downloadTarget,
  hardenAttach,
  popupAction,
  type AttachParams,
  type AttachPrefs,
} from './nativeBrowser';

const SITE = 'https://app.hiveop.io';

function prefs(over: Partial<AttachPrefs> = {}): AttachPrefs {
  return { nodeIntegration: true, contextIsolation: false, sandbox: false, preload: '/evil.js', preloadURL: 'file:///evil.js', ...over } as AttachPrefs;
}
function params(over: Partial<AttachParams> = {}): AttachParams {
  return { src: 'https://github.com/', partition: BROWSER_PARTITION, preload: '/evil.js', ...over } as AttachParams;
}

describe('hardenAttach', () => {
  it('forces the safe prefs and keeps the dedicated partition', () => {
    const p = prefs();
    const q = params();
    expect(hardenAttach(SITE + '/hive', p, q, SITE)).toBe('allow');
    expect(p.nodeIntegration).toBe(false);
    expect(p.contextIsolation).toBe(true);
    expect(p.sandbox).toBe(true);
    expect(p.preload).toBeUndefined();
    expect(p.preloadURL).toBeUndefined();
    expect(q.partition).toBe(BROWSER_PARTITION);
    expect(q.preload).toBeUndefined();
    expect(BROWSER_PARTITION).toBe('persist:hiveop-browser');
  });
  it('keeps nodeIntegrationInSubFrames and webSecurity off the table', () => {
    const p = prefs({ nodeIntegrationInSubFrames: true, webSecurity: false, allowRunningInsecureContent: true } as Partial<AttachPrefs>);
    hardenAttach(SITE + '/', p, params(), SITE);
    expect(p.nodeIntegrationInSubFrames).toBe(false);
    expect(p.webSecurity).toBe(true);
    expect(p.allowRunningInsecureContent).toBe(false);
  });
  it('refuses any other partition: HiveOp\'s own session is never shared', () => {
    // Electron does not apply a partition changed inside will-attach-webview
    // (seen in the 45.1 smoke run), so the page must ask for ours.
    for (const partition of ['persist:hiveop-default', 'persist:other', 'x', '', undefined]) {
      expect(hardenAttach(SITE + '/', prefs(), params({ partition }), SITE)).toBe('deny');
    }
  });
  it('refuses a src that is not http(s)', () => {
    for (const src of ['file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,hi', 'hiveop://x', 'not a url', '']) {
      expect(hardenAttach(SITE + '/', prefs(), params({ src }), SITE)).toBe('deny');
    }
  });
  it('allows http dev servers', () => {
    expect(hardenAttach(SITE + '/', prefs(), params({ src: 'http://localhost:3000/' }), SITE)).toBe('allow');
  });
  it('refuses when the embedding page is not on the site origin', () => {
    expect(hardenAttach('https://evil.example/', prefs(), params(), SITE)).toBe('deny');
    expect(hardenAttach('https://app.hiveop.io.evil.example/', prefs(), params(), SITE)).toBe('deny');
    expect(hardenAttach('file:///offline.html', prefs(), params(), SITE)).toBe('deny');
    expect(hardenAttach('', prefs(), params(), SITE)).toBe('deny');
  });
});

describe('popupAction', () => {
  it('turns http(s) popups into pane tabs', () => {
    expect(popupAction('https://github.com/login')).toBe('open-tab');
    expect(popupAction('http://localhost:3000/x')).toBe('open-tab');
  });
  it('drops everything else', () => {
    expect(popupAction('javascript:void(0)')).toBe('deny');
    expect(popupAction('file:///x')).toBe('deny');
    expect(popupAction('about:blank')).toBe('deny');
    expect(popupAction('')).toBe('deny');
  });
});

describe('downloadTarget', () => {
  const none = () => false;
  it('lands in the Downloads folder', () => {
    expect(downloadTarget('/Users/a/Downloads', 'report.pdf', none)).toBe('/Users/a/Downloads/report.pdf');
  });
  it('never escapes the folder', () => {
    expect(downloadTarget('/d', '../../etc/passwd', none)).toBe('/d/passwd');
    expect(downloadTarget('/d', '', none)).toBe('/d/download');
  });
  it('does not overwrite: counts up', () => {
    const taken = new Set(['/d/a.zip', '/d/a (1).zip']);
    expect(downloadTarget('/d', 'a.zip', (p) => taken.has(p))).toBe('/d/a (2).zip');
  });
});

describe('browserUserAgent', () => {
  it('drops the Electron and HiveOp tokens sites block on', () => {
    const ua = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) HiveOp/0.1.0 Chrome/140.0.0.0 Electron/45.1.0 Safari/537.36 HiveOpDesktop/0.1.0';
    expect(browserUserAgent(ua)).toBe('Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36');
  });
});
