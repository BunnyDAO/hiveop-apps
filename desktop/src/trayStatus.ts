import type { BridgeState } from './bridgeSupervisor';

export function bridgeStatusLine(s: BridgeState): string {
  switch (s.kind) {
    case 'none':
      return 'Bridge: off';
    case 'unpaired':
      return 'Bridge: sign in to start';
    case 'starting':
      return 'Bridge: starting…';
    case 'running':
      return s.owner === 'cli' ? 'Bridge: running (command line)' : 'Bridge: running';
    case 'crashed':
      return `Bridge: restarting in ${Math.max(1, Math.round(s.retryInMs / 1000))}s`;
  }
}

export function agentsLine(n: number): string {
  return n <= 0 ? 'No local agents' : `${n} local agent${n === 1 ? '' : 's'}`;
}
