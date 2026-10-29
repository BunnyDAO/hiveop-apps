/** What the site sees as `window.hiveopDesktop`. Later slices add capabilities. */
export interface HiveopDesktop {
  readonly version: string;
  readonly capabilities: readonly string[];
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

export function buildBridge(version: string): HiveopDesktop {
  return Object.freeze({ version, capabilities: Object.freeze([] as string[]) });
}
