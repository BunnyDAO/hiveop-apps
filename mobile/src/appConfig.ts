import type { CapacitorConfig } from '@capacitor/cli';
import { inAppHosts } from './navPolicy.ts';

export const DEFAULT_SITE_URL = 'https://app.hiveop.io';
/** HiveOp dark. Also the native window and splash background, so there is no white flash. */
export const BRAND_DARK = '#0b0d12';

export interface Site {
  url: string;
  origin: string;
}

/** The site the shell shows. HIVEOP_SITE_URL overrides (staging, dev server). */
export function resolveSiteUrl(env: Record<string, string | undefined>): Site {
  for (const candidate of [env.HIVEOP_SITE_URL, DEFAULT_SITE_URL]) {
    if (!candidate) continue;
    try {
      const u = new URL(candidate);
      if (u.protocol === 'http:' || u.protocol === 'https:') return { url: u.href, origin: u.origin };
    } catch {
      /* fall through to the default */
    }
  }
  throw new Error('unreachable: default site url is valid');
}

export function userAgentSuffix(version: string, platform: 'ios' | 'android'): string {
  return `HiveOpApp/${version} (${platform})`;
}

/** The Capacitor config. `version` comes from mobile/package.json, the one source of truth. */
export function buildConfig(env: Record<string, string | undefined>, version: string): CapacitorConfig {
  const site = resolveSiteUrl(env);
  return {
    appId: 'io.hiveop.app',
    appName: 'HiveOp',
    webDir: 'www',
    backgroundColor: BRAND_DARK,
    server: {
      url: site.url,
      errorPath: 'offline.html',
      allowNavigation: inAppHosts({ siteOrigin: site.origin }),
      cleartext: new URL(site.url).protocol === 'http:',
    },
    ios: { appendUserAgent: userAgentSuffix(version, 'ios'), contentInset: 'never' },
    android: { appendUserAgent: userAgentSuffix(version, 'android') },
    plugins: {
      SplashScreen: {
        backgroundColor: BRAND_DARK,
        launchAutoHide: true,
        showSpinner: false,
      },
    },
  };
}
