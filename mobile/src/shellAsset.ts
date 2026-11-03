import { resolveSiteUrl } from './appConfig.ts';
import { AUTH_HOSTS } from './navPolicy.ts';
import { buildBridgeScript } from './shellBridge.ts';

export interface ShellAsset {
  siteOrigin: string;
  authHosts: string[];
  bridgeScripts: { ios: string; android: string };
}

/**
 * What the native shells read at startup (www/hiveop-shell.json, written by `npm run prepare`):
 * the data their navigation policy mirrors, and the bridge script to inject. One source, so the
 * native side never hard-codes the site.
 */
export function buildShellAsset(env: Record<string, string | undefined>, version: string): ShellAsset {
  const { origin } = resolveSiteUrl(env);
  return {
    siteOrigin: origin,
    authHosts: [...AUTH_HOSTS],
    bridgeScripts: {
      ios: buildBridgeScript({ siteOrigin: origin, version, platform: 'ios' }),
      android: buildBridgeScript({ siteOrigin: origin, version, platform: 'android' }),
    },
  };
}
