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
  it('runs the CLI with its own argv and marks the run as a script run', () => {
    const entry = path.join(dir, 'entry.js');
    const cli = path.join(dir, 'cli.js');
    fs.writeFileSync(entry, BRIDGE_ENTRY_SOURCE);
    fs.writeFileSync(cli, `console.log(JSON.stringify({ defaultApp: process.defaultApp, argv: process.argv.slice(1).map((a, i) => (i === 0 ? 'cli' : a)) }));`);
    const r = spawnSync(process.execPath, [entry, cli, 'bridge', '--managed'], { encoding: 'utf8' });
    expect(JSON.parse(r.stdout.trim())).toEqual({ defaultApp: true, argv: ['cli', 'bridge', '--managed'] });
  });
});
