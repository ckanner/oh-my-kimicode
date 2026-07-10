import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import * as toml from 'smol-toml';
import { resolveKimiEnv, pluginCacheDir, omoConfigDir } from '../shared/paths.js';
import { getHookDefs } from './hook-defs.js';
import { patchConfigToml } from './config-patcher.js';
import { linkManagedBins, unlinkManagedBins } from './bin-links.js';
import { captureEvent } from '../components/telemetry/posthog.js';

export interface InstallOptions {
  kimiCodeHome?: string;
  projectDirectory?: string;
  binDir?: string;
  dryRun?: boolean;
  noTui?: boolean;
  autonomous?: boolean;
}

function getPluginRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'plugin');
}

function seedOmoConfig(options: InstallOptions): void {
  if (options.dryRun) return;
  const dir = omoConfigDir();
  fs.mkdirSync(dir, { recursive: true });
  const configPath = path.join(dir, 'config.jsonc');
  if (fs.existsSync(configPath)) return;
  const config = {
    '//': 'Oh My KimiCode user configuration',
    telemetry: { enabled: process.env.OMO_KIMI_DISABLE_POSTHOG !== '1' },
    ultrawork: { autoCreateGoal: true },
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

function applyAutonomousMode(kimiCodeHome: string, dryRun = false): void {
  const configPath = path.join(kimiCodeHome, 'config.toml');
  if (!fs.existsSync(configPath)) return;
  const raw = fs.readFileSync(configPath, 'utf-8');
  const parsed = toml.parse(raw) as Record<string, unknown>;
  if (parsed.default_permission_mode === 'auto') return;
  parsed.default_permission_mode = 'auto';
  const serialized = toml.stringify(parsed as toml.TomlPrimitive);
  if (dryRun) {
    console.log('Autonomous mode would set default_permission_mode = "auto"');
    return;
  }
  fs.writeFileSync(configPath, serialized, 'utf-8');
}

export function detectKimiInstallation(): { installed: boolean; version?: string } {
  try {
    const out = execFileSync('kimi', ['--version'], { encoding: 'utf-8', timeout: 5000 }).trim();
    return { installed: true, version: out };
  } catch {
    return { installed: false };
  }
}

function writeRemoteMcpPlaceholders(kimiCodeHome: string, dryRun = false): void {
  const configPath = path.join(kimiCodeHome, 'config.toml');
  if (!fs.existsSync(configPath) || dryRun) return;
  const raw = fs.readFileSync(configPath, 'utf-8');
  if (raw.includes('grep_app') || raw.includes('context7')) return;
  const placeholder = `\n# Remote MCP placeholders (oh-my-kimicode)\n# Enable after obtaining API keys:\n# [mcpServers.grep_app]\n# command = "npx"\n# args = ["-y", "@grep-app/mcp"]\n# env = { GREP_APP_API_KEY = "..." }\n#\n# [mcpServers.context7]\n# command = "npx"\n# args = ["-y", "@context7/mcp"]\n# env = { CONTEXT7_API_KEY = "..." }\n`;
  fs.writeFileSync(configPath, raw.trimEnd() + placeholder, 'utf-8');
}

function ensureGitBashMcp(kimiCodeHome: string, cache: string, dryRun = false): void {
  if (process.platform !== 'win32') return;
  const configPath = path.join(kimiCodeHome, 'config.toml');
  if (!fs.existsSync(configPath) || dryRun) return;
  const raw = fs.readFileSync(configPath, 'utf-8');
  if (raw.includes('[mcpServers.git_bash]')) return;
  const entry = `\n# git_bash MCP (Windows only; installed by oh-my-kimicode)\n[mcpServers.git_bash]\ncommand = "node"\nargs = ["${cache.replace(/\\/g, '\\\\')}\\components\\git-bash\\dist\\mcp-server.mjs"]\n`;
  fs.writeFileSync(configPath, raw.trimEnd() + entry, 'utf-8');
}

function recordMigrationState(version: string, dryRun = false): void {
  if (dryRun) return;
  const stateDir = process.env.OMO_KIMI_MIGRATION_STATE_DIR
    ?? path.join(os.homedir(), '.local', 'share', 'oh-my-kimicode');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, 'config-migration-state.json'),
    JSON.stringify({ lastInstalledVersion: version, installedAt: new Date().toISOString() }, null, 2),
    'utf-8',
  );
}

async function recordInstallTelemetry(dryRun = false): Promise<void> {
  if (dryRun) return;
  if (process.env.OMO_KIMI_DISABLE_POSTHOG === '1') return;
  try {
    const { getDistinctId } = await import('../shared/telemetry.js');
    const result = await captureEvent(getDistinctId(), 'install');
    if (!result.ok) {
      process.stderr.write(`telemetry: install capture skipped: ${result.reason}\n`);
    }
  } catch {
    // Telemetry is best-effort.
  }
}

