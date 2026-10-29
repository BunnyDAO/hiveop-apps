import { contextBridge, ipcRenderer } from 'electron';
import { buildBridge, isSiteOrigin } from './bridge';
import { withManagedBridge } from './managedBridgeApi';
import { withClaudeSetup } from './claudeSetupApi';

// Sandboxed preloads cannot require sibling files, so build.mjs bundles this
// into dist/preload.js. main.ts passes the site origin and app version as args.
function arg(name: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : '';
}

// Top frame only, and only on the configured site: any other origin gets nothing.
if (window.top === window && isSiteOrigin(window.location.origin, arg('hiveop-site-origin'))) {
  contextBridge.exposeInMainWorld('hiveopDesktop', withClaudeSetup(withManagedBridge(buildBridge(arg('hiveop-version'), {
      onOpenTab: (cb) => {
        const listener = (_e: unknown, url: unknown, from: unknown): void => {
          if (typeof url === 'string' && typeof from === 'number') cb(url, from);
        };
        ipcRenderer.on('hiveop:browser-open-tab', listener);
        return () => {
          ipcRenderer.removeListener('hiveop:browser-open-tab', listener);
        };
      },
      bounce: async () => {
        await ipcRenderer.invoke('hiveop:auth-bounce');
      },
      onHandoff: (cb) => {
        const listener = (_e: unknown, p: unknown): void => {
          const o = p as { handoff?: unknown; verifier?: unknown } | null;
          if (o && typeof o.handoff === 'string' && typeof o.verifier === 'string') cb({ handoff: o.handoff, verifier: o.verifier });
        };
        ipcRenderer.on('hiveop:auth-handoff', listener);
        return () => {
          ipcRenderer.removeListener('hiveop:auth-handoff', listener);
        };
      },
    }), {
      // dsk-10 — managed bridge (capability `managed-bridge`). Channel names mirror bridgeHost.ts.
      pair: (token) => ipcRenderer.invoke('hiveop:bridge-pair', token) as Promise<boolean>,
      state: () => ipcRenderer.invoke('hiveop:bridge-state'),
      // dsk-12 — taking over a CLI bridge. Channel names mirror bridgeHost.ts.
      takeOver: () => ipcRenderer.invoke('hiveop:bridge-takeover') as Promise<boolean>,
      declineTakeover: () => ipcRenderer.invoke('hiveop:bridge-decline-takeover') as Promise<void>,
      onState: (cb) => {
        const listener = (_e: unknown, v: unknown): void => cb(v);
        ipcRenderer.on('hiveop:bridge-state-changed', listener);
        return () => {
          ipcRenderer.removeListener('hiveop:bridge-state-changed', listener);
        };
      },
    }), {
      // dsk-13 — Claude Code setup (capability `claude-setup`). Channel names mirror bridgeHost.ts.
      state: () => ipcRenderer.invoke('hiveop:claude-state'),
      ensure: () => ipcRenderer.invoke('hiveop:claude-ensure'),
      installGit: () => ipcRenderer.invoke('hiveop:claude-install-git') as Promise<boolean>,
      onState: (cb) => {
        const listener = (_e: unknown, v: unknown): void => cb(v);
        ipcRenderer.on('hiveop:claude-state-changed', listener);
        return () => {
          ipcRenderer.removeListener('hiveop:claude-state-changed', listener);
        };
      },
    }));
}
