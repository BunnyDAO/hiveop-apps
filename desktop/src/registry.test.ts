import { describe, expect, it } from 'vitest';
import { metaUrl, parseDist } from './registry';

describe('registry', () => {
  it('builds the metadata url for scoped and plain packages', () => {
    expect(metaUrl('@wenrwa/marketplace-cli', 'latest')).toBe('https://registry.npmjs.org/@wenrwa%2fmarketplace-cli/latest');
    expect(metaUrl('npm', '11.6.2')).toBe('https://registry.npmjs.org/npm/11.6.2');
  });
  it('reads version, tarball and integrity from a version document', () => {
    expect(parseDist({ version: '1.2.3', dist: { tarball: 'https://registry.npmjs.org/x/-/x-1.2.3.tgz', integrity: 'sha512-abc' } }))
      .toEqual({ version: '1.2.3', tarball: 'https://registry.npmjs.org/x/-/x-1.2.3.tgz', integrity: 'sha512-abc' });
  });
  it('rejects documents without a tarball and non-https tarballs', () => {
    expect(() => parseDist({ version: '1', dist: {} })).toThrow();
    expect(() => parseDist({ version: '1', dist: { tarball: 'http://evil/x.tgz' } })).toThrow();
    expect(() => parseDist(null)).toThrow();
  });
});
