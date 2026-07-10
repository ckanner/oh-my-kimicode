import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runKimiInstaller, runKimiUninstaller } from '../../src/install/install-kimi.js';

describe('installer integration', () => {
  let tmpDir: string;
  let originalConfigDir: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omo-installer-'));
    originalConfigDir = process.env.OMO_KIMI_CONFIG_DIR;
    process.env.OMO_KIMI_CONFIG_DIR = path.join(tmpDir, '.omo');
  });

  afterEach(() => {
    if (originalConfigDir === undefined) {
      delete process.env.OMO_KIMI_CONFIG_DIR;
    } else {
      process.env.OMO_KIMI_CONFIG_DIR = originalConfigDir;
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

  it('installs plugin cache and patches config.toml', () => {
    const configPath = path.join(tmpDir, 'config.toml');
    runKimiInstaller({ kimiCodeHome: tmpDir });

    const cacheDir = path.join(tmpDir, 'plugins', 'cache', 'oh-my-kimicode', '0.1.0');
    expect(fs.existsSync(cacheDir)).toBe(true);
    expect(fs.existsSync(path.join(cacheDir, 'components'))).toBe(true);
    expect(fs.existsSync(configPath)).toBe(true);

    const config = fs.readFileSync(configPath, 'utf-8');
    expect(config).toContain('[[hooks]]');
    expect(config).toContain('SessionStart');
    expect(config).toContain('PreToolUse');
    expect(config).toContain('PostToolUse');
  });

  it('is idempotent on repeated installs', () => {
    runKimiInstaller({ kimiCodeHome: tmpDir });
    const firstConfig = fs.readFileSync(path.join(tmpDir, 'config.toml'), 'utf-8');
    runKimiInstaller({ kimiCodeHome: tmpDir });
    const secondConfig = fs.readFileSync(path.join(tmpDir, 'config.toml'), 'utf-8');
    expect(secondConfig).toBe(firstConfig);
  });

  it('backs up existing config before patching', () => {
    const configPath = path.join(tmpDir, 'config.toml');
    fs.writeFileSync(configPath, 'default_model = "kimi"\n');
    runKimiInstaller({ kimiCodeHome: tmpDir });
    const backups = fs.readdirSync(tmpDir).filter((f) => f.startsWith('config.toml.bak'));
    expect(backups.length).toBe(1);
  });

  it('autonomous mode sets default_permission_mode to auto', () => {
    const configPath = path.join(tmpDir, 'config.toml');
    fs.writeFileSync(configPath, 'default_model = "kimi"\n');
    runKimiInstaller({ kimiCodeHome: tmpDir, autonomous: true });
    const config = fs.readFileSync(configPath, 'utf-8');
    expect(config).toContain('default_permission_mode = "auto"');
  });

  it('writes migration state and remote MCP placeholders', () => {
    runKimiInstaller({ kimiCodeHome: tmpDir });
    const statePath = path.join(tmpDir, '.local', 'share', 'oh-my-kimicode', 'config-migration-state.json');
    expect(fs.existsSync(statePath)).toBe(true);
    const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    expect(state.lastInstalledVersion).toBe('0.1.0');

    const config = fs.readFileSync(path.join(tmpDir, 'config.toml'), 'utf-8');
    expect(config).toContain('grep_app');
    expect(config).toContain('context7');
  });

  it('uninstall removes hooks and cache', async () => {
    await runKimiInstaller({ kimiCodeHome: tmpDir, binDir: path.join(tmpDir, 'bin') });

    await runKimiUninstaller({ kimiCodeHome: tmpDir, binDir: path.join(tmpDir, 'bin') });

    const config = fs.readFileSync(path.join(tmpDir, 'config.toml'), 'utf-8');
    expect(config).not.toContain('oh-my-kimicode');
    expect(fs.existsSync(path.join(tmpDir, 'plugins', 'cache', 'oh-my-kimicode'))).toBe(false);
  });

  it('uninstall preserves rules with --preserve-rules', async () => {
    await runKimiInstaller({ kimiCodeHome: tmpDir });
    expect(fs.existsSync(path.join(tmpDir, '.omo'))).toBe(true);
    await runKimiUninstaller({ kimiCodeHome: tmpDir, preserveRules: true });
    expect(fs.existsSync(path.join(tmpDir, '.omo'))).toBe(true);
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
