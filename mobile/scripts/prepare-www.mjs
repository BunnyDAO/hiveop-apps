// Writes www/site.js so the local offline page knows which site to retry.
// Run by `npm run sync` before `cap sync`. Needs Node 22.6+ (type stripping).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildShellAsset } from '../src/shellAsset.ts';
import { resolveSiteUrl } from '../src/appConfig.ts';

const site = resolveSiteUrl(process.env);
// Capacitor serves only offline.html itself from the local origin, not sibling files, so the
// page is one self-contained file: page/retry.js + page/offline.js inlined into the template.
const retry = readFileSync(new URL('../page/retry.js', import.meta.url), 'utf8').replace(/^export /gm, '');
const glue = readFileSync(new URL('../page/offline.js', import.meta.url), 'utf8');
const script = `${retry}\nconst SITE_URL = ${JSON.stringify(site.url)};\n${glue}`.replace(/<\/script/gi, '<\\/script');
const html = readFileSync(new URL('../page/offline.html', import.meta.url), 'utf8').replace('/*SCRIPT*/', () => script);
mkdirSync(new URL('../www/', import.meta.url), { recursive: true });
writeFileSync(new URL('../www/offline.html', import.meta.url), html);
console.log(`www/offline.html -> retries ${site.url}`);

// Native navigation policy data + the shell-bridge script (read by both native shells at startup).
const { version: shellVersion } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
writeFileSync(new URL('../www/hiveop-shell.json', import.meta.url), JSON.stringify(buildShellAsset(process.env, shellVersion)));
console.log('www/hiveop-shell.json written');

// One version source: mobile/package.json -> Xcode MARKETING_VERSION + Android versionName.
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const patch = (rel, re, to) => {
  const url = new URL(rel, import.meta.url);
  writeFileSync(url, readFileSync(url, 'utf8').replace(re, to));
};
patch('../ios/App/App.xcodeproj/project.pbxproj', /MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`);
patch('../android/app/build.gradle', /versionName "[^"]*"/, `versionName "${version}"`);
console.log(`native versions -> ${version}`);
