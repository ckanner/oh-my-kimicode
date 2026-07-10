import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runDoctor } from '../../../src/install/doctor.js';

describe('doctor', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reports missing plugin cache and hooks', () => {
    const results = runDoctor({ kimiCodeHome: tmpDir, binDir: path.join(tmpDir, 'bin') });
    const cache = results.find((r) => r.name === 'plugin-cache');
    const hooks = results.find((r) => r.name === 'config-hooks');
    expect(cache?.ok).toBe(false);
    expect(hooks?.ok).toBe(false);
  });

  it('reports ok when cache, hooks, and bins exist', () => {
    const binDir = path.join(tmpDir, 'bin');
    const cache = path.join(tmpDir, 'plugins', 'cache', 'oh-my-kimicode', '0.1.0');
    fs.mkdirSync(cache, { recursive: true });
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(path.join(binDir, 'codegraph-server'), '', 'utf-8');
    fs.writeFileSync(path.join(binDir, 'git-bash-mcp'), '', 'utf-8');
    fs.writeFileSync(path.join(binDir, 'lsp-tools-mcp'), '', 'utf-8');
    fs.writeFileSync(path.join(binDir, 'lsp-daemon'), '', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'config.toml'), '[[hooks]]\ncommand = "node oh-my-kimicode"\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '# Rules', 'utf-8');

    const results = runDoctor({ kimiCodeHome: tmpDir, binDir, projectDirectory: tmpDir });
    expect(results.find((r) => r.name === 'plugin-cache')?.ok).toBe(true);
    expect(results.find((r) => r.name === 'config-hooks')?.ok).toBe(true);
    expect(results.find((r) => r.name === 'managed-bins')?.ok).toBe(true);
    expect(results.find((r) => r.name === 'project-rules')?.ok).toBe(true);
  });
});
