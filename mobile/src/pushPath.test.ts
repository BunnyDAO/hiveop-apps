import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pushTargetUrl, sanitizePushPath } from './pushPath.ts';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/pushPath.cases.json', import.meta.url), 'utf8')) as {
  siteOrigin: string;
  cases: [string, unknown, string][];
  urls: [string, unknown, string][];
};

describe('sanitizePushPath (shared fixture; Swift and Java run the same rows)', () => {
  it.each(fixture.cases)('%s', (_name, input, want) => {
    expect(sanitizePushPath(input)).toBe(want);
  });
});

describe('pushTargetUrl', () => {
  it.each(fixture.urls)('%s', (_name, input, want) => {
    expect(pushTargetUrl(input, fixture.siteOrigin)).toBe(want);
  });
});
