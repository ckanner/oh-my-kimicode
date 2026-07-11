import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { runKimiInstaller } from '../../src/install/install-kimi.js';

const PROJECT_ROOT = path.resolve(process.cwd());

function writeExecutableScript(filePath: string, body: string): void {
  fs.writeFileSync(filePath, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
}

describe('doctor integration', () => {
  let tmpDir: string;
  let projectDir: string;
  let binDir: string;
  let originalPath: string;
  let originalDisablePosthog: string | undefined;

  beforeAll(() => {
    if (!fs.existsSync(path.join(PROJECT_ROOT, 'dist', 'cli', 'index.mjs'))) {
      execFileSync('node', ['scripts/build.mjs'], { cwd: PROJECT_ROOT, stdio: 'inherit' });
    }
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omo-doctor-'));
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omo-doctor-project-'));
    binDir = path.join(tmpDir, 'bin');
    fs.mkdirSync(binDir, { recursive: true });

    // Provide hermetic kimi and ast-grep binaries on PATH.
    writeExecutableScript(path.join(binDir, 'kimi'), 'echo "kimi version 1.0.0"');
    writeExecutableScript(path.join(binDir, 'sg'), 'echo "/fake/sg"');

    // Project rules so the project-rules check passes.
    fs.writeFileSync(path.join(projectDir, 'AGENTS.md'), '# Project Rules\n');

    originalPath = process.env.PATH ?? '';
    process.env.PATH = `${binDir}${path.delimiter}${originalPath}`;

    originalDisablePosthog = process.env.OMO_KIMI_DISABLE_POSTHOG;
    process.env.OMO_KIMI_DISABLE_POSTHOG = '1';
  });

  afterEach(() => {
    process.env.PATH = originalPath;
    if (originalDisablePosthog === undefined) {
      delete process.env.OMO_KIMI_DISABLE_POSTHOG;
    } else {
      process.env.OMO_KIMI_DISABLE_POSTHOG = originalDisablePosthog;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it('returns ok after a fresh install', async () => {
    await runKimiInstaller({ kimiCodeHome: tmpDir, projectDirectory: projectDir, binDir });

    const result = spawnSync(
      'node',
      [
        path.join(PROJECT_ROOT, 'bin', 'lazykimicode.mjs'),
        'doctor',
        '--kimi-code-home',
        tmpDir,
        '--bin-dir',
        binDir,
      ],
      {
        cwd: projectDir,
        encoding: 'utf-8',
        env: { ...process.env, OMO_KIMI_DISABLE_POSTHOG: '1' },
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('✓ plugin-cache:');
    expect(result.stdout).toContain('✓ config-hooks:');
    expect(result.stdout).toContain('✓ managed-bins:');
    expect(result.stdout).toContain('✓ project-rules:');
    expect(result.stdout).toContain('✓ kimi-cli:');
    expect(result.stdout).toContain('✓ ast-grep:');
    expect(result.stdout).not.toContain('✗');
  });
});
