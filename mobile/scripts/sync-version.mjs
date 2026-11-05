// One version source: mobile/package.json { version, build }.
// Android reads it directly (app/build.gradle). iOS: this rewrites the pbxproj.
// Usage: node scripts/sync-version.mjs [--bump]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = join(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
if (process.argv.includes('--bump')) {
  pkg.build = Number(pkg.build) + 1;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}
const pbx = join(root, 'ios/App/App.xcodeproj/project.pbxproj');
const next = readFileSync(pbx, 'utf8')
  .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${pkg.version};`)
  .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${pkg.build};`);
writeFileSync(pbx, next);
console.log(`version ${pkg.version} build ${pkg.build}`);
