import { app, BrowserWindow, net, shell } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isLoadFailure, isLoadSuccess, retryDelayMs } from './backoff';
import { decide, type Decision } from './navPolicy';
import { installNativeBrowser } from './nativeBrowser';
import { resolveSiteUrl, userAgentFor } from './site';
import { openAppPopup } from './popup';
import { createAuthBounce } from './authBounce';
import { randomBytes } from 'node:crypto';
import { attachWindow, installShell, setBridgeStatus, setLocalAgentCounter, startShell } from './shell';
import { createBridgeHost } from './bridgeHost';

const APP_ID = 'io.hiveop.desktop';
const RETRY_SCHEME = 'hiveop-retry:';
const SMOKE = process.env.HIVEOP_SMOKE === '1'; // hidden window for automated checks

const site = resolveSiteUrl(process.env);
// Backend that starts Google sign-in (dsk-02). Override for staging.
// Same host the site's own Google button uses (NEXT_PUBLIC_API_URL on prod).
const OAUTH_API = process.env.HIVEOP_OAUTH_API || 'https://api.wenrwa.com/api/v1';
const authBounce = createAuthBounce({
  oauthApi: OAUTH_API,
  siteOrigin: site.origin,
  randomBytes,
  now: Date.now,
  // Smoke runs never open a real browser: log what would have opened.
  open: (url) => (SMOKE ? void console.log(`[smoke] openExternal ${url}`) : shell.openExternal(url)),
});
const offlineFile = path.join(__dirname, '..', 'resources', 'offline.html');
const offlineUrl = pathToFileURL(offlineFile).href;

app.setAppUserModelId(APP_ID);
app.userAgentFallback = userAgentFor(app.userAgentFallback, app.getVersion());

let win: BrowserWindow | null = null;
let attempt = 0;
let retryTimer: NodeJS.Timeout | null = null;
let probing = false;
let failedSinceStart = false;

/** Act on a decision for a URL the page wants to show. Returns true if it stays in this window. */
function route(url: string): Decision {
  const d = decide(url, { siteOrigin: site.origin });
  if (d === 'app-popup') {
    openAppPopup({ siteOrigin: site.origin, getMain: () => (win && !win.isDestroyed() ? win : null), smoke: SMOKE }, url);
  } else if (d === 'system-browser' && /^https?:/i.test(url)) {
    void shell.openExternal(url);
  }
  return d;
}

function clearRetry(): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
}

async function reachable(): Promise<boolean> {
  try {
    const res = await net.fetch(site.url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(5000) });
    return res.status > 0;
  } catch {
    return false;
  }
}

async function tryReconnect(): Promise<void> {
  if (probing || !win || win.isDestroyed()) return;
  probing = true;
  clearRetry();
  const ok = await reachable();
  probing = false;
  if (!win || win.isDestroyed()) return;
  if (ok) {
    void win.loadURL(site.url);
  } else {
    scheduleRetry();
  }
}

function scheduleRetry(): void {
  clearRetry();
  const delay = retryDelayMs(attempt++);
  retryTimer = setTimeout(() => void tryReconnect(), delay);
  // Tell the page how long until the next automatic try.
  if (win && !win.isDestroyed() && win.webContents.getURL().startsWith(offlineUrl.split('?')[0])) {
    void win.webContents.executeJavaScript(
      `document.getElementById('msg').textContent='Check your connection. Retrying in ${Math.round(delay / 1000)}s.'`,
    ).catch(() => undefined);
  }
}

function showOffline(): void {
  if (!win || win.isDestroyed()) return;
  const delay = retryDelayMs(attempt);
  void win.loadURL(`${offlineUrl}?next=${delay}`);
  scheduleRetry();
}

function createWindow(): BrowserWindow {
  const w = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 480,
    minHeight: 400,
    title: 'HiveOp',
    show: !SMOKE,
    backgroundColor: '#0b0d12',
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: true, // native browser views only; nativeBrowser.ts vets every attach
      preload: path.join(__dirname, 'preload.js'),
      additionalArguments: [`--hiveop-site-origin=${site.origin}`, `--hiveop-version=${app.getVersion()}`],
    },
  });
  const wc = w.webContents;
  installNativeBrowser(w, site.origin);

  wc.setWindowOpenHandler(({ url }) => {
    const d = route(url);
    if (d === 'in-window' && /^https?:/i.test(url)) void w.loadURL(url);
    return { action: 'deny' };
  });

  const guard = (event: { preventDefault(): void }, url: string): void => {
    if (url.startsWith(RETRY_SCHEME)) {
      event.preventDefault();
      attempt = 0;
      void tryReconnect();
      return;
    }
    if (url.split('?')[0] === offlineUrl) return; // our own error page
    const d = route(url);
    // hiveop: deep links are not handled by this slice; swallow rather than navigate.
    if (d !== 'in-window' || !/^https?:/i.test(url)) event.preventDefault();
  };
  wc.on('will-navigate', (e, url) => guard(e, url));
  wc.on('will-redirect', (e, url) => guard(e, url));

  wc.on('did-start-loading', () => {
    failedSinceStart = false;
  });
  wc.on('did-fail-load', (_e, code, _desc, validatedURL, isMainFrame) => {
    if (isLoadFailure(code, isMainFrame, validatedURL, offlineUrl)) {
      failedSinceStart = true;
      showOffline();
    }
  });
  wc.on('did-finish-load', () => {
    if (isLoadSuccess(wc.getURL(), failedSinceStart)) {
      attempt = 0;
      clearRetry();
    }
  });

  attachWindow(w);
  w.on('closed', () => {
    clearRetry();
    if (win === w) win = null;
  });
  void w.loadURL(site.url);
  return w;
}

const bridgeHost = createBridgeHost({
  siteOrigin: site.origin,
  getWindow: () => (win && !win.isDestroyed() ? win : null),
  onChange: () => {
    const v = bridgeHost.view();
    setBridgeStatus(v, v.agents);
  },
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  installShell({
    siteOrigin: site.origin,
    smoke: SMOKE,
    authBounce,
    getWindow: () => (win && !win.isDestroyed() ? win : null),
    ensureWindow: () => {
      if (!win || win.isDestroyed()) win = createWindow();
      return win;
    },
  });
  app.whenReady().then(() => {
    if (SMOKE) app.dock?.hide();
    win = createWindow();
    startShell();
    setLocalAgentCounter(() => bridgeHost.localAgents());
    void bridgeHost.start();
  });
  app.on('will-quit', () => bridgeHost.stop()); // stops only the bridge this app started
}
