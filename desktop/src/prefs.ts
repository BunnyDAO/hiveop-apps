export interface Prefs {
  startAtLogin: boolean;
}

export const DEFAULT_PREFS: Prefs = { startAtLogin: true };

export function parsePrefs(text: string | undefined): Prefs {
  if (!text) return { ...DEFAULT_PREFS };
  try {
    const o: unknown = JSON.parse(text);
    const v = (o as { startAtLogin?: unknown } | null)?.startAtLogin;
    if (typeof v === 'boolean') return { startAtLogin: v };
  } catch {
    /* fall through */
  }
  return { ...DEFAULT_PREFS };
}

export function serializePrefs(p: Prefs): string {
  return JSON.stringify({ startAtLogin: p.startAtLogin });
}
