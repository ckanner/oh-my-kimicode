import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import * as toml from 'smol-toml';
import { runKimiInstaller, runKimiUninstaller } from '../../src/install/install-kimi.js';

describe('uninstall integration', () => {
  let tmpDir: string;
  let originalConfigDir: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omo-uninstall-'));
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

  it('removes lazykimicode hooks and MCP entries from config.toml', async () => {
    await runKimiInstaller({ kimiCodeHome: tmpDir, binDir: path.join(tmpDir, 'bin') });

    const installedConfig = fs.readFileSync(path.join(tmpDir, 'config.toml'), 'utf-8');
    expect(installedConfig).toContain('lazykimicode');

    await runKimiUninstaller({ kimiCodeHome: tmpDir, binDir: path.join(tmpDir, 'bin') });

    const config = fs.readFileSync(path.join(tmpDir, 'config.toml'), 'utf-8');
    const parsed = toml.parse(config) as Record<string, unknown>;
    const hooks = (parsed.hooks ?? []) as Array<Record<string, unknown>>;
    const mcpServers = (parsed.mcpServers ?? {}) as Record<string, unknown>;

    expect(hooks.some((h) => String(h.command ?? '').includes('lazykimicode'))).toBe(false);
    const lazykimicodeMcpEntries = Object.entries(mcpServers).filter(([name, entry]) => {
      const text = JSON.stringify(entry);
      return name === 'git_bash' || name.includes('lazykimicode') || text.includes('lazykimicode');
    });
    expect(lazykimicodeMcpEntries).toEqual([]);
    expect(fs.existsSync(path.join(tmpDir, 'plugins', 'cache', 'lazykimicode'))).toBe(false);
  });
});
