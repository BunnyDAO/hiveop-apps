import { build } from 'esbuild';

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
};

await build({ ...common, entryPoints: ['src/preload.ts'], outfile: 'dist/preload.js' });
// ryc — the local device windows' preload (approve-device.html, devices.html).
await build({ ...common, entryPoints: ['src/devicesPreload.ts'], outfile: 'dist/devicesPreload.js' });
