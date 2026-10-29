// Local agent count (dsk-10). The bridge exposes no session count over HTTP, so
// count what it does: each terminal is a direct child process of the bridge.
// Approximate on purpose (helpers filtered by name); good enough for "N agents
// are running" on Quit. Input is `ps -A -o pid=,ppid=,comm=`.

const IGNORED = /^(git|ps|ssh|ssh-agent|lsof|sleep)$|chrom|helper/i;

export function countChildPtys(psOutput: string, bridgePid: number): number {
  let n = 0;
  for (const line of psOutput.split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+(.+?)\s*$/.exec(line);
    if (!m || Number(m[2]) !== bridgePid) continue;
    const name = m[3].split(/[\\/]/).pop() ?? m[3];
    if (!IGNORED.test(name)) n++;
  }
  return n;
}
