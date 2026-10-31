// Login-shell environment (dsk-10). GUI apps start with a minimal PATH, so the
// managed bridge gets the PATH the user's terminal would have: resolved once
// from their login shell, with the app's own tools folder first.

/**
 * The shell to ask for the login PATH, or none (Windows: GUI apps get the full PATH).
 * dsk-14: an app opened from a Linux menu may have no SHELL; the account's shell
 * (os.userInfo().shell, from /etc/passwd) is the same one a terminal would start.
 */
export function loginShell(platform: NodeJS.Platform, envShell: string | undefined, accountShell: () => string | null | undefined): string | undefined {
  if (platform === 'win32') return undefined;
  if (envShell) return envShell;
  try {
    return accountShell() || undefined;
  } catch {
    return undefined;
  }
}

/** The shell prints the PATH between markers so rc-file chatter cannot corrupt it. */
export const LOGIN_PATH_PROBE = { start: '__HIVEOP_PATH_START__', end: '__HIVEOP_PATH_END__' } as const;

/** Shell script for `$SHELL -ilc <script>`. */
export const LOGIN_PATH_SCRIPT = `printf '%s%s%s' '${LOGIN_PATH_PROBE.start}' "$PATH" '${LOGIN_PATH_PROBE.end}'`;

export function parseLoginPath(stdout: string | undefined): string | undefined {
  if (!stdout) return undefined;
  const a = stdout.indexOf(LOGIN_PATH_PROBE.start);
  if (a < 0) return undefined;
  const from = a + LOGIN_PATH_PROBE.start.length;
  const b = stdout.indexOf(LOGIN_PATH_PROBE.end, from);
  if (b < 0) return undefined;
  const path = stdout.slice(from, b).trim();
  return path === '' ? undefined : path;
}

export interface PathInputs {
  toolsDir: string;
  loginPath?: string;
  inheritedPath?: string;
  delimiter: string;
}

/** tools dir, then the login PATH, then whatever the app inherited; no empties or repeats. */
export function bridgePath(i: PathInputs): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const chunk of [i.toolsDir, i.loginPath, i.inheritedPath]) {
    for (const seg of (chunk ?? '').split(i.delimiter)) {
      if (seg !== '' && !seen.has(seg)) {
        seen.add(seg);
        out.push(seg);
      }
    }
  }
  return out.join(i.delimiter);
}
