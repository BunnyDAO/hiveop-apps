// Tray, close-to-tray, quit, login item and hiveop:// deep links (dsk-05).
// Kept separate from main.ts: main only calls installShell() and attachWindow().
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Tray } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { AuthBounce } from './authBounce';
import { deepLinkFromArgv, parseAuthLink, parseDeepLink, toSiteUrl } from './deepLink';
import { parsePrefs, serializePrefs, type Prefs } from './prefs';
import { quitPrompt } from './quitGuard';
import { agentsLine, bridgeStatusLine, updateLine } from './trayStatus';
import type { BridgeState } from './bridgeSupervisor';
import { updateMenuItem, type UpdateState } from './shellUpdater';

const PROTOCOL = 'hiveop';

export interface ShellHost {
  siteOrigin: string;
  /** The main window, or null if none exists right now. */
  getWindow(): BrowserWindow | null;
  /** Create the main window if needed and return it. */
  ensureWindow(): BrowserWindow;
  /** Hidden-window automated checks: no tray, no login item, no protocol registration. */
  smoke: boolean;
  /** Google sign-in through the system browser (dsk-09). */
  authBounce: AuthBounce;
}

let quitting = false;
let quitConfirmed = false;
let tray: Tray | null = null;
let host: ShellHost;
let pendingLink: string | undefined;

/** Running local agents. dsk-10 replaces this with the bridge supervisor's count. */
let localAgentCount: () => number = () => 0;
export function setLocalAgentCounter(fn: () => number): void {
  localAgentCount = fn;
}

/** Bridge status shown in the tray menu (dsk-10). */
let trayBridge: { state: BridgeState; agents: number } = { state: { kind: 'none' }, agents: 0 };
export function setBridgeStatus(state: BridgeState, agents: number): void {
  trayBridge = { state, agents };
  if (tray) tray.setContextMenu(buildMenu(loadPrefs()));
}

/** Shell update state shown in the tray menu (dsk-16). */
let updateState: UpdateState = { kind: 'idle' };
let updateActions: { openRelease(url: string): void; restart(): void } = { openRelease: () => undefined, restart: () => undefined };
export function setUpdateActions(a: typeof updateActions): void {
  updateActions = a;
}
export function setUpdateState(s: UpdateState): void {
  updateState = s;
  if (tray) tray.setContextMenu(buildMenu(loadPrefs()));
}

/** A downloaded bridge update waiting for the agents to stop (dsk-11). */
let bridgeUpdatePending: string | null = null;
export function setBridgeUpdatePending(v: string | null): void {
  bridgeUpdatePending = v;
  if (tray) tray.setContextMenu(buildMenu(loadPrefs()));
}

const prefsFile = (): string => path.join(app.getPath('userData'), 'prefs.json');

function loadPrefs(): Prefs {
  try {
    return parsePrefs(fs.readFileSync(prefsFile(), 'utf8'));
  } catch {
    return parsePrefs(undefined);
  }
}

function savePrefs(p: Prefs): void {
  try {
    fs.mkdirSync(path.dirname(prefsFile()), { recursive: true });
    fs.writeFileSync(prefsFile(), serializePrefs(p));
  } catch {
    /* a failed write only loses the toggle */
  }
}

function applyLoginItem(p: Prefs): void {
  // Unpackaged dev runs would register the bare Electron binary as a login item.
  if (host.smoke || !app.isPackaged) return;
  app.setLoginItemSettings({ openAtLogin: p.startAtLogin });
}

export function showMainWindow(): BrowserWindow {
  const w = host.ensureWindow();
  if (w.isMinimized()) w.restore();
  w.show();
  w.focus();
  return w;
}

/** Navigate the one window to a site path from a hiveop:// link; foreign links are ignored. */
export function handleDeepLink(raw: string | undefined): void {
  if (!raw) return;
  const auth = parseAuthLink(raw);
  if (auth) {
    deliverHandoff(auth.handoff);
    return;
  }
  const link = parseDeepLink(raw);
  if (!link) return;
  const url = toSiteUrl(link.path, host.siteOrigin);
  if (host.smoke) {
    const w = host.getWindow();
    if (w) void w.loadURL(url);
    return;
  }
  void showMainWindow().loadURL(url);
}

/** Pair the handoff with the pending verifier and hand both to the site; no pending bounce, no delivery. */
function deliverHandoff(handoff: string): void {
  const payload = host.authBounce.take(handoff);
  if (!payload) return;
  const w = host.getWindow();
  if (!w) return;
  w.webContents.send('hiveop:auth-handoff', payload);
  if (!host.smoke) showMainWindow();
}

