// Writes www/site.js so the local offline page knows which site to retry.
// Run by `npm run sync` before `cap sync`. Needs Node 22.6+ (type stripping).
import { writeFileSync } from 'node:fs';
import { resolveSiteUrl } from '../src/appConfig.ts';

const site = resolveSiteUrl(process.env);
writeFileSync(new URL('../www/site.js', import.meta.url), `export const SITE_URL = ${JSON.stringify(site.url)};\n`);
console.log(`www/site.js -> ${site.url}`);

// One version source: mobile/package.json -> Xcode MARKETING_VERSION + Android versionName.
import { readFileSync } from 'node:fs';
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const patch = (rel, re, to) => {
  const url = new URL(rel, import.meta.url);
  writeFileSync(url, readFileSync(url, 'utf8').replace(re, to));
};
patch('../ios/App/App.xcodeproj/project.pbxproj', /MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`);
patch('../android/app/build.gradle', /versionName "[^"]*"/, `versionName "${version}"`);
console.log(`native versions -> ${version}`);
