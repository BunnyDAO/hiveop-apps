// Electron glue for the managed bridge (dsk-10). Thin on purpose: the decisions
// live in bridgeSupervisor / bridgeInstaller / loginPath / bridgeToken, which are
// tested without Electron. This file wires them to the OS.
import { app, ipcMain, safeStorage, type WebContents } from 'electron';
import { execFile, spawn as spawnProcess } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { countChildPtys } from './agentCount';
import { BRIDGE_ENTRY_SOURCE } from './bridgeEntry';
import { installBridge, readCurrent, type InstallerDeps } from './bridgeInstaller';
import { createSupervisor, type BridgeState, type Child, type Discovery } from './bridgeSupervisor';
import { createTokenStore, isConnectToken } from './bridgeToken';
import { retryDelayMs } from './backoff';
import { bridgePath, LOGIN_PATH_SCRIPT, parseLoginPath } from './loginPath';
import type { BridgeView } from './managedBridgeApi';
import { CLI_PACKAGE, metaUrl, NPM_VERSION, parseDist } from './registry';

export const IPC_PAIR = 'hiveop:bridge-pair';
export const IPC_STATE = 'hiveop:bridge-state';
export const IPC_STATE_PUSH = 'hiveop:bridge-state-changed';

const DEFAULT_PORT = 8377;
const DEFAULT_ORIGIN = 'https://app.hiveop.io';

export interface BridgeHostOptions {
  siteOrigin: string;
  getWindow(): { webContents: WebContents; isDestroyed(): boolean } | null;
  onChange(): void;
  env?: NodeJS.ProcessEnv;
}

export interface BridgeHost {
  start(): Promise<void>;
  stop(): void;
  view(): BridgeView;
  localAgents(): number;
}

function run(cmd: string, args: string[], opts: { env?: NodeJS.ProcessEnv; cwd?: string; timeout?: number } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { ...opts, maxBuffer: 16 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) =>
      err ? reject(new Error(`${path.basename(cmd)} failed: ${(stderr || err.message).toString().slice(0, 300)}`)) : resolve(stdout.toString()),
    );
  });
}

function getJson(url: string, headers: Record<string, string>, timeoutMs: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers, timeout: timeoutMs }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`status ${res.statusCode}`));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

