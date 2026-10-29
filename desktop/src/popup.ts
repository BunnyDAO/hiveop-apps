// App popup windows for Stripe and GitHub App flows (dsk-06).
// Shares the default session with the main window; closes itself on return to the site.
import { BrowserWindow, shell } from 'electron';
import { popupAction } from './popupPolicy';

export interface PopupHost {
  siteOrigin: string;
  /** The main window to hand the return URL to. */
  getMain(): BrowserWindow | null;
  smoke: boolean;
}

let popup: BrowserWindow | null = null;

export function openAppPopup(host: PopupHost, url: string): void {
  if (popupAction(url, host.siteOrigin) === 'block') return;
  if (popup && !popup.isDestroyed()) {
    void popup.loadURL(url);
    popup.show();
    popup.focus();
    return;
  }
  const main = host.getMain();
  const p = new BrowserWindow({
    width: 520,
    height: 760,
    title: 'HiveOp',
    show: !host.smoke,
    parent: main ?? undefined,
    backgroundColor: '#ffffff',
    // Same security prefs as the main window; no partition → default session (shared cookies).
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, webviewTag: false },
  });
  popup = p;
  const wc = p.webContents;

  const handle = (event: { preventDefault(): void } | null, next: string): void => {
    const action = popupAction(next, host.siteOrigin);
    if (action === 'stay') return;
    event?.preventDefault();
    if (action !== 'return') return;
    const m = host.getMain();
    if (m) void m.loadURL(next);
    if (!p.isDestroyed()) p.close();
  };
  wc.on('will-navigate', (e, next) => handle(e, next));
  wc.on('will-redirect', (e, next) => handle(e, next));
  wc.setWindowOpenHandler(({ url: next }) => {
    const action = popupAction(next, host.siteOrigin);
    if (action === 'return') handle(null, next);
    else if (action === 'stay') void shell.openExternal(next);
    return { action: 'deny' };
  });
  p.on('closed', () => {
    if (popup === p) popup = null;
  });
  void p.loadURL(url);
}
