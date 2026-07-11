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
    expect(out.hookSpecificOutput?.additionalContext).toContain('Bootstrap');
  });

  it('returns provisioning details when env vars are set', () => {
    process.env.OMO_KIMI_PLUGIN_CACHE = tmpDir;
    process.env.OMO_KIMI_BIN_DIR = path.join(tmpDir, 'bin');
    process.env.KIMI_CODE_HOME = tmpDir;
    try {
      const out = runSessionStart({ hookEventName: 'SessionStart' });
      expect(out.hookSpecificOutput?.additionalContext).toContain('bins=');
      expect(out.hookSpecificOutput?.additionalContext).toContain('agents=');
      expect(out.hookSpecificOutput?.additionalContext).toContain('sg=');
    } finally {
      delete process.env.OMO_KIMI_PLUGIN_CACHE;
      delete process.env.OMO_KIMI_BIN_DIR;
      delete process.env.KIMI_CODE_HOME;
    }
  });

  it('appends resume guidance when an interrupted Boulder work has unchecked tasks', () => {
    fs.mkdirSync(path.join(tmpDir, '.omo'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.omo', 'boulder.json'),
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
    process.env.OMO_KIMI_PROJECT = tmpDir;
    try {
      const out = runSessionStart({ hookEventName: 'SessionStart' });
      expect(out.hookSpecificOutput?.additionalContext).toContain('Active work: Add auth');
      expect(out.hookSpecificOutput?.additionalContext).toContain('Session handling');
      expect(out.hookSpecificOutput?.additionalContext).toContain('Unchecked tasks');
    } finally {
      delete process.env.OMO_KIMI_PROJECT;
    }
  });

  it('does not append resume guidance when Boulder work is complete', () => {
    fs.mkdirSync(path.join(tmpDir, '.omo'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.omo', 'boulder.json'),
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
    process.env.OMO_KIMI_PROJECT = tmpDir;
    try {
      const out = runSessionStart({ hookEventName: 'SessionStart' });
      expect(out.hookSpecificOutput?.additionalContext).not.toContain('Active work: Add auth');
    } finally {
      delete process.env.OMO_KIMI_PROJECT;
    }
  });

  it('does not crash when boulder.json is malformed', () => {
    fs.mkdirSync(path.join(tmpDir, '.omo'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.omo', 'boulder.json'), 'not json', 'utf-8');
    process.env.OMO_KIMI_PROJECT = tmpDir;
    try {
      const out = runSessionStart({ hookEventName: 'SessionStart' });
      expect(out.hookSpecificOutput?.additionalContext).toContain('Boulder resume check failed');
    } finally {
      delete process.env.OMO_KIMI_PROJECT;
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
      const dir = path.join(tmpDir, '.omo', 'kimi-agents');
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
      const result = runBootstrapProvisioning(cacheDir, binDir, tmpDir);
      expect(result.binLinksOk).toBe(true);
      expect(fs.existsSync(result.agentCacheDir)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(result.warnings).toEqual([]);
    });
  });
});
