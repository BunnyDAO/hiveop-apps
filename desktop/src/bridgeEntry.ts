// The managed bridge runs through this tiny entry so the connect token and the
// "run Electron as Node" flag do not leak into every terminal the bridge opens.
// The CLI reads WENRWA_BRIDGE_TOKEN once, at start; the entry removes it from the
// process environment right after (and the flag at once). CLI follow-up: strip
// both in envSanitize so this shim is belt-and-braces.
//
// argv: [runtime, entry.js, <cli index.js>, ...cli args]
export const BRIDGE_ENTRY_SOURCE = `'use strict';
const cli = process.argv[2];
const ms = Number(process.env.HIVEOP_TOKEN_SCRUB_MS) || 3000;
delete process.env.ELECTRON_RUN_AS_NODE;
delete process.env.HIVEOP_TOKEN_SCRUB_MS;
process.argv.splice(1, 2, cli);
// commander treats Electron-as-Node argv as a packaged app (no script slot) unless defaultApp is set.
process.defaultApp = true;
setTimeout(() => { delete process.env.WENRWA_BRIDGE_TOKEN; }, ms).unref();
require(cli);
`;
