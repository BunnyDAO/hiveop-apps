import { describe, expect, it } from 'vitest';
import { createClaudeSetup, findOnPath, gitAvailable, npmFailureReason, type ClaudeSetupDeps, type ClaudeSetupState } from './claudeSetup';

function harness(over: Partial<ClaudeSetupDeps> = {}) {
  const log: string[] = [];
  const states: ClaudeSetupState[] = [];
  let found: 'user' | 'app' | null = null;
  const deps: ClaudeSetupDeps = {
    findClaude: async () => found,
    hasGit: async () => true,
    install: async () => {
      log.push('install');
      found = 'app';
    },
    onState: (s) => states.push(s),
    ...over,
  };
  return { s: createClaudeSetup(deps), log, states, setFound: (f: 'user' | 'app' | null) => (found = f) };
}

describe('claude setup', () => {
  it('starts unknown', () => expect(harness().s.state()).toEqual({ kind: 'unknown' }));

  it('claude absent: installs it, goes installing then ready(app)', async () => {
    const h = harness();
    expect(await h.s.ensure()).toEqual({ kind: 'ready', source: 'app' });
    expect(h.log).toEqual(['install']);
    expect(h.states.map((s) => s.kind)).toEqual(['installing', 'ready']);
  });

  it("claude present: the user's own is used and nothing is installed", async () => {
    const h = harness();
    h.setFound('user');
    expect(await h.s.ensure()).toEqual({ kind: 'ready', source: 'user' });
    expect(h.log).toEqual([]);
    expect(h.states.map((s) => s.kind)).toEqual(['ready']);
  });

  it('an install that throws is failed with the reason, and Try again can succeed', async () => {
    let boom = true;
    const h = harness({
      install: async () => {
        if (boom) throw new Error('npm install failed: ENOSPC');
        h.setFound('app');
      },
    });
    expect(await h.s.ensure()).toEqual({ kind: 'failed', detail: 'npm install failed: ENOSPC' });
    boom = false;
    expect(await h.s.ensure()).toEqual({ kind: 'ready', source: 'app' });
  });

  it('an install that leaves no claude behind is a failure, not a success', async () => {
    const h = harness({ install: async () => undefined });
    expect((await h.s.ensure()).kind).toBe('failed');
  });

  it('missing git: says so, installs nothing, and re-checks on the next ensure', async () => {
    let git = false;
    const h = harness({ hasGit: async () => git });
    expect(await h.s.ensure()).toEqual({ kind: 'git-missing' });
    expect(h.log).toEqual([]);
    git = true;
    expect((await h.s.ensure()).kind).toBe('ready');
    expect(h.log).toEqual(['install']);
  });

  it('concurrent ensures share one install', async () => {
    const h = harness();
    const [a, b] = await Promise.all([h.s.ensure(), h.s.ensure()]);
    expect(a).toEqual(b);
    expect(h.log).toEqual(['install']);
  });

  it('truncates a long failure reason', async () => {
    const h = harness({
      install: async () => {
        throw new Error('x'.repeat(1000));
      },
    });
    const r = await h.s.ensure();
    expect(r.kind === 'failed' && r.detail.length).toBeLessThanOrEqual(300);
  });
});

describe('findOnPath', () => {
  const exec = new Set(['/a/bin/claude', '/b/bin/claude']);
  it('returns the first directory holding an executable of that name', () => {
    expect(findOnPath('claude', ['/x', '/b/bin', '/a/bin'], (p) => exec.has(p))).toBe('/b/bin/claude');
  });
  it('is null when absent', () => expect(findOnPath('claude', ['/x'], () => false)).toBeNull());
});

describe('gitAvailable', () => {
  const base = { platform: 'darwin' as NodeJS.Platform, dirs: ['/usr/bin', '/bin'], exists: (p: string) => p === '/usr/bin/git', developerToolsInstalled: false };
  it('on a Mac, /usr/bin/git alone is only a stub until the developer tools are installed', () => {
    expect(gitAvailable(base)).toBe(false);
    expect(gitAvailable({ ...base, developerToolsInstalled: true })).toBe(true);
  });
  it('a real git elsewhere on the Mac counts', () => {
    expect(gitAvailable({ ...base, dirs: ['/opt/homebrew/bin', '/usr/bin'], exists: (p) => p === '/opt/homebrew/bin/git' || p === '/usr/bin/git' })).toBe(true);
  });
  it('elsewhere, any git on PATH counts', () => {
    expect(gitAvailable({ ...base, platform: 'linux' })).toBe(true);
    expect(gitAvailable({ ...base, platform: 'linux', exists: () => false })).toBe(false);
  });
  it('windows looks for git.exe', () => {
    expect(gitAvailable({ ...base, platform: 'win32', dirs: ['C:\\Git\\cmd'], exists: (p) => p.endsWith('git.exe') })).toBe(true);
  });
});

describe('npmFailureReason', () => {
  it('names the npm error code in one short line', () => {
    expect(npmFailureReason('Electron failed: npm error code ECONNREFUSED\nnpm error syscall connect\nnpm error errno ECONNREFUSED')).toBe(
      'npm install failed (ECONNREFUSED)',
    );
  });
  it('falls back to a plain line without a code', () => {
    expect(npmFailureReason('something odd')).toBe('npm install failed');
  });
});
