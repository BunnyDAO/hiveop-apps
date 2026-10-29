import { contextBridge } from 'electron';
import { buildBridge, isSiteOrigin } from './bridge';

// Sandboxed preloads cannot require sibling files, so build.mjs bundles this
// into dist/preload.js. main.ts passes the site origin and app version as args.
function arg(name: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : '';
}

// Top frame only, and only on the configured site: any other origin gets nothing.
if (window.top === window && isSiteOrigin(window.location.origin, arg('hiveop-site-origin'))) {
  contextBridge.exposeInMainWorld('hiveopDesktop', buildBridge(arg('hiveop-version')));
}
