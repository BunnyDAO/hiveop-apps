import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BRIDGE_ENTRY_SOURCE } from './bridgeEntry';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hiveop-entry-'));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('bridge entry shim', () => {
  it('runs the CLI with its own argv, then scrubs the token and the runtime flag from the environment', () => {
    const entry = path.join(dir, 'entry.js');
    const cli = path.join(dir, 'cli.js');
    fs.writeFileSync(entry, BRIDGE_ENTRY_SOURCE);
    fs.writeFileSync(
      cli,
      `const seen = { defaultApp: process.defaultApp, argv: process.argv.slice(1).map((a, i) => (i === 0 ? 'cli' : a)), early: process.env.WENRWA_BRIDGE_TOKEN };
       setTimeout(() => { console.log(JSON.stringify({ ...seen, late: process.env.WENRWA_BRIDGE_TOKEN ?? null, flag: process.env.ELECTRON_RUN_AS_NODE ?? null })); }, 300);`,
    );
    const r = spawnSync(process.execPath, [entry, cli, 'bridge', '--managed'], {
      env: { ...process.env, WENRWA_BRIDGE_TOKEN: 'wm_ct_x', ELECTRON_RUN_AS_NODE: '1', HIVEOP_TOKEN_SCRUB_MS: '50' },
      encoding: 'utf8',
    });
    expect(JSON.parse(r.stdout.trim())).toEqual({ defaultApp: true, argv: ['cli', 'bridge', '--managed'], early: 'wm_ct_x', late: null, flag: null });
  });
});
