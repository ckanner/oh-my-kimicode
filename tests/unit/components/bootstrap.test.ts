import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runSessionStart } from '../../../src/components/bootstrap/session-start.js';
import { ensureAgentCache, checkAstGrep, runBootstrapProvisioning } from '../../../src/components/bootstrap/provision.js';

describe('bootstrap', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns session-start context', () => {
    const out = runSessionStart({ hookEventName: 'SessionStart' });
    expect(out.hookSpecificOutput?.hookEventName).toBe('SessionStart');
    expect(out.message).toContain('Bootstrap');
  });

  it('returns provisioning details when env vars are set', () => {
    process.env.LAZYKIMICODE_PLUGIN_CACHE = tmpDir;
    process.env.LAZYKIMICODE_BIN_DIR = path.join(tmpDir, 'bin');
    process.env.KIMI_CODE_HOME = tmpDir;

    // Provide a fake sg binary on PATH so the test does not invoke npm install.
    const fakeSg = path.join(tmpDir, process.platform === 'win32' ? 'sg.cmd' : 'sg');
    if (process.platform === 'win32') {
      fs.writeFileSync(fakeSg, '@echo off\necho "ast-grep 0.1.0"', 'utf-8');
    } else {
      fs.writeFileSync(fakeSg, '#!/bin/sh\necho "ast-grep 0.1.0"', 'utf-8');
      fs.chmodSync(fakeSg, 0o755);
    }
    const originalPath = process.env.PATH;
    process.env.PATH = `${tmpDir}${path.delimiter}${originalPath}`;

    try {
      const out = runSessionStart({ hookEventName: 'SessionStart' });
      expect(out.message).toContain('bins=');
      expect(out.message).toContain('agents=');
      expect(out.message).toContain('sg=');
    } finally {
      delete process.env.LAZYKIMICODE_PLUGIN_CACHE;
      delete process.env.LAZYKIMICODE_BIN_DIR;
      delete process.env.KIMI_CODE_HOME;
      process.env.PATH = originalPath;
    }
  });

  it('appends resume guidance when an interrupted Boulder work has unchecked tasks', () => {
    fs.mkdirSync(path.join(tmpDir, '.lazykimicode'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.lazykimicode', 'boulder.json'),
      JSON.stringify({
        active_work_id: 'feat-auth',
        works: {
          'feat-auth': {
            title: 'Add auth',
            status: 'active',
            tasks: [
              { id: 't1', title: 'Login form', status: 'done' },
              { id: 't2', title: 'Session handling', status: 'unchecked' },
            ],
          },
        },
      }),
      'utf-8',
    );
    process.env.LAZYKIMICODE_PROJECT = tmpDir;
    try {
      const out = runSessionStart({ hookEventName: 'SessionStart' });
      expect(out.message).toContain('Active work: Add auth');
      expect(out.message).toContain('Session handling');
      expect(out.message).toContain('Unchecked tasks');
    } finally {
      delete process.env.LAZYKIMICODE_PROJECT;
    }
  });

  it('does not append resume guidance when Boulder work is complete', () => {
    fs.mkdirSync(path.join(tmpDir, '.lazykimicode'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.lazykimicode', 'boulder.json'),
      JSON.stringify({
        active_work_id: 'feat-auth',
        works: {
          'feat-auth': {
            title: 'Add auth',
            status: 'completed',
            tasks: [{ id: 't1', title: 'Login form', status: 'done' }],
          },
        },
      }),
      'utf-8',
    );
    process.env.LAZYKIMICODE_PROJECT = tmpDir;
    try {
      const out = runSessionStart({ hookEventName: 'SessionStart' });
      expect(out.message).not.toContain('Active work: Add auth');
    } finally {
      delete process.env.LAZYKIMICODE_PROJECT;
    }
  });

  it('does not crash when boulder.json is malformed', () => {
    fs.mkdirSync(path.join(tmpDir, '.lazykimicode'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.lazykimicode', 'boulder.json'), 'not json', 'utf-8');
    process.env.LAZYKIMICODE_PROJECT = tmpDir;
    try {
      const out = runSessionStart({ hookEventName: 'SessionStart' });
      expect(out.message).toContain('Boulder resume check failed');
    } finally {
      delete process.env.LAZYKIMICODE_PROJECT;
    }
  });

  describe('provision', () => {
    it('creates agent cache with profiles', () => {
      const dir = ensureAgentCache(tmpDir);
      expect(fs.existsSync(path.join(dir, 'coder.md'))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'explore.md'))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'plan.md'))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'reviewer.md'))).toBe(true);
    });

    it('does not overwrite existing profiles', () => {
      const dir = path.join(tmpDir, '.lazykimicode', 'kimi-agents');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'coder.md'), 'custom', 'utf-8');
      ensureAgentCache(tmpDir);
      expect(fs.readFileSync(path.join(dir, 'coder.md'), 'utf-8')).toBe('custom');
    });

    it('checks ast-grep availability', () => {
      const result = checkAstGrep();
      expect(typeof result.available).toBe('boolean');
    });

    it('provisions bins, agents, and reports sg status', () => {
      const cacheDir = path.join(tmpDir, 'cache');
      const binDir = path.join(tmpDir, 'bin');
      const bins = [
        path.join(cacheDir, 'components', 'git-bash', 'dist', 'mcp-server.mjs'),
        path.join(cacheDir, 'components', 'lsp', 'dist', 'mcp-server.mjs'),
        path.join(cacheDir, 'components', 'lsp', 'dist', 'daemon.mjs'),
        path.join(cacheDir, 'components', 'codegraph', 'dist', 'serve.mjs'),
      ];
      for (const bin of bins) {
        fs.mkdirSync(path.dirname(bin), { recursive: true });
        fs.writeFileSync(bin, '', 'utf-8');
      }

      // Provide a fake sg binary on PATH so the test does not invoke npm install.
      const fakeSg = path.join(tmpDir, process.platform === 'win32' ? 'sg.cmd' : 'sg');
      if (process.platform === 'win32') {
        fs.writeFileSync(fakeSg, '@echo off\necho "ast-grep 0.1.0"', 'utf-8');
      } else {
        fs.writeFileSync(fakeSg, '#!/bin/sh\necho "ast-grep 0.1.0"', 'utf-8');
        fs.chmodSync(fakeSg, 0o755);
      }
      const originalPath = process.env.PATH;
      process.env.PATH = `${tmpDir}${path.delimiter}${originalPath}`;
      try {
        const result = runBootstrapProvisioning(cacheDir, binDir, tmpDir);
        expect(result.binLinksOk).toBe(true);
        expect(fs.existsSync(result.agentCacheDir)).toBe(true);
        expect(result.sgAvailable).toBe(true);
        expect(Array.isArray(result.warnings)).toBe(true);
      } finally {
        process.env.PATH = originalPath;
      }
    });
  });
});
