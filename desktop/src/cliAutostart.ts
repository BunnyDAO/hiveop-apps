// The CLI's login autostart (dsk-12). `hiveop bridge install-service` writes a
// macOS LaunchAgent; taking over means removing it so the CLI bridge does not
// come back at login next to the managed one. Linux and Windows have none.
import path from 'node:path';

export const CLI_LABEL = 'com.wenrwa.bridge';

export interface AutostartDeps {
  platform: NodeJS.Platform;
  home: string;
  uid: number;
  /** The shell runs under a throwaway HOME (test seam): never call launchctl, it would hit the real login session. */
  scratchHome: boolean;
  exists(p: string): boolean;
  unlink(p: string): void;
  /** `launchctl <args>`; rejects with an error carrying the exit code. */
  launchctl(args: string[]): Promise<void>;
}

export const plistPath = (home: string): string => path.join(home, 'Library', 'LaunchAgents', `${CLI_LABEL}.plist`);

/** launchctl exit codes for "that job is not loaded": ESRCH (3) and "could not find service" (113). */
const NOT_LOADED = new Set([3, 113]);

export async function removeCliAutostart(d: AutostartDeps): Promise<'removed' | 'none'> {
  if (d.platform !== 'darwin') return 'none';
  const plist = plistPath(d.home);
  if (!d.exists(plist)) return 'none';
  if (!d.scratchHome) {
    try {
      await d.launchctl(['bootout', `gui/${d.uid}/${CLI_LABEL}`]);
    } catch (e) {
      const code = (e as { code?: unknown }).code;
      if (typeof code !== 'number' || !NOT_LOADED.has(code)) throw e; // unknown failure: leave the plist, change nothing
    }
  }
  d.unlink(plist);
  return 'removed';
}
