import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('release zip', () => {
  it('contains dist/ and bin/ and runs --help', () => {
    const projectRoot = path.resolve('.');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-zip-'));
    try {
      fs.cpSync(projectRoot, tmpDir, {
        recursive: true,
        filter: (src) => {
          const rel = path.relative(projectRoot, src);
          if (!rel) return true;
          const top = rel.split(path.sep)[0];
          if (['.git', 'node_modules', 'dist'].includes(top)) return false;
          const parts = rel.split(path.sep);
          if (parts[0] === 'plugin' && parts[1] === 'components' && parts[3] === 'dist') return false;
          return true;
        },
      });
      fs.symlinkSync(path.join(projectRoot, 'node_modules'), path.join(tmpDir, 'node_modules'), 'dir');

      execFileSync('node', ['scripts/build.mjs'], {
        cwd: tmpDir,
        env: { ...process.env, OMO_KIMI_POSTHOG_API_KEY: 'test-key' },
      });

      const extractDir = path.join(tmpDir, 'extracted');
      const archivePath = path.join(tmpDir, 'lazykimicode.tar.gz');
      fs.mkdirSync(extractDir, { recursive: true });
      execFileSync('tar', ['-czf', archivePath, 'plugin', 'scripts', 'bin', 'dist', 'package.json'], { cwd: tmpDir, stdio: 'ignore' });
      execFileSync('tar', ['-xzf', archivePath, '-C', extractDir], { cwd: tmpDir, stdio: 'ignore' });
      const help = execFileSync('node', [path.join(extractDir, 'bin', 'lazykimicode.mjs'), '--help'], { encoding: 'utf-8' });
      expect(help).toContain('lazykimicode');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
