/**
 * The shell bridge: `window.hiveopApp`, the one global the site reads (via its app-shell reader).
 * The shape is fixed with the site repo:
 *   { version: string, platform: 'ios'|'android', capabilities: string[], has(cap): boolean }
 * Injected before the site's scripts run, and only when the page origin is the site origin.
 * The site feature-detects by capability, never by version. Later slices append capabilities.
 */
export type Platform = 'ios' | 'android';

export const BRIDGE_CAPABILITIES: readonly string[] = ['open-sheet'];

export interface Bridge {
  version: string;
  platform: Platform;
  capabilities: string[];
  has(capability: string): boolean;
}

/** Exact origin match (scheme + host + port). */
export function isSiteOrigin(pageOrigin: string, siteOrigin: string): boolean {
  return pageOrigin !== '' && pageOrigin === siteOrigin;
}

export function buildBridge(opts: { version: string; platform: Platform; capabilities?: readonly string[] }): Bridge {
  const capabilities = Object.freeze([...(opts.capabilities ?? BRIDGE_CAPABILITIES)]) as string[];
  return {
    version: opts.version,
    platform: opts.platform,
    capabilities,
    has: (cap: string) => capabilities.includes(cap),
  };
}

/**
 * The script the native shell injects at document start. Self-contained and origin-guarded in
 * the page itself, so even a shell that injects into every page exposes nothing off the site.
 */
export function buildBridgeScript(opts: { siteOrigin: string; version: string; platform: Platform }): string {
  const site = JSON.stringify(opts.siteOrigin);
  const version = JSON.stringify(opts.version).replace(/</g, '\\u003c');
  const platform = JSON.stringify(opts.platform);
  const caps = JSON.stringify(BRIDGE_CAPABILITIES);
  return `(function(){
  "use strict";
  if (window.location.origin !== ${site} || window.hiveopApp) return;
  var caps = Object.freeze(${caps}.slice());
  var bridge = Object.freeze({
    version: ${version},
    platform: ${platform},
    capabilities: caps,
    has: function (c) { return caps.indexOf(c) !== -1; }
  });
  Object.defineProperty(window, "hiveopApp", { value: bridge, writable: false, configurable: false, enumerable: true });
})();`;
}
