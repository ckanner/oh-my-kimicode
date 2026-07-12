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

function cliPath(name: string): string {
  return path.join(PLUGIN_DIR, 'components', name, 'dist', 'cli.mjs');
}

function runCli(
  name: string,
  event: string,
  payload?: Record<string, unknown>,
  projectDir?: string,
): { output: HookOutput; exitCode: number; stderr: string } {
  const cli = cliPath(name);
  const input = payload ? JSON.stringify(payload) : '';
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omo-cli-wrappers-'));
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
  const json = lines[lines.length - 1] ?? '{}';
  return {
    output: JSON.parse(json) as HookOutput,
    exitCode: result.status ?? 0,
    stderr: result.stderr ?? '',
  };
}

describe('component CLI wrappers', () => {
  beforeAll(() => {
    if (!fs.existsSync(cliPath('bootstrap'))) {
      execFileSync('node', ['scripts/build.mjs'], { cwd: PROJECT_ROOT, stdio: 'inherit' });
    }
  });

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

  it('bootstrap session-start emits SessionStart context', () => {
    const { output, exitCode } = runCli('bootstrap', 'session-start', { hookEventName: 'SessionStart' });
    expect(exitCode).toBe(0);
    expect(output.hookSpecificOutput?.hookEventName).toBe('SessionStart');
    expect(output.message).toContain('LazyKimiCode');
  });

  it('rules session-start emits context', () => {
    const { output, exitCode } = runCli('rules', 'session-start', { hookEventName: 'SessionStart' });
    expect(exitCode).toBe(0);
    expect(output.hookSpecificOutput?.hookEventName).toBe('SessionStart');
    expect(output.message).toBeTruthy();
  });

  it('ultrawork detects keyword', () => {
    const { output, exitCode } = runCli('ultrawork', 'user-prompt-submit', {
      hookEventName: 'UserPromptSubmit',
      prompt: 'ulw plan my feature',
    });
    expect(exitCode).toBe(0);
    expect(output.hookSpecificOutput?.hookEventName).toBe('UserPromptSubmit');
    expect(output.message?.toLowerCase()).toContain('ultrawork');
  });

  it('ulw-loop parses steering prompt', () => {
    const { output, exitCode } = runCli('ulw-loop', 'user-prompt-submit', {
      hookEventName: 'UserPromptSubmit',
      prompt: 'LAZYKIMICODE_ULW_LOOP_STEER: focus on tests',
    });
    expect(exitCode).toBe(0);
    expect(output.hookSpecificOutput?.hookEventName).toBe('UserPromptSubmit');
    expect(output.message).toContain('STEERING');
  });

  it('ulw-loop denies budgeted CreateGoal and exits 0', () => {
    const { output, exitCode } = runCli('ulw-loop', 'pre-tool-use', {
      hookEventName: 'PreToolUse',
      toolName: 'CreateGoal',
      toolInput: { budget: 10 },
    });
    expect(exitCode).toBe(0);
    expect(output.hookSpecificOutput?.permissionDecision).toBe('deny');
  });

  it('start-work-continuation stop allows when no active boulder', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'omo-swc-empty-'));
    registerTmpDir(tmp);
    fs.mkdirSync(path.join(tmp, '.lazykimicode'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.lazykimicode', 'boulder.json'), JSON.stringify({}));
    const { output, exitCode } = runCli('start-work-continuation', 'stop', { hookEventName: 'Stop' }, tmp);
    expect(exitCode).toBe(0);
    expect(output.hookSpecificOutput?.hookEventName).toBe('Stop');
    expect(output.decision).toBeUndefined();
  });

  it('executor-verify warns when evidence is missing', () => {
    const { output, exitCode } = runCli('executor-verify', 'subagent-stop', {
      hookEventName: 'SubagentStop',
      toolOutput: 'done',
    });
    expect(exitCode).toBe(0);
    expect(output.decision).toBeUndefined();
    expect(output.message).toContain('EVIDENCE_RECORDED');
    expect(output.hookSpecificOutput?.hookEventName).toBe('SubagentStop');
  });

  it('executor-verify allows when evidence is recorded', () => {
    const { output, exitCode } = runCli('executor-verify', 'subagent-stop', {
      hookEventName: 'SubagentStop',
      toolOutput: 'EVIDENCE_RECORDED: /tmp/result.md',
    });
    expect(exitCode).toBe(0);
    expect(output.decision).toBeUndefined();
    expect(output.hookSpecificOutput?.hookEventName).toBe('SubagentStop');
  });

  it('telemetry session-start returns empty context', () => {
    const { output, exitCode } = runCli('telemetry', 'session-start', { hookEventName: 'SessionStart' });
    expect(exitCode).toBe(0);
    expect(output.hookSpecificOutput?.hookEventName).toBe('SessionStart');
    expect(output.message).toBeUndefined();
  });

  it('git-bash pre-tool-use recommends git_bash on Windows', () => {
    const { output, exitCode } = runCli('git-bash', 'pre-tool-use', {
      hookEventName: 'PreToolUse',
      toolName: 'Bash',
    });
    expect(exitCode).toBe(0);
    expect(output.hookSpecificOutput?.hookEventName).toBe('PreToolUse');
    if (os.platform() === 'win32') {
      expect(output.message).toContain('git_bash');
    } else {
      expect(output.message).toBeUndefined();
    }
  });

  it('lsp post-compact clears cache and returns PostCompact', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'omo-lsp-cli-'));
    registerTmpDir(tmp);
    const cacheFile = path.join(tmp, '.lazykimicode', 'lsp-cache.json');
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(['/some/file.ts']));
    const { output, exitCode } = runCli('lsp', 'post-compact', { hookEventName: 'PostCompact' }, tmp);
    expect(exitCode).toBe(0);
    expect(output.hookSpecificOutput?.hookEventName).toBe('PostCompact');
    expect(output.message).toBeUndefined();
    expect(JSON.parse(fs.readFileSync(cacheFile, 'utf-8'))).toEqual([]);
  });
});
