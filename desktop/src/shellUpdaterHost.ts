// Electron side of the shell updater (dsk-16). Decisions live in shellUpdater.ts.
import { app, net } from 'electron';
import { autoUpdater } from 'electron-updater';
import {
  CHECK_INTERVAL_MS,
  isNewer,
  latestReleaseFeed,
  parseLatestRelease,
  updateMode,
  updatesEnabled,
  type UpdateState,
} from './shellUpdater';

export interface ShellUpdaterDeps {
  env: Record<string, string | undefined>;
  onChange(s: UpdateState): void;
}

export interface ShellUpdater {
  start(): void;
  stop(): void;
  restart(): void;
}

export function createShellUpdater(deps: ShellUpdaterDeps): ShellUpdater {
  const gate = updatesEnabled(deps.env);
  const mode = updateMode({ packaged: app.isPackaged, platform: process.platform, appImage: process.env.APPIMAGE });
  // An unpackaged run only checks when a test feed is set (and then only to notify).
  const effective = mode === 'off' && gate.feed ? 'notify' : mode;
  let timer: NodeJS.Timeout | null = null;

  async function checkNotify(): Promise<void> {
    try {
      const res = await net.fetch(latestReleaseFeed(gate.feed), { headers: { accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000) });
      if (!res.ok) return;
      const rel = parseLatestRelease(await res.json());
      if (rel && isNewer(rel.version, app.getVersion())) deps.onChange({ kind: 'available', version: rel.version, url: rel.url });
    } catch {
      /* offline or rate limited: try again tomorrow */
    }
  }

  function checkAuto(): void {
    autoUpdater.checkForUpdates().catch(() => undefined);
  }

  return {
    start() {
      if (!gate.enabled || effective === 'off') return;
      if (effective === 'auto') {
        autoUpdater.autoDownload = true;
        autoUpdater.autoInstallOnAppQuit = true;
        if (gate.feed) autoUpdater.setFeedURL({ provider: 'generic', url: gate.feed });
        autoUpdater.on('update-available', (i) => deps.onChange({ kind: 'downloading', version: i.version }));
        autoUpdater.on('update-downloaded', (i) => deps.onChange({ kind: 'ready', version: i.version }));
        autoUpdater.on('error', () => undefined);
      }
      const check = effective === 'auto' ? checkAuto : () => void checkNotify();
      check();
      timer = setInterval(check, CHECK_INTERVAL_MS);
      timer.unref();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    restart() {
      autoUpdater.quitAndInstall();
    },
  };
}
