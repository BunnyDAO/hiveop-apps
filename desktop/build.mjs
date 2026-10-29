import { build } from 'esbuild';

await build({
  entryPoints: ['src/preload.ts'],
  outfile: 'dist/preload.js',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
});