function runFirstBootstrap(cache: string, binDir: string, kimiCodeHome: string, dryRun = false): void {
  if (dryRun) return;
  const bootstrapCli = path.join(cache, 'components', 'bootstrap', 'dist', 'cli.mjs');
  if (!fs.existsSync(bootstrapCli)) return;
  try {
    execFileSync('node', [bootstrapCli, 'hook', 'session-start'], {
      env: {
        ...process.env,
        OMO_KIMI_PLUGIN_CACHE: cache,
        OMO_KIMI_BIN_DIR: binDir,
        KIMI_CODE_HOME: kimiCodeHome,
      },
      stdio: 'pipe',
      timeout: 30000,
    });
  } catch {
    // Bootstrap failure is non-fatal; the SessionStart hook will retry.
  }
}

export async function runKimiInstaller(options: InstallOptions = {}): Promise<void> {
  const env = resolveKimiEnv(options);
  const cache = pluginCacheDir(env.kimiCodeHome, env.version);

  const kimi = detectKimiInstallation();
  if (!kimi.installed) {
    console.warn('Warning: Kimi Code CLI not detected on PATH. Installation will still proceed.');
  } else if (!options.dryRun) {
    console.log(`Detected Kimi Code CLI: ${kimi.version}`);
  }

  if (!options.dryRun) {
    fs.rmSync(cache, { recursive: true, force: true });
    fs.mkdirSync(cache, { recursive: true });
    fs.cpSync(getPluginRoot(), cache, { recursive: true });
    linkManagedBins(cache, env.binDir);
    seedOmoConfig(options);
  }

  const configPath = path.join(env.kimiCodeHome, 'config.toml');
  const hooks = getHookDefs(env.version, cache);
  const result = patchConfigToml(configPath, hooks, options.dryRun);

  writeRemoteMcpPlaceholders(env.kimiCodeHome, options.dryRun);
  ensureGitBashMcp(env.kimiCodeHome, cache, options.dryRun);

  if (options.autonomous) {
    applyAutonomousMode(env.kimiCodeHome, options.dryRun);
  }

  recordMigrationState(env.version, options.dryRun);

  if (options.dryRun) {
    console.log('Dry run. Proposed changes:');
    console.log(result.diff);
    if (options.autonomous) {
      applyAutonomousMode(env.kimiCodeHome, true);
    }
    return;
  }

  runFirstBootstrap(cache, env.binDir, env.kimiCodeHome, options.dryRun);
  await recordInstallTelemetry(options.dryRun);

  console.log(`Installed oh-my-kimicode ${env.version} to ${cache}`);
  if (result.backupPath) console.log(`Backed up config to ${result.backupPath}`);
}

export interface UninstallOptions {
  kimiCodeHome?: string;
  binDir?: string;
  preserveRules?: boolean;
}

export async function runKimiUninstaller(options: UninstallOptions = {}): Promise<void> {
  const env = resolveKimiEnv(options);
  const version = process.env.OMO_KIMI_VERSION ?? '0.1.0';
  const cache = pluginCacheDir(env.kimiCodeHome, version);
  const configPath = path.join(env.kimiCodeHome, 'config.toml');

  // Remove managed hook entries and MCP entries from config.toml.
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = toml.parse(raw) as Record<string, unknown>;
    const hooks = (parsed.hooks ?? []) as Array<Record<string, unknown>>;
    const remaining = hooks.filter((h) => {
      const cmd = String(h.command ?? '');
      return !cmd.includes('oh-my-kimicode');
    });
    if (remaining.length !== hooks.length) {
      parsed.hooks = remaining;
    }
    const mcpServers = (parsed.mcpServers ?? {}) as Record<string, unknown>;
    let mcpChanged = false;
    if (mcpServers.git_bash !== undefined) {
      delete mcpServers.git_bash;
      mcpChanged = true;
    }
    if (remaining.length !== hooks.length || mcpChanged) {
      fs.writeFileSync(configPath, toml.stringify(parsed as toml.TomlPrimitive), 'utf-8');
      console.log(`Removed oh-my-kimicode hooks/MCP entries from ${configPath}`);
    }
  }

  // Remove plugin cache directories.
  const cacheParent = path.join(env.kimiCodeHome, 'plugins', 'cache', 'oh-my-kimicode');
  if (fs.existsSync(cacheParent)) {
    fs.rmSync(cacheParent, { recursive: true, force: true });
    console.log(`Removed plugin cache ${cacheParent}`);
  }

  // Remove bin links.
  unlinkManagedBins(env.binDir, fs.existsSync(cache) ? cache : undefined);
  console.log(`Removed managed binaries from ${env.binDir}`);

  if (!options.preserveRules) {
    const omoDir = omoConfigDir();
    if (fs.existsSync(omoDir)) {
      fs.rmSync(omoDir, { recursive: true, force: true });
      console.log(`Removed user rules/config ${omoDir}`);
    }
  }

  console.log('Uninstalled oh-my-kimicode');
}
