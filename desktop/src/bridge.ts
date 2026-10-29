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
}

/** What the preload wires in from the main process. Absent hooks mean absent capabilities. */
export interface BridgeHost {
  onOpenTab?: (cb: (url: string, from: number) => void) => () => void;
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
  const { onOpenTab } = host;
  if (!onOpenTab) return Object.freeze({ version, capabilities: Object.freeze([] as string[]) });
  const browser = Object.freeze({
    // The page only ever gets http(s) urls, whatever the main process sent.
    onOpenTab: (cb: (url: string, from: number) => void) =>
      onOpenTab((url, from) => (/^https?:\/\//i.test(url) ? cb(url, from) : undefined)),
  });
  return Object.freeze({ version, capabilities: Object.freeze(['native-browser']), browser });
}
