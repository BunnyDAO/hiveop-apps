import { describe, expect, it } from 'vitest';
import { quitPrompt } from './quitGuard';

describe('quitPrompt', () => {
  it('is null (quit now) with no local agents', () => {
    expect(quitPrompt(0)).toBeNull();
  });
  it('names the count', () => {
    expect(quitPrompt(1)).toMatch(/Stop 1 local agent\?/);
    expect(quitPrompt(3)).toMatch(/Stop 3 local agents\?/);
  });
});
