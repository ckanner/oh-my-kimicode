import { describe, it, expect } from 'vitest';
import { VERSION } from '../../../src/shared/version.js';
import pkg from '../../../package.json' with { type: 'json' };
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

describe('VERSION', () => {
  it('matches package.json version', () => {
    expect(VERSION).toBe(pkg.version);
  });

  it('build stamps version.ts and plugin manifest', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-version-'));
    const srcDir = path.resolve('.');
    execFileSync('node', ['scripts/build.mjs'], { cwd: srcDir, env: { ...process.env, OMO_KIMI_POSTHOG_API_KEY: 'test-key' } });

    const versionTs = fs.readFileSync(path.join(srcDir, 'src', 'shared', 'version.ts'), 'utf-8');
    expect(versionTs).toContain(pkg.version);

    const manifest = JSON.parse(fs.readFileSync(path.join(srcDir, 'plugin', 'kimi.plugin.json'), 'utf-8'));
    expect(manifest.version).toBe(pkg.version);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
