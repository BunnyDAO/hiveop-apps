import { describe, expect, it } from 'vitest';
import cases from './fixtures/mediaOrigin.cases.json';
import { isSiteOrigin, mediaRequestAllowed, MIC_CAMERA_USAGE } from './mediaPolicy';

// The same fixture drives the Java test (MediaPolicyTest) and documents the Swift gate,
// so the three platforms cannot drift on what "only the site origin" means.
describe('isSiteOrigin', () => {
  it.each(cases.origin as Array<[string, string, boolean]>)('%s', (_n, origin, want) => {
    expect(isSiteOrigin(origin, cases.siteOrigin)).toBe(want);
  });
  it('works against a dev site (http localhost)', () => {
    expect(isSiteOrigin('http://localhost:5600/', 'http://localhost:5600')).toBe(true);
    expect(isSiteOrigin('http://localhost:5601/', 'http://localhost:5600')).toBe(false);
  });
});

describe('mediaRequestAllowed', () => {
  it.each(cases.resources as Array<[string, string[], boolean]>)('resources: %s', (_n, res, want) => {
    expect(mediaRequestAllowed(cases.siteOrigin, cases.siteOrigin, res)).toBe(want);
  });
  it('denies a foreign origin even for plain audio', () => {
    expect(mediaRequestAllowed('https://example.com', cases.siteOrigin, ['audio'])).toBe(false);
  });
});

describe('usage strings', () => {
  it('are short and plain', () => {
    for (const s of Object.values(MIC_CAMERA_USAGE)) {
      expect(s.length).toBeLessThanOrEqual(80);
    }
  });
});
