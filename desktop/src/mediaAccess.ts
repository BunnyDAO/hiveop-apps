/**
 * Mic and camera access for the app window, answered by macOS's own setting.
 *
 * Electron on its own reports every permission as granted, so the site's
 * "already allowed?" check said yes before macOS had been asked. The site
 * warms the mic on hover when it's allowed (arena lib/micWarmup), so each
 * hover over a pane mic raised the macOS prompt. Checks now report the OS
 * status; only a real request (a click) asks macOS, once.
 */
export type OsMediaStatus = 'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown';
export type OsDevice = 'microphone' | 'camera';

export interface MediaAccessDeps {
  status(device: OsDevice): OsMediaStatus;
  ask(device: OsDevice): Promise<boolean>;
}

function devicesFor(mediaTypes: readonly string[]): OsDevice[] {
  const out: OsDevice[] = [];
  if (mediaTypes.includes('audio')) out.push('microphone');
  if (mediaTypes.includes('video')) out.push('camera');
  return out;
}

/** Permission check (no prompt): media is allowed only when macOS already allows it. */
export function checkMedia(deps: MediaAccessDeps, permission: string, mediaType?: string): boolean {
  if (permission !== 'media') return true;
  const devices = devicesFor(mediaType ? [mediaType] : []);
  if (devices.length === 0) return false;
  return devices.every((d) => deps.status(d) === 'granted');
}

/** Permission request (a click): ask macOS for each device; others keep Electron's default. */
export async function requestMedia(deps: MediaAccessDeps, permission: string, mediaTypes: readonly string[] = []): Promise<boolean> {
  if (permission !== 'media') return true;
  const devices = devicesFor(mediaTypes);
  if (devices.length === 0) return false;
  for (const d of devices) {
    if (!(await deps.ask(d))) return false;
  }
  return true;
}
