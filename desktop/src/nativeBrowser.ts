import { app, session, type BrowserWindow, type WebContents } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { isSiteOrigin } from './bridge';

/** Dedicated, persistent session for the browser pane: not HiveOp's own cookies, kept across restarts. */
export const BROWSER_PARTITION = 'persist:hiveop-browser';
/** Main -> page: a page in a native view asked for a new window. */
export const OPEN_TAB_CHANNEL = 'hiveop:browser-open-tab';

export interface AttachPrefs {
  nodeIntegration?: boolean;
  nodeIntegrationInSubFrames?: boolean;
  contextIsolation?: boolean;
  sandbox?: boolean;
  webSecurity?: boolean;
  allowRunningInsecureContent?: boolean;
  preload?: string;
  preloadURL?: string;
}
export interface AttachParams {
  src?: string;
  partition?: string;
  preload?: string;
}

function isHttp(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function originOf(raw: string): string {
  try {
    return new URL(raw).origin;
  } catch {
    return '';
  }
}

/**
 * will-attach-webview policy. Mutates the prefs the way Electron expects and
 * says whether the attach may go ahead. Only the site's own page may embed a
 * view, only on the dedicated partition, and only http(s) may load in it.
 */
export function hardenAttach(embedderUrl: string, prefs: AttachPrefs, params: AttachParams, siteOrigin: string): 'allow' | 'deny' {
  if (!isSiteOrigin(originOf(embedderUrl), siteOrigin)) return 'deny';
  if (!params.src || !isHttp(params.src)) return 'deny';
  // Electron ignores a partition rewritten here, so a page asking for any
  // other session (HiveOp's own, in-memory) is refused rather than corrected.
  if (params.partition !== BROWSER_PARTITION) return 'deny';
  delete prefs.preload;
  delete prefs.preloadURL;
  delete params.preload;
  prefs.nodeIntegration = false;
  prefs.nodeIntegrationInSubFrames = false;
  prefs.contextIsolation = true;
  prefs.sandbox = true;
  prefs.webSecurity = true;
  prefs.allowRunningInsecureContent = false;
  return 'allow';
}

/** A popup from a native view becomes a pane tab; anything but http(s) is dropped. */
export function popupAction(url: string): 'open-tab' | 'deny' {
  return isHttp(url) ? 'open-tab' : 'deny';
}

/** Where a download lands: the Downloads folder, never outside it, never over a file. */
export function downloadTarget(dir: string, filename: string, exists: (p: string) => boolean): string {
  const base = path.basename(filename.replace(/\\/g, '/')) || 'download';
  const ext = path.extname(base);
  const stem = ext ? base.slice(0, -ext.length) : base;
  let candidate = path.join(dir, base);
  for (let n = 1; exists(candidate); n++) candidate = path.join(dir, `${stem} (${n})${ext}`);
  return candidate;
}

/** Sites block "Electron" and unknown app tokens (Google sign-in does); look like plain Chrome. */
export function browserUserAgent(ua: string): string {
  return ua
    .replace(/\s+Electron\/\S+/g, '')
    .replace(/\s+HiveOp(?:Desktop)?\/\S+/g, '')
    .trim();
}

const GRANTED = new Set(['fullscreen', 'clipboard-sanitized-write', 'pointerLock']);

let sessionReady = false;
function prepareSession(): void {
  if (sessionReady) return;
  sessionReady = true;
  const ses = session.fromPartition(BROWSER_PARTITION);
  ses.setUserAgent(browserUserAgent(ses.getUserAgent()));
  // Camera, mic, location, notifications: not in this slice.
  ses.setPermissionRequestHandler((_wc, permission, cb) => cb(GRANTED.has(permission)));
  ses.on('will-download', (_e, item) => {
    item.setSavePath(downloadTarget(app.getPath('downloads'), item.getFilename(), fs.existsSync));
  });
}

function hookView(page: WebContents, view: WebContents): void {
  view.setWindowOpenHandler(({ url }) => {
    if (popupAction(url) === 'open-tab' && !page.isDestroyed()) page.send(OPEN_TAB_CHANNEL, url, view.id);
    return { action: 'deny' };
  });
  // Navigation stays inside the view; only non-web schemes are stopped.
  const stop = (e: { preventDefault(): void }, url: string): void => {
    if (!isHttp(url)) e.preventDefault();
  };
  view.on('will-navigate', (e, url) => stop(e, url));
  view.on('will-redirect', (e, url) => stop(e, url));
}

/** Hook-up for main.ts: the window's page may host hardened native views. */
export function installNativeBrowser(win: BrowserWindow, siteOrigin: string): void {
  prepareSession();
  const page = win.webContents;
  page.on('will-attach-webview', (event, webPreferences, params) => {
    if (hardenAttach(page.getURL(), webPreferences, params, siteOrigin) === 'deny') event.preventDefault();
  });
  page.on('did-attach-webview', (_e, view) => hookView(page, view));
}
