export const DEFAULT_SITE_URL = 'https://app.hiveop.io';

export interface Site {
  url: string;
  origin: string;
}

/** The site the shell shows. HIVEOP_SITE_URL overrides (staging, localhost:3000). */
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

export function userAgentFor(defaultUserAgent: string, version: string): string {
  return `${defaultUserAgent} HiveOpDesktop/${version}`;
}
