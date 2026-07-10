import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { patchConfigToml } from '../../../src/install/config-patcher.js';
import { getHookDefs } from '../../../src/install/hook-defs.js';

describe('patchConfigToml', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kimi-')); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('adds hooks idempotently', () => {
    const configPath = path.join(tmpDir, 'config.toml');
    const hooks = getHookDefs('0.1.0', '/tmp/cache');
    const r1 = patchConfigToml(configPath, hooks);
    expect(r1.wrote).toBe(true);
    const r2 = patchConfigToml(configPath, hooks);
    expect(r2.wrote).toBe(false);
  });

  it('backs up existing config', () => {
    const configPath = path.join(tmpDir, 'config.toml');
    fs.writeFileSync(configPath, 'default_model = "kimi"\n');
    const hooks = getHookDefs('0.1.0', '/tmp/cache');
    const r = patchConfigToml(configPath, hooks);
    expect(r.backupPath).toBeDefined();
    expect(fs.existsSync(r.backupPath!)).toBe(true);
  });

  it('dry run does not write', () => {
    const configPath = path.join(tmpDir, 'config.toml');
    fs.writeFileSync(configPath, 'default_model = "kimi"\n');
    const hooks = getHookDefs('0.1.0', '/tmp/cache');
    const r = patchConfigToml(configPath, hooks, true);
    expect(r.wrote).toBe(false);
    expect(fs.readFileSync(configPath, 'utf-8')).toBe('default_model = "kimi"\n');
  });

  it('preserves existing comments and formatting', () => {
    const configPath = path.join(tmpDir, 'config.toml');
    fs.writeFileSync(configPath, '# My custom config\ndefault_model = "kimi"\n\n# Keep this comment\n');
    const hooks = [{ event: 'SessionStart', matcher: '.*', command: 'node "x" hook session-start', timeout: 10 }];
    patchConfigToml(configPath, hooks);
    const content = fs.readFileSync(configPath, 'utf-8');
    expect(content).toContain('# My custom config');
    expect(content).toContain('# Keep this comment');
    expect(content).toContain('[[hooks]]');
  });
});
