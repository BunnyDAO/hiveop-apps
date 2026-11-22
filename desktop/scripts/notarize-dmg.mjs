// After `npm run dist:mac`: electron-builder notarizes the .app inside the dmg, but not the dmg.
// This notarizes + staples the dmg itself (so Gatekeeper accepts the download offline), then
// rebuilds its blockmap and latest-mac.yml, because stapling changes the file's bytes and hash.
// Needs APPLE_API_KEY (path to .p8), APPLE_API_KEY_ID, APPLE_API_ISSUER in the environment.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { buildBlockMap } = require('app-builder-lib/out/targets/blockmap/blockmap.js');
const yaml = require('js-yaml');

const release = path.resolve(import.meta.dirname, '..', 'release');
const dmg = path.join(release, 'HiveOp-mac-universal.dmg');
const ymlPath = path.join(release, 'latest-mac.yml');

for (const k of ['APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER']) {
  if (!process.env[k]) throw new Error(`${k} is not set (source ~/.hiveop-keys/devid/notarize.env)`);
}

const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' });

run('codesign', ['--verify', '--verbose=2', dmg]);
run('xcrun', [
  'notarytool', 'submit', dmg,
  '--key', process.env.APPLE_API_KEY,
  '--key-id', process.env.APPLE_API_KEY_ID,
  '--issuer', process.env.APPLE_API_ISSUER,
  '--wait',
]);
run('xcrun', ['stapler', 'staple', dmg]);
run('xcrun', ['stapler', 'validate', dmg]);

const info = await buildBlockMap(dmg, 'gzip', `${dmg}.blockmap`);
const doc = yaml.load(readFileSync(ymlPath, 'utf8'));
for (const f of doc.files) {
  if (f.url === path.basename(dmg)) {
    f.sha512 = info.sha512;
    f.size = info.size;
  }
}
if (doc.path === path.basename(dmg)) doc.sha512 = info.sha512;
writeFileSync(ymlPath, yaml.dump(doc, { lineWidth: 8000 }));
console.log(`dmg notarized + stapled; ${path.basename(ymlPath)} updated (size ${info.size})`);
