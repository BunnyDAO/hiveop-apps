import { describe, expect, it } from 'vitest';
import { retryDelayMs } from './backoff';

describe('retryDelayMs', () => {
  it('doubles from 2s and caps at 30s', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 50].map(retryDelayMs)).toEqual([2000, 4000, 8000, 16000, 30000, 30000, 30000, 30000]);
  });
  it('treats bad attempts as the first', () => {
    expect(retryDelayMs(-3)).toBe(2000);
    expect(retryDelayMs(NaN)).toBe(2000);
  });
});

import { isLoadFailure } from './backoff';

describe('isLoadFailure', () => {
  const offline = 'file:///x/resources/offline.html';
  it('counts main-frame network errors', () => {
    expect(isLoadFailure(-105, true, 'https://app.hiveop.io/', offline)).toBe(true);
  });
  it('ignores aborted navigations (-3), subframes and the error page itself', () => {
    expect(isLoadFailure(-3, true, 'https://app.hiveop.io/', offline)).toBe(false);
    expect(isLoadFailure(-105, false, 'https://app.hiveop.io/', offline)).toBe(false);
    expect(isLoadFailure(-105, true, offline + '?next=2000', offline)).toBe(false);
  });
});
