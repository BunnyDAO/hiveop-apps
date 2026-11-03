import { resolveSiteUrl } from './appConfig.ts';
import { AUTH_HOSTS } from './navPolicy.ts';
import { buildBridgeScript } from './shellBridge.ts';

export interface ShellAsset {
  siteOrigin: string;
  authHosts: string[];
  /** Backend base the sign-in sheet starts OAuth at (same default as the desktop app). */
  oauthApi: string;
  bridgeScripts: { ios: string; android: string };
}

export const DEFAULT_OAUTH_API = 'https://api.wenrwa.com/api/v1';

function resolveOauthApi(env: Record<string, string | undefined>): string {
  const raw = env.HIVEOP_OAUTH_API;
  if (raw) {
    try {
      const u = new URL(raw);
      if (u.protocol === 'http:' || u.protocol === 'https:') return raw.replace(/\/+$/, '');
    } catch {
      /* default */
    }
  }
  return DEFAULT_OAUTH_API;
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
    oauthApi: resolveOauthApi(env),
    bridgeScripts: {
      ios: buildBridgeScript({ siteOrigin: origin, version, platform: 'ios' }),
      android: buildBridgeScript({ siteOrigin: origin, version, platform: 'android' }),
    },
  };
}
