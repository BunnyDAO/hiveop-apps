// Electron glue for the managed bridge (dsk-10). Thin on purpose: the decisions
// live in bridgeSupervisor / bridgeInstaller / loginPath / bridgeToken, which are
// tested without Electron. This file wires them to the OS.
import { app, ipcMain, safeStorage, type WebContents } from 'electron';
import { createHash } from 'node:crypto';
import { execFile, spawn as spawnProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import { countChildPtys } from './agentCount';
import { BRIDGE_ENTRY_SOURCE } from './bridgeEntry';
import { nodeShim } from './nodeShim';
import { installBridge, readCurrent, rollbackCurrent, type InstallerDeps } from './bridgeInstaller';
import { removeCliAutostart } from './cliAutostart';
import { createTakeover, parsePids } from './takeover';
import { createClaudeSetup, findOnPath, gitAvailable, npmFailureReason } from './claudeSetup';
import type { ClaudeView } from './claudeSetupApi';
import { createUpdater, earlyExitRollback } from './bridgeUpdater';
import { createSupervisor, type BridgeState, type Child, type Discovery } from './bridgeSupervisor';
import { createTokenStore, isConnectToken } from './bridgeToken';
import { retryDelayMs } from './backoff';
import { bridgePath, LOGIN_PATH_SCRIPT, parseLoginPath } from './loginPath';
import type { BridgeView } from './managedBridgeApi';
import { CLI_PACKAGE, metaUrl, NPM_VERSION, parseDist } from './registry';

export const IPC_PAIR = 'hiveop:bridge-pair';
export const IPC_STATE = 'hiveop:bridge-state';
export const IPC_TAKEOVER = 'hiveop:bridge-takeover';
export const IPC_DECLINE_TAKEOVER = 'hiveop:bridge-decline-takeover';
export const IPC_CLAUDE_STATE = 'hiveop:claude-state';
export const IPC_CLAUDE_ENSURE = 'hiveop:claude-ensure';
export const IPC_CLAUDE_INSTALL_GIT = 'hiveop:claude-install-git';
export const IPC_CLAUDE_PUSH = 'hiveop:claude-state-changed';
export const IPC_STATE_PUSH = 'hiveop:bridge-state-changed';

const DEFAULT_PORT = 8377;
const DEFAULT_ORIGIN = 'https://app.hiveop.io';

export interface BridgeHostOptions {
  siteOrigin: string;
  getWindow(): { webContents: WebContents; isDestroyed(): boolean } | null;
  onChange(): void;
  /** A downloaded bridge version is waiting for the agents to stop; null when none (dsk-11). */
  /** "Not now" is remembered in app prefs (dsk-12). */
  takeoverDeclined?(): boolean;
  declineTakeover?(): void;
  onUpdatePending?(version: string | null): void;
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
  // Test seam: the update check sees this local tarball (version in HIVEOP_UPDATE_VERSION) as the registry's latest.
  const updateTarball = env.HIVEOP_UPDATE_TARBALL || undefined;
  const updateVersion = env.HIVEOP_UPDATE_VERSION || undefined;
  const CHECK_EVERY_MS = Number(env.HIVEOP_UPDATE_EVERY_MS) || 3_600_000;
  const MIN_UPTIME_MS = 20_000; // a new version that exits sooner than this is rolled back
  let runningVersion: string | undefined; // the managed bridge process we last started

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

  // dsk-13 — the app's own Claude Code lives under tools/claude-code. Its bin goes LAST on the
  // bridge PATH, so a `claude` the user has (earlier on the login PATH) always wins.
  const claudeDir = path.join(toolsDir, 'claude-code');
  const claudeBin = path.join(claudeDir, 'node_modules', '.bin');
  const userPath = (): string =>
    bridgePath({ toolsDir: path.join(toolsDir, 'bin'), loginPath, inheritedPath: env.PATH ?? env.Path, delimiter: path.delimiter });
  const bridgePathWithClaude = (): string => `${userPath()}${path.delimiter}${claudeBin}`;
  const isExecutable = (p: string): boolean => {
    try {
      fs.accessSync(p, fs.constants.X_OK);
      return fs.statSync(p).isFile();
    } catch {
      return false;
    }
  };
  const claudeNames = process.platform === 'win32' ? ['claude.exe', 'claude.cmd'] : ['claude'];
  const findIn = (dirs: string[]): string | null => {
    for (const n of claudeNames) {
      const hit = findOnPath(n, dirs, isExecutable);
      if (hit) return hit;
    }
    return null;
  };

  async function installClaude(): Promise<void> {
    const npmCli = await ensureNpm();
    fs.mkdirSync(claudeDir, { recursive: true });
    if (!fs.existsSync(path.join(claudeDir, 'package.json'))) fs.writeFileSync(path.join(claudeDir, 'package.json'), '{"private":true}');
    // The package's post-install is `node install.cjs`, and a Mac without Node has no `node`: give the install one.
    const installBin = path.join(toolsDir, 'install-bin');
    fs.mkdirSync(installBin, { recursive: true });
    const shim = nodeShim(process.platform, process.execPath);
    const nodeFile = path.join(installBin, process.platform === 'win32' ? 'node.cmd' : 'node');
    fs.writeFileSync(nodeFile, shim.content, { mode: shim.mode });
    fs.chmodSync(nodeFile, shim.mode);
    const scratch = env.HIVEOP_BRIDGE_HOME ? { HOME: env.HIVEOP_BRIDGE_HOME, USERPROFILE: env.HIVEOP_BRIDGE_HOME } : {};
    const installEnv: NodeJS.ProcessEnv = {
      ...env,
      ...scratch,
      ELECTRON_RUN_AS_NODE: '1',
      ...(env.HIVEOP_CLAUDE_NPM_REGISTRY ? { npm_config_registry: env.HIVEOP_CLAUDE_NPM_REGISTRY } : {}), // test seam: make the install fail
      [process.platform === 'win32' ? 'Path' : 'PATH']: `${installBin}${path.delimiter}${userPath()}`,
    };
    try {
      await run(
        process.execPath,
        [npmCli, 'install', '--prefix', claudeDir, '@anthropic-ai/claude-code', '--no-audit', '--no-fund', '--no-package-lock', '--cache', path.join(toolsDir, 'npm-cache')],
        { env: installEnv, timeout: 600_000 },
      );
    } catch (e) {
      throw new Error(npmFailureReason((e as Error).message));
    }
    const bin = findIn([claudeBin]);
    if (!bin) throw new Error('Claude Code did not install');
    try {
      await run(bin, ['--version'], { env: { ...installEnv, DISABLE_AUTOUPDATER: '1' }, timeout: 30_000 }); // proves the native binary runs
    } catch {
      throw new Error('Claude Code installed but would not start');
    }
  }

  const smoke = env.HIVEOP_SMOKE === '1';
  const claudeSetup = createClaudeSetup({
    findClaude: async () => (findIn(userPath().split(path.delimiter)) ? 'user' : findIn([claudeBin]) ? 'app' : null),
    hasGit: async () => {
      if (env.HIVEOP_NO_GIT === '1') return false; // test seam
      let tools = false;
      if (process.platform === 'darwin') {
        try {
          await run('xcode-select', ['-p']); // exits 2 when no developer tools; never opens a dialog
          tools = true;
        } catch {
          /* not installed */
        }
      }
      return gitAvailable({ platform: process.platform, dirs: userPath().split(path.delimiter), exists: (p) => fs.existsSync(p), developerToolsInstalled: tools });
    },
    install: installClaude,
    onState: () => {
      const w = o.getWindow();
      if (w && !w.isDestroyed()) w.webContents.send(IPC_CLAUDE_PUSH, claudeView());
    },
  });
  const claudeView = (): ClaudeView => ({ ...claudeSetup.state(), canInstallGit: process.platform === 'darwin' }) as ClaudeView;

  function spawnManaged(): Child {
    const cur = readCurrent(bridgeRoot);
    const token = tokens.get();
    if (!cur || !token) throw new Error('bridge not installed or not paired');
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.writeFileSync(entryFile, BRIDGE_ENTRY_SOURCE);
    const shim = nodeShim(process.platform, process.execPath);
    const shimFile = path.join(bridgeRoot, shim.fileName);
    fs.writeFileSync(shimFile, shim.content, { mode: shim.mode });
    fs.chmodSync(shimFile, shim.mode);
    const npm = readCurrent(npmRoot);
    const childEnv: NodeJS.ProcessEnv = {
      ...env,
      // Test seam: run the bridge (and so everything it writes) under a scratch home.
      ...(env.HIVEOP_BRIDGE_HOME ? { HOME: env.HIVEOP_BRIDGE_HOME, USERPROFILE: env.HIVEOP_BRIDGE_HOME } : {}),
      ELECTRON_RUN_AS_NODE: '1',
      WENRWA_BRIDGE_MANAGED: '1',
      WENRWA_BRIDGE_TOKEN: token,
      WENRWA_BRIDGE_LOG: logFile,
      WENRWA_NODE_COMMAND: shimFile, // the runtime contract: MCP + hook commands run through this
      ...(npm ? { WENRWA_NPM_CLI: path.join(npm.dir, 'bin', 'npm-cli.js') } : {}),
      WENRWA_BRIDGE_ORIGIN: o.siteOrigin,
      [process.platform === 'win32' ? 'Path' : 'PATH']: bridgePathWithClaude(),
    };
    runningVersion = cur.version;
    const startedAt = Date.now();
    let stoppedByUs = false;
    const p = spawnProcess(process.execPath, [entryFile, path.join(cur.dir, 'dist', 'index.js'), 'bridge', '--managed', '--port', String(port), '--origin', o.siteOrigin], {
      env: childEnv,
      stdio: 'ignore',
      windowsHide: true,
    });
    p.on('error', () => undefined); // surfaces as an exit below
    return {
      pid: p.pid,
      kill: () => {
        stoppedByUs = true;
        p.kill(); // exact pid only
      },
      onExit: (cb) => {
        const done = (code: number | null): void => {
          runningVersion = undefined;
          // dsk-11: a version that dies right after starting is rolled back and never retried.
          if (earlyExitRollback({ startedAt, now: Date.now(), minUptimeMs: MIN_UPTIME_MS, stoppedByUs, code })) {
            rollbackCurrent(bridgeRoot);
          }
          cb(code);
        };
        p.once('exit', done);
        p.once('error', () => done(null));
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

  const updater = createUpdater({
    check: async () => {
      if (!runningVersion) throw new Error('no managed bridge to update'); // a CLI bridge is not ours to update
      if (updateTarball && updateVersion) {
        const bytes = fs.readFileSync(updateTarball);
        const fake: InstallerDeps = {
          ...installerDeps,
          registryMeta: async () => ({ version: updateVersion, tarball: 'https://seam.invalid/x.tgz', integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}` }),
          download: async () => bytes,
        };
        return installBridge(bridgeRoot, fake);
      }
      return installBridge(bridgeRoot, installerDeps);
    },
    current: () => readCurrent(bridgeRoot)?.version,
    running: () => runningVersion,
    agents: () => supervisor.localAgents(),
    restart: () => supervisor.restart(),
    onPending: (v) => o.onUpdatePending?.(v),
    schedule: (fn, ms) => {
      const t = setTimeout(fn, ms);
      return () => clearTimeout(t);
    },
    checkEveryMs: CHECK_EVERY_MS,
    firstCheckMs: Math.min(CHECK_EVERY_MS, 60_000),
    pollMs: 5000,
  });
  // A swap can become possible whenever the bridge state changes (an agent ended, a restart landed).
  supervisor.onState(() => updater.evaluate());

  // dsk-12 — taking over a CLI bridge. Under a scratch HOME (test seam) launchctl is never called.
  const scratchHome = Boolean(env.HIVEOP_BRIDGE_HOME);
  const userHome = env.HIVEOP_BRIDGE_HOME || os.homedir();
  const findCliPid = async (): Promise<number | null> => {
    try {
      const out = await run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t']);
      return parsePids(out).find((p) => p !== process.pid) ?? null;
    } catch {
      return null; // lsof exits 1 when nothing listens
    }
  };
  const pidAlive = (pid: number): boolean => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  const takeover = createTakeover({
    prepare: async () => {
      if (!tokens.has()) return false;
      if (!readCurrent(bridgeRoot) || tarballOverride) {
        const r = await installBridge(bridgeRoot, installerDeps, { tarball: tarballOverride });
        if (r.status === 'refused') return false;
      }
      return readCurrent(bridgeRoot) !== null;
    },
    findCliPid,
    countAgents: async (pid) => (process.platform === 'win32' ? 0 : countChildPtys(await run('ps', ['-A', '-o', 'pid=,ppid=,comm=']), pid)),
    removeAutostart: async () => {
      await removeCliAutostart({
        platform: process.platform,
        home: userHome,
        uid: process.getuid?.() ?? 0,
        scratchHome,
        exists: (p) => fs.existsSync(p),
        unlink: (p) => fs.unlinkSync(p),
        launchctl: async (args) => {
          await new Promise<void>((resolve, reject) => {
            execFile('launchctl', args, (err) => (err ? reject(Object.assign(err, { code: (err as { code?: unknown }).code })) : resolve()));
          });
        },
      });
    },
    terminate: async (pid) => {
      try {
        process.kill(pid, 'SIGTERM'); // exact pid, never SIGKILL
      } catch {
        /* already gone */
      }
      for (let i = 0; i < 20; i++) {
        if (!pidAlive(pid) && !(await discover())) return true;
        await new Promise((r) => setTimeout(r, 500));
      }
      return false;
    },
    startManaged: async () => {
      await claudeSetup.ensure(); // the CLI bridge had the user's environment; the managed one needs Claude Code too
      await supervisor.recheck();
    },
    schedule: (fn, ms) => {
      const t = setTimeout(fn, ms);
      return () => clearTimeout(t);
    },
    pollMs: 2000,
    onState: () => changed(),
  });

  const view = (): BridgeView => {
    const s = installNote ?? supervisor.state();
    const v = { ...s, paired: tokens.has(), agents: supervisor.localAgents() } as BridgeView;
    if (v.kind === 'running' && v.owner === 'cli') {
      const t = takeover.state();
      const declined = o.takeoverDeclined?.() === true;
      if (t !== 'idle') v.takeover = t;
      else if (!declined) v.takeover = 'offer';
    }
    return v;
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

  /** Claude Code must exist before the bridge starts: the bridge registers its MCP server with it. A failure does not block the bridge. */
  async function setupClaude(): Promise<void> {
    if (!tokens.has()) return;
    if (await discover()) return; // a bridge already answers (ours, or the user's CLI): their environment, not ours
    await claudeSetup.ensure();
  }

  async function begin(): Promise<void> {
    await prepare();
    if (installNote) return;
    await setupClaude();
    await supervisor.start();
    if (!tarballOverride || updateTarball) updater.start();
  }

  ipcMain.handle(IPC_PAIR, async (event, token: unknown) => {
    if (event.sender !== o.getWindow()?.webContents) return false;
    if (!isConnectToken(token) || !tokens.set(token)) return false;
    if (installRetry) clearTimeout(installRetry);
    await prepare();
    if (!installNote) {
      // Not awaited: installing Claude Code can take a while, and the page's pair() must not hang on it.
      void (async () => {
        await setupClaude();
        await supervisor.tokenChanged(); // starts it if stopped, restarts our own bridge on a new token
        changed();
      })();
    }
    changed();
    return true;
  });
  ipcMain.handle(IPC_CLAUDE_STATE, (event) => (event.sender === o.getWindow()?.webContents ? claudeView() : null));
  ipcMain.handle(IPC_CLAUDE_ENSURE, async (event) => {
    if (event.sender !== o.getWindow()?.webContents) return null;
    const was = claudeSetup.state().kind;
    await claudeSetup.ensure();
    // It was blocked and now works: the bridge registered nothing with Claude Code, so start it fresh.
    if ((was === 'failed' || was === 'git-missing') && claudeSetup.state().kind === 'ready') supervisor.restart();
    return claudeView();
  });
  ipcMain.handle(IPC_CLAUDE_INSTALL_GIT, async (event) => {
    if (event.sender !== o.getWindow()?.webContents) return false;
    // Opens Apple's own installer dialog. Only on a click, only on a Mac, only when git is what is missing, never in smoke.
    if (smoke || process.platform !== 'darwin' || claudeSetup.state().kind !== 'git-missing') return false;
    try {
      await run('xcode-select', ['--install']);
      return true;
    } catch {
      return false;
    }
  });
  ipcMain.handle(IPC_TAKEOVER, async (event) => {
    if (event.sender !== o.getWindow()?.webContents) return false;
    return (await takeover.run()) === 'done';
  });
  ipcMain.handle(IPC_DECLINE_TAKEOVER, (event) => {
    if (event.sender !== o.getWindow()?.webContents) return;
    o.declineTakeover?.();
    changed();
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
      await begin();
      changed();
    },
    stop() {
      if (installRetry) clearTimeout(installRetry);
      updater.stop();
      supervisor.stop();
    },
    view,
    localAgents: () => supervisor.localAgents(),
  };
}