export function requestQuit(): void {
  app.quit();
}

function buildMenu(prefs: Prefs): Menu {
  const upd = updateMenuItem(updateState);
  const updRow: Electron.MenuItemConstructorOptions[] = upd
    ? [
        {
          label: upd.label,
          enabled: upd.action !== null,
          click: () => {
            if (upd.action === 'restart') updateActions.restart();
            else if (upd.action === 'open-release' && updateState.kind === 'available') updateActions.openRelease(updateState.url);
          },
        },
        { type: 'separator' },
      ]
    : [];
  return Menu.buildFromTemplate([
    { label: 'Open HiveOp', click: () => showMainWindow() },
    { type: 'separator' },
    ...updRow,
    { label: bridgeStatusLine(trayBridge.state), enabled: false },
    { label: agentsLine(trayBridge.agents), enabled: false },
    ...(updateLine(bridgeUpdatePending) ? [{ label: updateLine(bridgeUpdatePending) as string, enabled: false }] : []),
    { type: 'separator' },
    {
      label: 'Start at login',
      type: 'checkbox',
      checked: prefs.startAtLogin,
      click: (item) => {
        const next = { startAtLogin: item.checked };
        savePrefs(next);
        applyLoginItem(next);
      },
    },
    { type: 'separator' },
    { label: 'Quit HiveOp', click: () => requestQuit() },
  ]);
}

function createTray(prefs: Prefs): void {
  const res = path.join(__dirname, '..', 'resources');
  const img =
    process.platform === 'darwin'
      ? nativeImage.createFromPath(path.join(res, 'trayTemplate.png'))
      : nativeImage.createFromPath(path.join(res, 'tray.png'));
  if (process.platform === 'darwin') img.setTemplateImage(true);
  tray = new Tray(img);
  tray.setToolTip('HiveOp');
  tray.setContextMenu(buildMenu(prefs));
  tray.on('click', () => {
    if (process.platform !== 'darwin') showMainWindow();
  });
}

/** Closing the window hides it; only Quit really closes. */
export function attachWindow(w: BrowserWindow): void {
  w.on('close', (e) => {
    if (quitting || host.smoke) return;
    e.preventDefault();
    w.hide();
  });
}

/** Run once, before app is ready (macOS delivers open-url early). */
export function installShell(h: ShellHost): void {
  host = h;
  if (!host.smoke) {
    if (process.defaultApp && process.argv[1]) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    } else {
      app.setAsDefaultProtocolClient(PROTOCOL);
    }
  }
  // Only the site's own top frame in the main window may start a bounce.
  ipcMain.handle('hiveop:auth-bounce', async (e) => {
    const w = host.getWindow();
    const f = e.senderFrame;
    if (!w || e.sender !== w.webContents || !f || f !== w.webContents.mainFrame) throw new Error('not allowed');
    let origin = '';
    try {
      origin = new URL(f.url).origin;
    } catch {
      /* fall through */
    }
    if (origin !== host.siteOrigin) throw new Error('not allowed');
    await host.authBounce.start();
  });
  app.on('open-url', (event, url) => {
    event.preventDefault();
    if (app.isReady()) handleDeepLink(url);
    else pendingLink = url;
  });
  pendingLink = deepLinkFromArgv(process.argv);

  app.on('second-instance', (_e, argv) => {
    const link = deepLinkFromArgv(argv);
    if (link) handleDeepLink(link);
    else if (!host.smoke) showMainWindow();
  });

  app.on('before-quit', (e) => {
    if (quitting) return;
    const prompt = quitConfirmed ? null : quitPrompt(localAgentCount());
    if (prompt) {
      e.preventDefault();
      void dialog
        .showMessageBox({ type: 'question', buttons: ['Quit', 'Cancel'], defaultId: 1, cancelId: 1, message: prompt })
        .then((r) => {
          if (r.response === 0) {
            quitConfirmed = true;
            app.quit();
          }
        });
      return;
    }
    quitting = true;
  });

  app.on('activate', () => {
    if (app.isReady()) showMainWindow();
  });
}

/** After app is ready and the main window exists. */
export function startShell(): void {
  const prefs = loadPrefs();
  if (!fs.existsSync(prefsFile())) savePrefs(prefs); // first run: persist the on-by-default choice
  applyLoginItem(prefs);
  if (!host.smoke) createTray(prefs);
  if (pendingLink) {
    handleDeepLink(pendingLink);
    pendingLink = undefined;
  }
}
