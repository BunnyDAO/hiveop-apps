import type { PackageDist } from './bridgeInstaller';

export const REGISTRY = 'https://registry.npmjs.org';
export const CLI_PACKAGE = '@wenrwa/marketplace-cli';
/** The npm that installs the CLI's dependencies. Pinned: Electron 45 runs Node 24, which this supports. */
export const NPM_VERSION = '11.6.2';

export function metaUrl(name: string, versionOrTag: string): string {
  return `${REGISTRY}/${name.replace('/', '%2f')}/${versionOrTag}`;
}

export function parseDist(doc: unknown): PackageDist {
  const d = doc as { version?: unknown; dist?: { tarball?: unknown; integrity?: unknown } } | null;
  const tarball = d?.dist?.tarball;
  if (typeof d?.version !== 'string' || typeof tarball !== 'string' || !tarball.startsWith('https://')) {
    throw new Error('unexpected registry document');
  }
  return { version: d.version, tarball, integrity: typeof d.dist?.integrity === 'string' ? d.dist.integrity : undefined };
}
