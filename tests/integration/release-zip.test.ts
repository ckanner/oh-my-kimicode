import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PROJECT_ROOT = process.cwd();

describe('release zip', () => {
  it('contains dist/ and bin/ and runs --help', () => {
    execSync('pnpm run build', { cwd: PROJECT_ROOT, stdio: 'ignore' });
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'release-zip-'));
    const extractDir = path.join(tmp, 'extracted');
    const zipPath = path.join(tmp, 'lazykimicode.zip');
    try {
      execSync(`zip -r ${zipPath} plugin scripts bin dist package.json`, { cwd: PROJECT_ROOT, stdio: 'ignore' });
      fs.mkdirSync(extractDir, { recursive: true });
      execSync(`unzip -q ${zipPath} -d ${extractDir}`);
      const help = execSync('node ' + path.join(extractDir, 'bin', 'lazykimicode.mjs') + ' --help', { encoding: 'utf-8' });
      expect(help).toContain('lazykimicode');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
