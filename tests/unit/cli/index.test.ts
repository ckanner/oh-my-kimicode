import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const BIN = path.resolve('bin/lazykimicode.mjs');

describe('CLI', () => {
  it('prints version with --version', () => {
    const result = spawnSync('node', [BIN, '--version'], { encoding: 'utf-8' });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('prints version with version command', () => {
    const result = spawnSync('node', [BIN, 'version'], { encoding: 'utf-8' });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('rejects flag as value', () => {
    const result = spawnSync('node', [BIN, '--kimi-code-home', '--help'], { encoding: 'utf-8' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Invalid value');
  });
});
