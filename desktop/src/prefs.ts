export interface Prefs {
  startAtLogin: boolean;
  /** The user said "Not now" to HiveOp managing their CLI bridge (dsk-12): never ask again. */
  takeoverDeclined: boolean;
}

export const DEFAULT_PREFS: Prefs = { startAtLogin: true, takeoverDeclined: false };

export function parsePrefs(text: string | undefined): Prefs {
  if (!text) return { ...DEFAULT_PREFS };
  try {
    const o = JSON.parse(text) as { startAtLogin?: unknown; takeoverDeclined?: unknown } | null;
    if (typeof o?.startAtLogin === 'boolean') {
      return { startAtLogin: o.startAtLogin, takeoverDeclined: o.takeoverDeclined === true };
    }
  } catch {
    /* fall through */
  }
  return { ...DEFAULT_PREFS };
}

export function serializePrefs(p: Prefs): string {
  return JSON.stringify({ startAtLogin: p.startAtLogin, takeoverDeclined: p.takeoverDeclined });
}