export function createBridgeHost(o: BridgeHostOptions): BridgeHost {
  const env = o.env ?? process.env;
  const port = Number(env.HIVEOP_BRIDGE_PORT) || DEFAULT_PORT;
  const userData = app.getPath('userData');
  const bridgeRoot = path.join(userData, 'bridge');
  const toolsDir = path.join(userData, 'tools');
  const npmRoot = path.join(toolsDir, 'npm');
  const logFile = path.join(userData, 'logs', 'bridge.log');
  const entryFile = path.join(bridgeRoot, 'entry.js');
  const tokens = createTokenStore(path.join(userData, 'bridge-token.bin'), {
    available: () => safeStorage.isEncryptionAvailable(),
    encrypt: (s) => safeStorage.encryptString(s),
    decrypt: (b) => safeStorage.decryptString(b),
  });
  const tarballOverride = env.HIVEOP_BRIDGE_TARBALL || undefined;

  let loginPath: string | undefined;
  let installNote: BridgeState | null = null; // shown instead of the supervisor's state while installing / install failed
  let installAttempt = 0;
  let installRetry: NodeJS.Timeout | null = null;

  const download = async (url: string): Promise<Buffer> => {
    const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`download ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  };
  const registryMeta = (name: string, v: string) => async () => {
    const res = await fetch(metaUrl(name, v), { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`registry ${res.status}`);
    return parseDist(await res.json());
  };
  // `tar` ships with macOS, Linux and Windows 10+; npm tarballs unpack with their `package/` prefix stripped.
  const extract = async (tgz: string, dest: string): Promise<void> => {
    await run('tar', ['-xzf', tgz, '-C', dest, '--strip-components=1']);
  };

  /** npm itself (its tarball bundles its dependencies), so a Mac without Node can install the CLI's dependencies. */
  async function ensureNpm(): Promise<string> {
    const deps: InstallerDeps = { registryMeta: registryMeta('npm', NPM_VERSION), download, extract, installDeps: async () => undefined };
    await installBridge(npmRoot, deps);
    const cur = readCurrent(npmRoot);
    if (!cur) throw new Error('npm unavailable');
    return path.join(cur.dir, 'bin', 'npm-cli.js');
  }

  async function installDeps(dir: string): Promise<void> {
    const npmCli = await ensureNpm();
    // --ignore-scripts: node-pty ships prebuilds for macOS/Windows, and its install script would need `node` on PATH.
    await run(
      process.execPath,
      [npmCli, 'install', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', '--cache', path.join(toolsDir, 'npm-cache')],
      { cwd: dir, env: { ...env, ELECTRON_RUN_AS_NODE: '1' }, timeout: 300_000 },
    );
    // What node-pty's post-install would have done: the spawn helper must be executable.
    const pre = path.join(dir, 'node_modules', 'node-pty', 'prebuilds');
    if (fs.existsSync(pre)) {
      for (const d of fs.readdirSync(pre)) {
        const helper = path.join(pre, d, 'spawn-helper');
        if (fs.existsSync(helper)) fs.chmodSync(helper, 0o755);
      }
    }
  }

  const installerDeps: InstallerDeps = { registryMeta: registryMeta(CLI_PACKAGE, 'latest'), download, extract, installDeps };

  async function discover(): Promise<Discovery | null> {
    for (const origin of new Set([o.siteOrigin, DEFAULT_ORIGIN])) {
      try {
        const d = (await getJson(`http://127.0.0.1:${port}/discovery`, { origin }, 1500)) as { managed?: unknown; version?: unknown };
        return { managed: d.managed === true, ...(typeof d.version === 'string' ? { version: d.version } : {}) };
      } catch {
        /* try the next origin, then give up */
      }
    }
    return null;
  }

  function spawnManaged(): Child {
    const cur = readCurrent(bridgeRoot);
    const token = tokens.get();
    if (!cur || !token) throw new Error('bridge not installed or not paired');
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.writeFileSync(entryFile, BRIDGE_ENTRY_SOURCE);
    const childEnv: NodeJS.ProcessEnv = {
      ...env,
      ELECTRON_RUN_AS_NODE: '1',
      WENRWA_BRIDGE_MANAGED: '1',
      WENRWA_BRIDGE_TOKEN: token,
      WENRWA_BRIDGE_LOG: logFile,
      WENRWA_BRIDGE_ORIGIN: o.siteOrigin,
      [process.platform === 'win32' ? 'Path' : 'PATH']: bridgePath({
        toolsDir: path.join(toolsDir, 'bin'),
        loginPath,
        inheritedPath: env.PATH ?? env.Path,
        delimiter: path.delimiter,
      }),
    };
    const p = spawnProcess(process.execPath, [entryFile, path.join(cur.dir, 'dist', 'index.js'), 'bridge', '--managed', '--port', String(port), '--origin', o.siteOrigin], {
      env: childEnv,
      stdio: 'ignore',
      windowsHide: true,
    });
    p.on('error', () => undefined); // surfaces as an exit below
    return {
      pid: p.pid,
      kill: () => {
        p.kill(); // exact pid only
      },
      onExit: (cb) => {
        p.once('exit', (code) => cb(code));
        p.once('error', () => cb(null));
      },
    };
  }

  const supervisor = createSupervisor({
    discover,
    hasToken: () => tokens.has(),
    spawn: spawnManaged,
    countAgents: async (pid) => (process.platform === 'win32' ? 0 : countChildPtys(await run('ps', ['-A', '-o', 'pid=,ppid=,comm=']), pid)),
    schedule: (fn, ms) => {
      const t = setTimeout(fn, ms);
      return () => clearTimeout(t);
    },
    backoffMs: retryDelayMs,
    pollMs: 1500,
    startTimeoutMs: 30_000,
  });

  const view = (): BridgeView => {
    const s = installNote ?? supervisor.state();
    return { ...s, paired: tokens.has(), agents: supervisor.localAgents() } as BridgeView;
  };
  const changed = (): void => {
    o.onChange();
    const w = o.getWindow();
    if (w && !w.isDestroyed()) w.webContents.send(IPC_STATE_PUSH, view());
  };
  supervisor.onState(changed);

  /** Make sure a bridge version exists before the supervisor needs to spawn one. */
  async function prepare(): Promise<void> {
    if (!tokens.has()) return;
    if (await discover()) return; // someone's bridge already answers: nothing to install
    if (readCurrent(bridgeRoot) && !tarballOverride) return;
    installNote = { kind: 'starting' };
    changed();
    const res = await installBridge(bridgeRoot, installerDeps, { tarball: tarballOverride });
    installNote = null;
    if (res.status === 'refused' && !readCurrent(bridgeRoot)) {
      const retryInMs = retryDelayMs(installAttempt++);
      installNote = { kind: 'crashed', attempt: installAttempt, retryInMs };
      installRetry = setTimeout(() => {
        installNote = null;
        void begin();
      }, retryInMs);
    } else {
      installAttempt = 0;
    }
    changed();
  }

  async function begin(): Promise<void> {
    await prepare();
    if (installNote) return;
    await supervisor.start();
  }

  ipcMain.handle(IPC_PAIR, async (event, token: unknown) => {
    if (event.sender !== o.getWindow()?.webContents) return false;
    if (!isConnectToken(token) || !tokens.set(token)) return false;
    if (installRetry) clearTimeout(installRetry);
    await prepare();
    if (!installNote) await supervisor.tokenChanged(); // starts it if stopped, restarts our own bridge on a new token
    changed();
    return true;
  });
  ipcMain.handle(IPC_STATE, (event) => (event.sender === o.getWindow()?.webContents ? view() : null));

  return {
    async start() {
      const p = process.platform === 'win32' ? undefined : process.env.SHELL;
      if (p) {
        try {
          loginPath = parseLoginPath(await run(p, ['-ilc', LOGIN_PATH_SCRIPT], { timeout: 5000 }));
        } catch {
          /* inherited PATH only */
        }
      }
      await prepare();
      if (!installNote) await supervisor.start();
      changed();
    },
    stop() {
      if (installRetry) clearTimeout(installRetry);
      supervisor.stop();
    },
    view,
    localAgents: () => supervisor.localAgents(),
  };
}
