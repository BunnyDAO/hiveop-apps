// The managed-mode runtime contract (dsk-10, CLI side: bridge/managedRuntime.ts).
// WENRWA_NODE_COMMAND points at this shim. The bridge writes it into the MCP
// registration and every hook command, so Claude Code can run them with no
// `node` on PATH, and without launching the GUI app (the flag is set here, per
// command, so the bridge's own environment never has to carry it).
export interface NodeShim {
  fileName: string;
  content: string;
  mode: number;
}

export function nodeShim(platform: NodeJS.Platform, runtimePath: string): NodeShim {
  if (platform === 'win32') {
    return {
      fileName: 'node-shim.cmd',
      content: `@echo off\r\nset ELECTRON_RUN_AS_NODE=1\r\n"${runtimePath}" %*\r\n`,
      mode: 0o644,
    };
  }
  const quoted = `'${runtimePath.replace(/'/g, `'\\''`)}'`;
  return { fileName: 'node-shim', content: `#!/bin/sh\nELECTRON_RUN_AS_NODE=1 exec ${quoted} "$@"\n`, mode: 0o755 };
}
