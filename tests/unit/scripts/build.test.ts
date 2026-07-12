import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import pkg from '../../../package.json' with { type: 'json' };

describe('build script', () => {
  it('warns when LAZYKIMICODE_POSTHOG_API_KEY is missing and stamps version in a temp copy', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-script-'));
    try {
      const projectRoot = path.resolve('.');
      fs.cpSync(projectRoot, tmpDir, {
        recursive: true,
        filter: (src) => {
          const rel = path.relative(projectRoot, src);
          if (!rel) return true;
          const top = rel.split(path.sep)[0];
          if (['.git', 'node_modules', 'dist'].includes(top)) return false;
          if (rel.startsWith('plugin/components')) return false;
          return true;
        },
      });
      fs.symlinkSync(path.join(projectRoot, 'node_modules'), path.join(tmpDir, 'node_modules'), 'dir');

      const env = { ...process.env };
      delete env.LAZYKIMICODE_POSTHOG_API_KEY;

      const result = spawnSync(
        process.execPath,
        [path.join(tmpDir, 'scripts', 'build.mjs')],
        { env, encoding: 'utf-8', stdio: 'pipe', cwd: tmpDir },
      );

      const output = `${result.stdout}\n${result.stderr}`;
      expect(output).toContain(
        'Warning: LAZYKIMICODE_POSTHOG_API_KEY not set. Telemetry will be skipped in this build.',
      );
      expect(result.status).toBe(0);

      const versionTs = fs.readFileSync(path.join(tmpDir, 'src', 'shared', 'version.ts'), 'utf-8');
      expect(versionTs).toContain(pkg.version);

      const manifest = JSON.parse(fs.readFileSync(path.join(tmpDir, 'plugin', 'kimi.plugin.json'), 'utf-8'));
      expect(manifest.version).toBe(pkg.version);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 120000);
});
