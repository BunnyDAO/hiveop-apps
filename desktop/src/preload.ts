import { contextBridge, ipcRenderer } from 'electron';
import { buildBridge, isSiteOrigin } from './bridge';

// Sandboxed preloads cannot require sibling files, so build.mjs bundles this
// into dist/preload.js. main.ts passes the site origin and app version as args.
function arg(name: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : '';
}

// Top frame only, and only on the configured site: any other origin gets nothing.
if (window.top === window && isSiteOrigin(window.location.origin, arg('hiveop-site-origin'))) {
  contextBridge.exposeInMainWorld('hiveopDesktop', buildBridge(arg('hiveop-version'), {
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
    }));
}
