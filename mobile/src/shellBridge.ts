/**
 * The shell bridge: `window.hiveopApp`, the one global the site reads (via its app-shell reader).
 * The shape is fixed with the site repo:
 *   { version: string, platform: 'ios'|'android', capabilities: string[], has(cap): boolean }
 * Injected before the site's scripts run, and only when the page origin is the site origin.
 * The site feature-detects by capability, never by version. Later slices append capabilities.
 */
export type Platform = 'ios' | 'android';

export const BRIDGE_CAPABILITIES: readonly string[] = ['open-sheet', 'auth-bounce'];

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
  var members = {
    version: ${version},
    platform: ${platform},
    capabilities: caps,
    has: function (c) { return caps.indexOf(c) !== -1; }
  };
  ${authBounceMembers(opts.platform)}
  var bridge = Object.freeze(members);
  Object.defineProperty(window, "hiveopApp", { value: bridge, writable: false, configurable: false, enumerable: true });
})();`;
}

/**
 * ph-04: `bounce(provider)` asks the native shell to open the secure sheet and resolves
 * 'opened' (a handoff came back; it is then delivered to onHandoff with the verifier the shell
 * kept) or 'cancelled'. iOS talks to a WKScriptMessageHandler with reply; Android to a
 * WebMessageListener object scoped to the site origin. The verifier never touches page storage.
 */
function authBounceMembers(platform: Platform): string {
  const send =
    platform === 'ios'
      ? `function send(provider) {
      var h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.hiveopAuth;
      if (!h) return Promise.reject(new Error("auth bounce unavailable"));
      return Promise.resolve(h.postMessage({ provider: provider }));
    }`
      : `var waiting = {}, nextId = 1, wired = false;
    function wire(n) {
      if (wired) return;
      wired = true;
      n.onmessage = function (e) {
        var m; try { m = JSON.parse(e.data); } catch (_) { return; }
        var w = m && waiting[m.id];
        if (w) { delete waiting[m.id]; w(m); }
      };
    }
    function send(provider) {
      var n = window.hiveopAuthNative;
      if (!n || typeof n.postMessage !== "function") return Promise.reject(new Error("auth bounce unavailable"));
      wire(n);
      return new Promise(function (resolve) {
        var id = nextId++;
        waiting[id] = resolve;
        n.postMessage(JSON.stringify({ id: id, provider: provider }));
      });
    }`;
  return `if (caps.indexOf("auth-bounce") !== -1) {
    var listeners = [];
    ${send}
    members.bounce = function (provider) {
      if (provider !== "google" && provider !== "github") return Promise.reject(new Error("unknown provider"));
      return send(provider).then(function (r) {
        if (r && r.result === "cancelled") return "cancelled";
        if (r && r.result === "handoff" && typeof r.handoff === "string" && typeof r.verifier === "string") {
          var p = { handoff: r.handoff, verifier: r.verifier };
          listeners.slice().forEach(function (f) { try { f(p); } catch (_) {} });
          return "opened";
        }
        throw new Error("bad auth reply");
      });
    };
    members.onHandoff = function (cb) {
      if (typeof cb !== "function") return function () {};
      listeners.push(cb);
      return function () { var i = listeners.indexOf(cb); if (i !== -1) listeners.splice(i, 1); };
    };
  }`;
}
