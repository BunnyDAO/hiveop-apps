// ryc (PRD reach-your-computer D3) — native "Allow a new device?" and "Devices that can reach
// this Mac" windows. A phone pairs by showing a 6-digit code; the person types that code HERE.
// The Mac's own copy of the code never leaves this process: comparing is the security, so the
// window never displays it and the input is never pre-filled. Thin Electron glue — the logic
// lives in pairingWatcher / viewerControlClient / approvedViewers, which are tested without it.
import { app, BrowserWindow, dialog, ipcMain, Notification, type IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import { listApprovedViewers, removeApprovedViewer, type ViewerRow } from './approvedViewers';
import { createPairingWatcher, type PairingWatcher } from './pairingWatcher';
import { approvalOutcome, approveCode, fetchPending, readControlInfo, type ApprovalOutcome, type ApproveResult } from './viewerControlClient';

// Channel names mirror devicesPreload.ts.
const CH = {
  state: 'hiveop-devices:approval-state',
  push: 'hiveop-devices:approval-changed',
  approve: 'hiveop-devices:approve',
  deny: 'hiveop-devices:deny',
  list: 'hiveop-devices:list',
  remove: 'hiveop-devices:remove',
  listPush: 'hiveop-devices:list-changed',
  close: 'hiveop-devices:close',
} as const;

/** What the approval window may know: the device's name. Never the code. */
export type ApprovalView =
  | { kind: 'ask'; pairingId: string; name: string }
  | { kind: 'expired' }
  | ApprovalOutcome;

export interface DevicesUiOptions {
  /** ~/.wen-market of the home the bridge runs under. */
  dir(): string;
  /** Hidden-window automated runs: windows never show, no notifications. */
  smoke: boolean;
  backgroundColor?: string;
}

export interface DevicesUi {
  start(): void;
  stop(): void;
  openDevices(): void;
  /** Test/screenshot seams. */
  approvalWindow(): BrowserWindow | null;
  devicesWindow(): BrowserWindow | null;
  watcher: PairingWatcher;
}

export function installDevicesUi(o: DevicesUiOptions): DevicesUi {
  const preload = path.join(__dirname, 'devicesPreload.js');
  const res = path.join(__dirname, '..', 'resources');
  const bg = o.backgroundColor ?? '#070e13'; // HiveOp's page colour (arena --m-frame)

  let approvalWin: BrowserWindow | null = null;
  let devicesWin: BrowserWindow | null = null;
  let view: ApprovalView | null = null;
  const queue: { pairingId: string; name: string }[] = [];
  const handled = new Set<string>(); // denied or tried once: never asked about again

  const live = (w: BrowserWindow | null): w is BrowserWindow => !!w && !w.isDestroyed();
  const from = (e: IpcMainInvokeEvent, w: BrowserWindow | null): boolean => live(w) && e.sender === w.webContents;

  function makeWindow(file: string, title: string, size: { width: number; height: number }, resizable: boolean): BrowserWindow {
    const w = new BrowserWindow({
      ...size,
      minWidth: size.width,
      minHeight: resizable ? 320 : size.height,
      title,
      show: false,
      resizable,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      backgroundColor: bg,
      webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, webviewTag: false, preload },
    });
    w.removeMenu();
    // Local file only: no navigation, no new windows.
    w.webContents.on('will-navigate', (e) => e.preventDefault());
    w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    void w.loadFile(path.join(res, file));
    return w;
  }

  function present(w: BrowserWindow, title: string, body: string): void {
    if (o.smoke) return;
    const appActive = BrowserWindow.getFocusedWindow() !== null;
    if (appActive) {
      w.show();
      w.focus();
      return;
    }
    // In the background: appear without stealing the keyboard, and say so in Notification Center.
    w.showInactive();
    app.dock?.bounce('informational');
    if (Notification.isSupported()) {
      const n = new Notification({ title, body, silent: false });
      n.on('click', () => {
        if (!live(w)) return;
        w.show();
        w.focus();
        app.focus({ steal: true });
      });
      n.show();
    }
  }

  function push(): void {
    if (live(approvalWin)) approvalWin.webContents.send(CH.push, view);
  }

  function next(): void {
    const n = queue.shift();
    if (!n) {
      view = null;
      if (live(approvalWin)) approvalWin.close();
      return;
    }
    view = { kind: 'ask', pairingId: n.pairingId, name: n.name };
    if (!live(approvalWin)) {
      approvalWin = makeWindow('approve-device.html', 'Allow a new device?', { width: 400, height: 470 }, false);
      const w = approvalWin;
      w.on('closed', () => {
        if (approvalWin !== w) return;
        approvalWin = null;
        // Closing the window is a deny for the one on screen; the next waiting request gets its own window.
        if (view?.kind === 'ask') handled.add(view.pairingId);
        view = null;
        if (queue.length) setImmediate(next);
      });
      w.once('ready-to-show', () => present(w, 'Allow a new device?', n.name));
    } else {
      push();
      present(approvalWin, 'Allow a new device?', n.name);
    }
  }

  const watcher = createPairingWatcher({
    readInfo: () => readControlInfo(o.dir()),
    fetchPending,
    schedule: (fn, ms) => {
      const t = setTimeout(fn, ms);
      return () => clearTimeout(t);
    },
    onNew: (p) => {
      if (handled.has(p.pairingId)) return;
      queue.push({ pairingId: p.pairingId, name: p.name });
      if (!view) next();
    },
    onGone: (id) => {
      const i = queue.findIndex((q) => q.pairingId === id);
      if (i >= 0) queue.splice(i, 1);
      // Approved from the CLI, expired, or the bridge stopped: the open question no longer stands.
      if (view?.kind === 'ask' && view.pairingId === id) {
        view = { kind: 'expired' };
        push();
      }
    },
  });

  const rows = (): ViewerRow[] => listApprovedViewers(o.dir());
  const refreshList = (): void => {
    if (live(devicesWin)) devicesWin.webContents.send(CH.listPush, rows());
  };

  ipcMain.handle(CH.state, (e) => (from(e, approvalWin) ? view : null));
  ipcMain.handle(CH.approve, async (e, code: unknown): Promise<ApprovalView | null> => {
    if (!from(e, approvalWin) || view?.kind !== 'ask') return view;
    const asked = view.pairingId;
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return { kind: 'invalid' };
    if (!watcher.get(asked)) {
      view = { kind: 'expired' };
      return view;
    }
    const info = readControlInfo(o.dir());
    let r: ApproveResult | Error;
    try {
      r = info ? await approveCode(info, code, asked) : new Error('no bridge');
    } catch (err) {
      r = err instanceof Error ? err : new Error(String(err));
    }
    const out = approvalOutcome(r);
    // One attempt per request: a wrong code spends it here, whatever the bridge keeps.
    if (out.kind === 'approved' || out.kind === 'mismatch') handled.add(asked);
    if (out.kind === 'approved' || out.kind === 'mismatch') view = out;
    if (out.kind === 'approved') {
      refreshList();
      void watcher.poll(); // drop it from the pending set now rather than in 2s
    }
    return out;
  });
  ipcMain.handle(CH.deny, (e) => {
    if (!from(e, approvalWin)) return;
    if (view?.kind === 'ask') handled.add(view.pairingId);
    view = null;
    next();
  });
  ipcMain.handle(CH.close, (e) => {
    if (from(e, approvalWin)) {
      if (view?.kind === 'ask') handled.add(view.pairingId);
      view = null;
      next();
    } else if (from(e, devicesWin)) {
      devicesWin?.close();
    }
  });
  ipcMain.handle(CH.list, (e) => (from(e, devicesWin) ? rows() : null));
  ipcMain.handle(CH.remove, async (e, keyId: unknown) => {
    if (!from(e, devicesWin) || typeof keyId !== 'string') return false;
    const hit = rows().find((r) => r.keyId === keyId);
    if (!hit) return false;
    if (!o.smoke && live(devicesWin)) {
      const { response } = await dialog.showMessageBox(devicesWin, {
        type: 'warning',
        buttons: ['Remove', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
        message: `Remove ${hit.name}?`,
        detail: 'It can no longer reach this Mac.',
      });
      if (response !== 0) return false;
    }
    let ok = false;
    try {
      ok = removeApprovedViewer(o.dir(), keyId);
    } catch {
      ok = false;
    }
    refreshList();
    return ok;
  });

  return {
    start: () => watcher.start(),
    stop: () => watcher.stop(),
    openDevices() {
      if (live(devicesWin)) {
        if (!o.smoke) {
          devicesWin.show();
          devicesWin.focus();
        }
        refreshList();
        return;
      }
      devicesWin = makeWindow('devices.html', 'Devices that can reach this Mac', { width: 460, height: 520 }, true);
      const w = devicesWin;
      w.on('focus', refreshList);
      w.on('closed', () => {
        if (devicesWin === w) devicesWin = null;
      });
      w.once('ready-to-show', () => {
        if (!o.smoke) {
          w.show();
          w.focus();
        }
      });
    },
    approvalWindow: () => (live(approvalWin) ? approvalWin : null),
    devicesWindow: () => (live(devicesWin) ? devicesWin : null),
    watcher,
  };
}
