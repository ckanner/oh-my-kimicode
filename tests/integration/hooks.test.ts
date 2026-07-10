import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import type { HookOutput } from '../../src/shared/types.js';

const PROJECT_ROOT = path.resolve(process.cwd());
const PLUGIN_DIR = path.join(PROJECT_ROOT, 'plugin');

describe('hook execution integration', () => {
  beforeAll(() => {
    if (!fs.existsSync(path.join(PLUGIN_DIR, 'components', 'bootstrap', 'dist', 'cli.mjs'))) {
      execFileSync('node', ['scripts/build.mjs'], { cwd: PROJECT_ROOT, stdio: 'inherit' });
    }
  });

  function runHook(component: string, event: string, payload?: Record<string, unknown>): { output: HookOutput; exitCode: number } {
    const cli = path.join(PLUGIN_DIR, 'components', component, 'dist', 'cli.mjs');
    const input = payload ? JSON.stringify(payload) : '';
    const result = spawnSync('node', [cli, 'hook', event], {
      cwd: PROJECT_ROOT,
      input,
      encoding: 'utf-8',
      env: {
        ...process.env,
        OMO_KIMI_DISABLE_POSTHOG: '1',
        OMO_KIMI_STATE_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'omo-hooks-')),
      },
    });
    const stdout = result.stdout ?? '';
    const lines = stdout.trim().split('\n');
    const json = lines[lines.length - 1];
    return { output: JSON.parse(json) as HookOutput, exitCode: result.status ?? 0 };
  }

  it('bootstrap session-start returns SessionStart context', () => {
    const { output } = runHook('bootstrap', 'session-start', { hookEventName: 'SessionStart' });
    expect(output.hookSpecificOutput?.hookEventName).toBe('SessionStart');
    expect(output.hookSpecificOutput?.additionalContext).toContain('OmO');
  });

  it('git-bash pre-tool-use recommends git_bash on Windows', () => {
    const { output } = runHook('git-bash', 'pre-tool-use', { hookEventName: 'PreToolUse', toolName: 'Bash' });
    if (os.platform() === 'win32') {
      expect(output.hookSpecificOutput?.additionalContext).toContain('git_bash');
    } else {
      expect(output.hookSpecificOutput?.additionalContext).toBe('');
    }
  });

  it('telemetry session-start returns empty context when disabled', () => {
    const { output } = runHook('telemetry', 'session-start', { hookEventName: 'SessionStart' });
    expect(output.hookSpecificOutput?.hookEventName).toBe('SessionStart');
    expect(output.hookSpecificOutput?.additionalContext).toBe('');
  });

  it('ultrawork detects ultrawork keyword', () => {
    const { output } = runHook('ultrawork', 'user-prompt-submit', { hookEventName: 'UserPromptSubmit', prompt: 'ultrawork plan my feature' });
    expect(output.hookSpecificOutput?.additionalContext?.toLowerCase()).toContain('ultrawork');
  });

  it('rules discovers rules files', () => {
    const { output } = runHook('rules', 'session-start', { hookEventName: 'SessionStart' });
    expect(output.hookSpecificOutput?.hookEventName).toBe('SessionStart');
  });

  it('comment-checker blocks on TODO and exits 2', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'omo-cc-'));
    const file = path.join(tmp, 'x.ts');
    fs.writeFileSync(file, '// TODO fix this\n');
    const { output, exitCode } = runHook('comment-checker', 'post-tool-use', {
      hookEventName: 'PostToolUse',
      toolName: 'Write',
      toolInput: { path: file },
    });
    expect(output.decision).toBe('block');
    expect(exitCode).toBe(2);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('ulw-loop denies budgeted CreateGoal and exits 2', () => {
    const { output, exitCode } = runHook('ulw-loop', 'pre-tool-use', {
      hookEventName: 'PreToolUse',
      toolName: 'CreateGoal',
      toolInput: { budget: 10 },
    });
    expect(output.hookSpecificOutput?.permissionDecision).toBe('deny');
    expect(exitCode).toBe(2);
  });
});
