import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { universalLinkTarget } from './universalLink.ts';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/universalLink.cases.json', import.meta.url), 'utf8')) as {
  siteOrigin: string;
  cases: [string, unknown, string | null][];
};

describe('universalLinkTarget (shared fixture; Swift and Java run the same rows)', () => {
  it.each(fixture.cases)('%s', (_name, input, want) => {
    expect(universalLinkTarget(input, fixture.siteOrigin)).toBe(want);
  });
});
