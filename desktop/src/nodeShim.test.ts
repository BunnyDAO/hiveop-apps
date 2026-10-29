import { describe, expect, it } from 'vitest';
import { nodeShim } from './nodeShim';

describe('nodeShim', () => {
  it('posix: a sh script that execs the app runtime as Node, quoting odd paths', () => {
    const s = nodeShim('darwin', "/Applications/Hive Op's/HiveOp.app/Contents/MacOS/HiveOp");
    expect(s.fileName).toBe('node-shim');
    expect(s.mode).toBe(0o755);
    expect(s.content).toBe(
      `#!/bin/sh\nELECTRON_RUN_AS_NODE=1 exec '/Applications/Hive Op'\\''s/HiveOp.app/Contents/MacOS/HiveOp' "$@"\n`,
    );
  });
  it('windows: a .cmd that sets the flag and forwards arguments', () => {
    const s = nodeShim('win32', 'C:\\Program Files\\HiveOp\\HiveOp.exe');
    expect(s.fileName).toBe('node-shim.cmd');
    expect(s.content).toBe('@echo off\r\nset ELECTRON_RUN_AS_NODE=1\r\n"C:\\Program Files\\HiveOp\\HiveOp.exe" %*\r\n');
  });
});
