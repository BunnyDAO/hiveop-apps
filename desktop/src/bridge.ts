/** What the site sees as `window.hiveopDesktop`. Later slices add capabilities. */
export interface HiveopDesktop {
  readonly version: string;
  readonly capabilities: readonly string[];
  /** Present with the `native-browser` capability (dsk-08). */
  readonly browser?: {
    /**
     * A page in a native view asked for a new window; open `url` as a pane tab.
     * `from` is the webContentsId of that view (`webview.getWebContentsId()`).
     * Returns an unsubscribe.
     */
    readonly onOpenTab: (cb: (url: string, from: number) => void) => () => void;
  };
  /** Present with the `auth-bounce` capability (dsk-09). */
  readonly auth?: {
    /** Open Google sign-in in the system browser. Rejects if it could not open. */
    readonly bounce: () => Promise<void>;
    /** The system browser finished; the app holds the matching verifier. Returns an unsubscribe. */
    readonly onHandoff: (cb: (p: HandoffPayload) => void) => () => void;
  };
}

export interface HandoffPayload {
  handoff: string;
  verifier: string;
}

/** What the preload wires in from the main process. Absent hooks mean absent capabilities. */
export interface BridgeHost {
  onOpenTab?: (cb: (url: string, from: number) => void) => () => void;
  bounce?: () => Promise<void>;
  onHandoff?: (cb: (p: HandoffPayload) => void) => () => void;
}

/**
 * The preload only exposes the bridge to the configured site. Origins are
 * compared exactly; opaque ("null") and empty origins never match.
 */
export function isSiteOrigin(locationOrigin: string, siteOrigin: string): boolean {
  if (!siteOrigin || siteOrigin === 'null' || locationOrigin === 'null') return false;
  if (!/^https?:\/\//.test(siteOrigin)) return false;
  return locationOrigin === siteOrigin;
}

export function buildBridge(version: string, host: BridgeHost = {}): HiveopDesktop {
  const { onOpenTab, bounce, onHandoff } = host;
  const capabilities: string[] = [];
  const out: { version: string; capabilities: readonly string[]; browser?: HiveopDesktop['browser']; auth?: HiveopDesktop['auth'] } = {
    version,
    capabilities,
  };
  if (onOpenTab) {
    capabilities.push('native-browser');
    out.browser = Object.freeze({
      // The page only ever gets http(s) urls, whatever the main process sent.
      onOpenTab: (cb: (url: string, from: number) => void) =>
        onOpenTab((url, from) => (/^https?:\/\//i.test(url) ? cb(url, from) : undefined)),
    });
  }
  if (bounce && onHandoff) {
    capabilities.push('auth-bounce');
    out.auth = Object.freeze({
      bounce: () => bounce(),
      onHandoff: (cb: (p: HandoffPayload) => void) =>
        onHandoff((p) => (typeof p?.handoff === 'string' && typeof p?.verifier === 'string' ? cb({ handoff: p.handoff, verifier: p.verifier }) : undefined)),
    });
  }
  Object.freeze(capabilities);
  return Object.freeze(out);
}
