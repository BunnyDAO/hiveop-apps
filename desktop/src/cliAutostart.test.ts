import { describe, expect, it } from 'vitest';
import { CLI_LABEL, removeCliAutostart, type AutostartDeps } from './cliAutostart';

function harness(over: Partial<AutostartDeps> = {}) {
  const calls: string[] = [];
  const files = new Set<string>(['/home/u/Library/LaunchAgents/com.wenrwa.bridge.plist']);
  const deps: AutostartDeps = {
    platform: 'darwin',
    home: '/home/u',
    uid: 501,
    scratchHome: false,
    exists: (p) => files.has(p),
    unlink: (p) => (calls.push(`unlink ${p}`), void files.delete(p)),
    launchctl: async (args) => void calls.push(`launchctl ${args.join(' ')}`),
    ...over,
  };
  return { deps, calls, files };
}

describe('removeCliAutostart', () => {
  it('Mac: boots the job out, then deletes the plist', async () => {
    const h = harness();
    expect(await removeCliAutostart(h.deps)).toBe('removed');
    expect(h.calls).toEqual([`launchctl bootout gui/501/${CLI_LABEL}`, 'unlink /home/u/Library/LaunchAgents/com.wenrwa.bridge.plist']);
  });

  it('other systems have no CLI autostart: nothing to do, nothing touched', async () => {
    for (const platform of ['linux', 'win32'] as const) {
      const h = harness({ platform });
      expect(await removeCliAutostart(h.deps)).toBe('none');
      expect(h.calls).toEqual([]);
    }
  });

  it('no plist: nothing to do', async () => {
    const h = harness();
    h.files.clear();
    expect(await removeCliAutostart(h.deps)).toBe('none');
    expect(h.calls).toEqual([]);
  });

  it('a job that is not loaded is fine: the file still goes', async () => {
    const h = harness({
      launchctl: async () => {
        throw Object.assign(new Error('Boot-out failed: 3: No such process'), { code: 3 });
      },
    });
    expect(await removeCliAutostart(h.deps)).toBe('removed');
    expect(h.files.size).toBe(0);
  });

  it('any other launchctl failure leaves the plist alone', async () => {
    const h = harness({
      launchctl: async () => {
        throw Object.assign(new Error('Operation not permitted'), { code: 1 });
      },
    });
    await expect(removeCliAutostart(h.deps)).rejects.toThrow('Operation not permitted');
    expect(h.files.size).toBe(1);
  });

  it('under a scratch home it never calls launchctl (that would hit the real login session)', async () => {
    const h = harness({ scratchHome: true });
    expect(await removeCliAutostart(h.deps)).toBe('removed');
    expect(h.calls).toEqual(['unlink /home/u/Library/LaunchAgents/com.wenrwa.bridge.plist']);
  });
});
