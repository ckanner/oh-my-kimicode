import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import type { HookOutput } from '../../src/shared/types.js';

const PROJECT_ROOT = path.resolve(process.cwd());
const PLUGIN_DIR = path.join(PROJECT_ROOT, 'plugin');

const tmpDirsToClean: string[] = [];

function registerTmpDir(...dirs: string[]) {
  tmpDirsToClean.push(...dirs);
}

describe('hook execution integration', () => {
  afterEach(() => {
    for (const dir of tmpDirsToClean) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
    tmpDirsToClean.length = 0;
  });

  beforeAll(() => {
    if (!fs.existsSync(path.join(PLUGIN_DIR, 'components', 'bootstrap', 'dist', 'cli.mjs'))) {
      execFileSync('node', ['scripts/build.mjs'], { cwd: PROJECT_ROOT, stdio: 'inherit' });
    }
  });

  function runHook(component: string, event: string, payload?: Record<string, unknown>, projectDir?: string): { output: HookOutput; exitCode: number } {
    const cli = path.join(PLUGIN_DIR, 'components', component, 'dist', 'cli.mjs');
    const input = payload ? JSON.stringify(payload) : '';
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omo-hooks-'));
    registerTmpDir(stateDir);
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      LAZYKIMICODE_DISABLE_POSTHOG: '1',
      LAZYKIMICODE_STATE_DIR: stateDir,
    };
    if (projectDir) {
      env.LAZYKIMICODE_PROJECT = projectDir;
    }
    const result = spawnSync('node', [cli, 'hook', event], {
      cwd: PROJECT_ROOT,
      input,
      encoding: 'utf-8',
      env,
    });
    const stdout = result.stdout ?? '';
    const lines = stdout.trim().split('\n');
    const json = lines[lines.length - 1];
    return { output: JSON.parse(json) as HookOutput, exitCode: result.status ?? 0 };
  }

  it('bootstrap session-start returns SessionStart context', () => {
    const { output } = runHook('bootstrap', 'session-start', { hookEventName: 'SessionStart' });
    expect(output.hookSpecificOutput?.hookEventName).toBe('SessionStart');
    expect(output.message).toContain('LazyKimiCode');
  });

  it('normalizes snake_case Kimi payload fields', () => {
    const { output } = runHook('ultrawork', 'user-prompt-submit', {
      hook_event_name: 'UserPromptSubmit',
      prompt: [{ type: 'text', text: 'ulw plan my feature' }],
    });
    expect(output.hookSpecificOutput?.hookEventName).toBe('UserPromptSubmit');
    expect(output.message?.toLowerCase()).toContain('ultrawork');
  });

  it('git-bash pre-tool-use recommends git_bash on Windows', () => {
    const { output } = runHook('git-bash', 'pre-tool-use', { hookEventName: 'PreToolUse', toolName: 'Bash' });
    if (os.platform() === 'win32') {
      expect(output.message).toContain('git_bash');
    } else {
      expect(output.message).toBeUndefined();
    }
  });

  it('telemetry session-start returns empty context when disabled', () => {
    const { output } = runHook('telemetry', 'session-start', { hookEventName: 'SessionStart' });
    expect(output.hookSpecificOutput?.hookEventName).toBe('SessionStart');
    expect(output.message).toBeUndefined();
  });

  it('ultrawork detects ultrawork keyword', () => {
    const { output } = runHook('ultrawork', 'user-prompt-submit', { hookEventName: 'UserPromptSubmit', prompt: 'ultrawork plan my feature' });
    expect(output.message?.toLowerCase()).toContain('ultrawork');
  });

  it('rules discovers rules files', () => {
    const { output } = runHook('rules', 'session-start', { hookEventName: 'SessionStart' });
    expect(output.hookSpecificOutput?.hookEventName).toBe('SessionStart');
    const context = output.message ?? '';
    expect(context).toContain('# AGENTS.md');
    expect(context).toContain('Architecture');
  });

  it('comment-checker warns on TODO and exits 0', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'omo-cc-'));
    const file = path.join(tmp, 'x.ts');
    fs.writeFileSync(file, '// TODO fix this\n');
    const { output, exitCode } = runHook('comment-checker', 'post-tool-use', {
      hookEventName: 'PostToolUse',
      toolName: 'Write',
      toolInput: { path: file },
    });
    expect(output.decision).toBeUndefined();
    expect(output.message).toContain('TODO');
    expect(exitCode).toBe(0);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('ulw-loop denies budgeted CreateGoal and exits 0', () => {
    const { output, exitCode } = runHook('ulw-loop', 'pre-tool-use', {
      hookEventName: 'PreToolUse',
      toolName: 'CreateGoal',
      toolInput: { budget: 10 },
    });
    expect(output.hookSpecificOutput?.permissionDecision).toBe('deny');
    expect(exitCode).toBe(0);
  });

  it('start-work-continuation stop returns resume guidance with task titles', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'omo-boulder-'));
    fs.mkdirSync(path.join(tmp, '.lazykimicode'), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, '.lazykimicode', 'boulder.json'),
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
    );
    const { output, exitCode } = runHook('start-work-continuation', 'stop', {
      hookEventName: 'Stop',
    }, tmp);
    expect(output.decision).toBe('block');
    expect(output.message).toContain('Add auth');
    expect(output.message).toContain('Session handling');
    expect(exitCode).toBe(2);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
