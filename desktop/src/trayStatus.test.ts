import { describe, expect, it } from 'vitest';
import { agentsLine, bridgeStatusLine } from './trayStatus';

describe('tray status lines', () => {
  it('names each bridge state in few words', () => {
    expect(bridgeStatusLine({ kind: 'none' })).toBe('Bridge: off');
    expect(bridgeStatusLine({ kind: 'unpaired' })).toBe('Bridge: sign in to start');
    expect(bridgeStatusLine({ kind: 'starting' })).toBe('Bridge: starting…');
    expect(bridgeStatusLine({ kind: 'running', owner: 'managed' })).toBe('Bridge: running');
    expect(bridgeStatusLine({ kind: 'running', owner: 'cli' })).toBe('Bridge: running (command line)');
    expect(bridgeStatusLine({ kind: 'crashed', attempt: 2, retryInMs: 4000 })).toBe('Bridge: restarting in 4s');
  });
  it('pluralises local agents', () => {
    expect(agentsLine(0)).toBe('No local agents');
    expect(agentsLine(1)).toBe('1 local agent');
    expect(agentsLine(3)).toBe('3 local agents');
  });
});
