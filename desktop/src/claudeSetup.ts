// Claude Code setup (dsk-13). The app does not bundle `claude`. Before the managed
// bridge starts (or when the site asks) we make sure one exists: the user's own
// is used as is; otherwise Anthropic's official package is installed into the
// app's tools folder. Git is checked first: a Mac without developer tools has a
// /usr/bin/git stub that pops Apple's installer when run, so it is never run here.
import path from 'node:path';

export type ClaudeSetupState =
  | { kind: 'unknown' }
  | { kind: 'ready'; source: 'user' | 'app' }
  | { kind: 'installing' }
  | { kind: 'failed'; detail: string }
  | { kind: 'git-missing' };

export interface ClaudeSetupDeps {
  /** Is `claude` on the resolved PATH ('user') or in the app's tools folder ('app')? */
  findClaude(): Promise<'user' | 'app' | null>;
  hasGit(): Promise<boolean>;
  /** npm-install the official package into the tools folder; throws with a reason. */
  install(): Promise<void>;
  onState(s: ClaudeSetupState): void;
}

export interface ClaudeSetup {
  state(): ClaudeSetupState;
  /** Make sure claude is usable. Concurrent calls share one run; call again to retry. */
  ensure(): Promise<ClaudeSetupState>;
}

const DETAIL_MAX = 300;

export function createClaudeSetup(deps: ClaudeSetupDeps): ClaudeSetup {
  let state: ClaudeSetupState = { kind: 'unknown' };
  let inFlight: Promise<ClaudeSetupState> | null = null;
  const set = (s: ClaudeSetupState): ClaudeSetupState => {
    if (JSON.stringify(s) !== JSON.stringify(state)) {
      state = s;
      deps.onState(s);
    }
    return s;
  };

  async function go(): Promise<ClaudeSetupState> {
    if (!(await deps.hasGit())) return set({ kind: 'git-missing' });
    const have = await deps.findClaude();
    if (have) return set({ kind: 'ready', source: have });
    set({ kind: 'installing' });
    try {
      await deps.install();
      const now = await deps.findClaude();
      if (!now) throw new Error('Claude Code installed but not found');
      return set({ kind: 'ready', source: now });
    } catch (e) {
      return set({ kind: 'failed', detail: (e instanceof Error ? e.message : String(e)).slice(0, DETAIL_MAX) });
    }
  }

  return {
    state: () => state,
    ensure() {
      inFlight ??= go().finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
  };
}

/** First directory in `dirs` holding an executable called `name`. */
export function findOnPath(name: string, dirs: string[], isExecutable: (p: string) => boolean): string | null {
  for (const d of dirs) {
    if (!d) continue;
    const p = path.join(d, name);
    if (isExecutable(p)) return p;
  }
  return null;
}

export function gitAvailable(i: {
  platform: NodeJS.Platform;
  dirs: string[];
  exists(p: string): boolean;
  /** `xcode-select -p` succeeded (macOS). */
  developerToolsInstalled: boolean;
}): boolean {
  const name = i.platform === 'win32' ? 'git.exe' : 'git';
  const hits = i.dirs.filter((d) => d && i.exists(path.join(d, name))).map((d) => path.join(d, name));
  if (i.platform !== 'darwin') return hits.length > 0;
  // /usr/bin/git on a Mac is Apple's shim: real only once the developer tools exist.
  return hits.some((h) => h !== '/usr/bin/git') || (hits.includes('/usr/bin/git') && i.developerToolsInstalled);
}

/** One short line from npm's noisy stderr: its error code if it printed one. */
export function npmFailureReason(stderr: string): string {
  const code = /npm error code (\S+)/.exec(stderr)?.[1];
  return code ? `npm install failed (${code})` : 'npm install failed';
}
