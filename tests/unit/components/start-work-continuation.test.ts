import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readBoulder, hasUncheckedTasks, formatResumeContext } from '../../../src/components/start-work-continuation/boulder.js';
import { runStop, runSubagentStop } from '../../../src/components/start-work-continuation/cli.js';

describe('start-work-continuation', () => {
  let tmp: string;
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'boulder-')); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('detects unchecked tasks', () => {
    fs.mkdirSync(path.join(tmp, '.lazykimicode'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.lazykimicode', 'boulder.json'), JSON.stringify({
      active_work_id: 'x',
      works: {
        x: {
          title: 'Feature X',
          status: 'active',
          tasks: [
            { id: 't1', title: 'Done task', status: 'done' },
            { id: 't2', title: 'Unchecked task', status: 'unchecked' },
          ],
        },
      },
    }));
    expect(hasUncheckedTasks(readBoulder(tmp))).toBe(true);
  });

  it('passes when all tasks are done', () => {
    fs.mkdirSync(path.join(tmp, '.lazykimicode'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.lazykimicode', 'boulder.json'), JSON.stringify({
      active_work_id: 'x',
      works: {
        x: {
          title: 'Feature X',
          status: 'active',
          tasks: [
            { id: 't1', title: 'Done task', status: 'done' },
          ],
        },
      },
    }));
    expect(hasUncheckedTasks(readBoulder(tmp))).toBe(false);
  });

  it('passes when no active work', () => {
    expect(hasUncheckedTasks(readBoulder(tmp))).toBe(false);
  });

  it('detects legacy boulder schema without tasks (completed=false)', () => {
    fs.mkdirSync(path.join(tmp, '.lazykimicode'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.lazykimicode', 'boulder.json'), JSON.stringify({
      active_work_id: 'x',
      works: {
        x: {
          title: 'Legacy work',
          status: 'active',
          completed: false,
        },
      },
    }));
    expect(hasUncheckedTasks(readBoulder(tmp))).toBe(true);
  });

  it('passes legacy boulder schema when work is completed', () => {
    fs.mkdirSync(path.join(tmp, '.lazykimicode'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.lazykimicode', 'boulder.json'), JSON.stringify({
      active_work_id: 'x',
      works: {
        x: {
          title: 'Legacy work',
          status: 'done',
          completed: true,
        },
      },
    }));
    expect(hasUncheckedTasks(readBoulder(tmp))).toBe(false);
  });

  it('passes when file is malformed', () => {
    fs.mkdirSync(path.join(tmp, '.lazykimicode'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.lazykimicode', 'boulder.json'), 'not json');
    expect(() => readBoulder(tmp)).toThrow();
  });

  it('formats resume context with unchecked tasks', () => {
    const boulder = {
      active_work_id: 'x',
      works: {
        x: {
          title: 'Feature X',
          status: 'active',
          tasks: [
            { id: 't1', title: 'Done task', status: 'done' },
            { id: 't2', title: 'Unchecked task', status: 'unchecked' },
          ],
        },
      },
    };
    const ctx = formatResumeContext(boulder);
    expect(ctx).toContain('Feature X');
    expect(ctx).toContain('Unchecked task');
    expect(ctx).toContain('t2');
  });

  it('formats legacy resume context with title and status when no tasks exist', () => {
    const boulder = {
      active_work_id: 'x',
      works: {
        x: {
          title: 'Legacy work',
          status: 'active',
          completed: false,
        },
      },
    };
    const ctx = formatResumeContext(boulder);
    expect(ctx).toContain('Legacy work');
    expect(ctx).toContain('Status: active (incomplete)');
    expect(ctx).toContain('Please finish this work');
  });
});

describe('start-work-continuation resume guidance', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boulder-'));
    process.env.LAZYKIMICODE_PROJECT = tmpDir;
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
  });

  afterEach(() => {
    process.chdir(originalCwd);
    delete process.env.LAZYKIMICODE_PROJECT;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('Stop returns block decision and resume guidance', () => {
    const out = runStop({ hookEventName: 'Stop' });
    expect(out.decision).toBe('block');
    expect(out.message).toContain('Session handling');
    expect(out.message).toContain('continue');
  });

  it('SubagentStop returns advisory resume guidance without blocking', () => {
    const out = runSubagentStop({ hookEventName: 'SubagentStop', subagentType: 'coder' });
    expect(out.decision).toBeUndefined();
    expect(out.message).toContain('Session handling');
  });

  it('blocks Stop for the skill-documented Boulder schema (schema_version 2 with tasks)', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.lazykimicode', 'boulder.json'),
      JSON.stringify({
        schema_version: 2,
        active_work_id: 'feat-auth',
        works: {
          'feat-auth': {
            work_id: 'feat-auth',
            title: 'Add auth',
            active_plan: '.lazykimicode/plans/auth.md',
            plan_name: 'auth',
            session_ids: ['kimi:session-1'],
            status: 'active',
            worktree_path: null,
            tasks: [
              { id: 't1', title: 'Login form', status: 'done' },
              { id: 't2', title: 'Session handling', status: 'unchecked' },
            ],
          },
        },
      }),
      'utf-8',
    );
    const out = runStop({ hookEventName: 'Stop' });
    expect(out.decision).toBe('block');
    expect(out.message).toContain('Session handling');
    expect(out.message).toContain('Unchecked tasks');
    expect(out.message).toContain('Active work: Add auth');
  });
});
