import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const modulePath = '../../../src/components/git-bash/mcp-server.js';
const SERVER = path.resolve('plugin/components/git-bash/dist/mcp-server.mjs');

describe('git-bash mcp-server findBashPath', () => {
  let existsSyncSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    existsSyncSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    // clear module cache to re-import
    vi.resetModules();
  });

  afterEach(() => {
    existsSyncSpy.mockRestore();
  });

  it('returns the first existing candidate', async () => {
    existsSyncSpy.mockImplementation((p: fs.PathLike) =>
      String(p).includes('Git\\bin\\bash.exe'),
    );
    const { findBashPath } = await import(modulePath);
    expect(findBashPath()).toContain('Git');
  });

  it('returns null when no candidate exists', async () => {
    const { findBashPath } = await import(modulePath);
    expect(findBashPath()).toBeNull();
  });

  it('resolves a bare-name candidate against PATH', async () => {
    const tmpBin = fs.mkdtempSync(path.join(os.tmpdir(), 'git-bash-path-'));
    const bashFile = path.join(tmpBin, 'bash');
    fs.writeFileSync(bashFile, '', 'utf-8');
    const originalPath = process.env.PATH;
    process.env.PATH = `${tmpBin}${path.delimiter}${originalPath ?? ''}`;
    try {
      existsSyncSpy.mockImplementation((p: fs.PathLike) => String(p) === bashFile);
      const { findBashPath } = await import(modulePath);
      expect(findBashPath()).toBe(bashFile);
    } finally {
      process.env.PATH = originalPath;
      fs.rmSync(tmpBin, { recursive: true, force: true });
    }
  });

  it('resolves bash.exe against PATH', async () => {
    const tmpBin = fs.mkdtempSync(path.join(os.tmpdir(), 'git-bash-win-'));
    const bashExe = path.join(tmpBin, 'bash.exe');
    fs.writeFileSync(bashExe, '', 'utf-8');
    const originalPath = process.env.PATH;
    process.env.PATH = `${tmpBin}${path.delimiter}${originalPath ?? ''}`;
    try {
      existsSyncSpy.mockImplementation((p: fs.PathLike) => String(p) === bashExe);
      const { findBashPath } = await import(modulePath);
      expect(findBashPath()).toBe(bashExe);
    } finally {
      process.env.PATH = originalPath;
      fs.rmSync(tmpBin, { recursive: true, force: true });
    }
  });
});

describe('git-bash mcp-server entry', () => {
  it('initializes and lists git-bash tools', () => {
    const result = spawnSync('node', [SERVER], {
      input: [
        JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
        JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
      ].join('\n') + '\n',
      encoding: 'utf-8',
    });
    expect(result.status).toBe(0);
    const lines = result.stdout.trim().split('\n');
    expect(lines).toHaveLength(2);
    const init = JSON.parse(lines[0]);
    expect(init.id).toBe(1);
    expect(init.result.protocolVersion).toBe('2024-11-05');
    const list = JSON.parse(lines[1]);
    expect(list.id).toBe(2);
    const names = list.result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain('git_bash');
    expect(names).toContain('run');
    expect(names).toContain('which_bash');
    expect(names).toContain('diagnose');
  });

  it('which_bash reports not-required on non-Windows', () => {
    const result = spawnSync('node', [SERVER], {
      input: [
        JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
        JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'which_bash', arguments: {} } }),
      ].join('\n') + '\n',
      encoding: 'utf-8',
    });
    expect(result.status).toBe(0);
    const lines = result.stdout.trim().split('\n');
    const call = JSON.parse(lines[1]);
    const text = JSON.parse(call.result.content[0].text);
    expect(text.found).toBe(true);
    expect(text.source).toBe('not-required');
  });

  it('diagnose reports disabled on non-Windows', () => {
    const result = spawnSync('node', [SERVER], {
      input: [
        JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
        JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'diagnose', arguments: {} } }),
      ].join('\n') + '\n',
      encoding: 'utf-8',
    });
    expect(result.status).toBe(0);
    const lines = result.stdout.trim().split('\n');
    const call = JSON.parse(lines[1]);
    const text = JSON.parse(call.result.content[0].text);
    expect(text.enabled).toBe(false);
    expect(text.status).toContain('disabled');
  });

  it('run errors on non-Windows', () => {
    const result = spawnSync('node', [SERVER], {
      input: [
        JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
        JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'run', arguments: { command: 'echo hi' } } }),
      ].join('\n') + '\n',
      encoding: 'utf-8',
    });
    expect(result.status).toBe(0);
    const lines = result.stdout.trim().split('\n');
    const call = JSON.parse(lines[1]);
    expect(call.result.isError).toBe(true);
    expect(call.result.content[0].text).toContain('only available on native Windows');
  });
});
