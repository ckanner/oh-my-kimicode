import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runKimiInstaller, runKimiUninstaller } from '../../src/install/install-kimi.js';
import pkg from '../../package.json' with { type: 'json' };

describe('installer integration', () => {
  let tmpDir: string;
  let originalConfigDir: string | undefined;
  let originalSkipBootstrap: string | undefined;
  let originalMigrationStateDir: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omo-installer-'));
    originalConfigDir = process.env.LAZYKIMICODE_CONFIG_DIR;
    process.env.LAZYKIMICODE_CONFIG_DIR = path.join(tmpDir, '.lazykimicode');
    originalSkipBootstrap = process.env.LAZYKIMICODE_SKIP_BOOTSTRAP;
    process.env.LAZYKIMICODE_SKIP_BOOTSTRAP = '1';
    originalMigrationStateDir = process.env.LAZYKIMICODE_MIGRATION_STATE_DIR;
  });

  afterEach(() => {
    if (originalConfigDir === undefined) {
      delete process.env.LAZYKIMICODE_CONFIG_DIR;
    } else {
      process.env.LAZYKIMICODE_CONFIG_DIR = originalConfigDir;
    }
    if (originalSkipBootstrap === undefined) {
      delete process.env.LAZYKIMICODE_SKIP_BOOTSTRAP;
    } else {
      process.env.LAZYKIMICODE_SKIP_BOOTSTRAP = originalSkipBootstrap;
    }
    if (originalMigrationStateDir === undefined) {
      delete process.env.LAZYKIMICODE_MIGRATION_STATE_DIR;
    } else {
      process.env.LAZYKIMICODE_MIGRATION_STATE_DIR = originalMigrationStateDir;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('dry run reports proposed hooks without writing', () => {
    const configPath = path.join(tmpDir, 'config.toml');
    fs.writeFileSync(configPath, 'default_model = "kimi"\n');
    const consoleSpy = captureConsole();
    try {
      runKimiInstaller({ kimiCodeHome: tmpDir, dryRun: true });
      expect(consoleSpy.logs.join('\n')).toContain('Dry run');
      expect(consoleSpy.logs.join('\n')).toContain('[[hooks]]');
    } finally {
      consoleSpy.restore();
    }
    expect(fs.existsSync(path.join(tmpDir, 'plugins'))).toBe(false);
    expect(fs.readFileSync(configPath, 'utf-8')).toBe('default_model = "kimi"\n');
  });

  it('installs plugin cache and patches config.toml', async () => {
    const configPath = path.join(tmpDir, 'config.toml');
    await runKimiInstaller({ kimiCodeHome: tmpDir });

    const cacheDir = path.join(tmpDir, 'plugins', 'cache', 'lazykimicode', pkg.version);
    expect(fs.existsSync(cacheDir)).toBe(true);
    expect(fs.existsSync(path.join(cacheDir, 'components'))).toBe(true);
    expect(fs.existsSync(configPath)).toBe(true);

    const config = fs.readFileSync(configPath, 'utf-8');
    expect(config).toContain('[[hooks]]');
    expect(config).toContain('SessionStart');
    expect(config).toContain('PreToolUse');
    expect(config).toContain('PostToolUse');
  });

  it('is idempotent on repeated installs', async () => {
    await runKimiInstaller({ kimiCodeHome: tmpDir });
    const firstConfig = fs.readFileSync(path.join(tmpDir, 'config.toml'), 'utf-8');
    await runKimiInstaller({ kimiCodeHome: tmpDir });
    const secondConfig = fs.readFileSync(path.join(tmpDir, 'config.toml'), 'utf-8');
    expect(secondConfig).toBe(firstConfig);
  });

  it('backs up existing config before patching', async () => {
    const configPath = path.join(tmpDir, 'config.toml');
    fs.writeFileSync(configPath, 'default_model = "kimi"\n');
    await runKimiInstaller({ kimiCodeHome: tmpDir });
    const backups = fs.readdirSync(tmpDir).filter((f) => f.startsWith('config.toml.bak'));
    expect(backups.length).toBe(1);
  });

  it('autonomous mode sets default_permission_mode to auto', async () => {
    const configPath = path.join(tmpDir, 'config.toml');
    fs.writeFileSync(configPath, 'default_model = "kimi"\n');
    await runKimiInstaller({ kimiCodeHome: tmpDir, autonomous: true });
    const config = fs.readFileSync(configPath, 'utf-8');
    expect(config).toContain('default_permission_mode = "auto"');
  });

  it('writes migration state and remote MCP placeholders', async () => {
    const stateDir = path.join(tmpDir, 'migration-state');
    process.env.LAZYKIMICODE_MIGRATION_STATE_DIR = stateDir;
    await runKimiInstaller({ kimiCodeHome: tmpDir });
    const statePath = path.join(stateDir, 'config-migration-state.json');
    expect(fs.existsSync(statePath)).toBe(true);
    const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    expect(state.lastInstalledVersion).toBe(pkg.version);

    const config = fs.readFileSync(path.join(tmpDir, 'config.toml'), 'utf-8');
    expect(config).toContain('grep_app');
    expect(config).toContain('context7');
  });

  it('registers the plugin in installed.json', async () => {
    await runKimiInstaller({ kimiCodeHome: tmpDir });
    const installedPath = path.join(tmpDir, 'plugins', 'installed.json');
    expect(fs.existsSync(installedPath)).toBe(true);
    const installed = JSON.parse(fs.readFileSync(installedPath, 'utf-8')) as { version: number; plugins: Array<{ id: string; enabled: boolean }> };
    const record = installed.plugins.find((p) => p.id === 'lazykimicode');
    expect(record).toBeDefined();
    expect(record!.enabled).toBe(true);
  });

  it('uninstall removes hooks, cache, and installed.json record', async () => {
    await runKimiInstaller({ kimiCodeHome: tmpDir, binDir: path.join(tmpDir, 'bin') });

    await runKimiUninstaller({ kimiCodeHome: tmpDir, binDir: path.join(tmpDir, 'bin') });

    const config = fs.readFileSync(path.join(tmpDir, 'config.toml'), 'utf-8');
    expect(config).not.toContain('lazykimicode');
    expect(fs.existsSync(path.join(tmpDir, 'plugins', 'cache', 'lazykimicode'))).toBe(false);
    const installed = JSON.parse(fs.readFileSync(path.join(tmpDir, 'plugins', 'installed.json'), 'utf-8')) as { plugins: Array<{ id: string }> };
    expect(installed.plugins.some((p) => p.id === 'lazykimicode')).toBe(false);
  });

  it('uninstall preserves rules with --preserve-rules', async () => {
    await runKimiInstaller({ kimiCodeHome: tmpDir });
    expect(fs.existsSync(path.join(tmpDir, '.lazykimicode'))).toBe(true);
    await runKimiUninstaller({ kimiCodeHome: tmpDir, preserveRules: true });
    expect(fs.existsSync(path.join(tmpDir, '.lazykimicode'))).toBe(true);
  });
});

function captureConsole() {
  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => { logs.push(args.map(String).join(' ')); };
  return {
    logs,
    restore: () => { console.log = originalLog; },
  };
}
