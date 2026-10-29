// The managed bridge starts through this tiny entry. commander treats an
// Electron-as-Node argv as a packaged app (no script slot) unless
// process.defaultApp is set, so the entry puts the CLI script where commander
// expects it. (The connect token and the run-as-node flag are stripped from
// terminals by the CLI's envSanitize.)
//
// argv: [runtime, entry.js, <cli index.js>, ...cli args]
export const BRIDGE_ENTRY_SOURCE = `'use strict';
process.argv.splice(1, 2, process.argv[2]);
process.defaultApp = true;
require(process.argv[1]);
`;
