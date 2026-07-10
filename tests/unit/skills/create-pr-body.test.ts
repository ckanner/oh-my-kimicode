import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const SCRIPT = path.resolve('plugin/skills/lcx-contribute-bug-fix/scripts/create-pr-body.mjs');

describe('create-pr-body', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-body-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates a PR body from JSON input', () => {
    const inputPath = path.join(tmpDir, 'input.json');
    const outputPath = path.join(tmpDir, 'output.md');
    const input = {
      title: 'Fix broken cache',
      targetRepository: 'MoonshotAI/kimi-code',
      problem: 'Cache never invalidates.',
      reproductionLogs: 'Run test X; it fails.',
      approach: 'Add TTL.',
      confidence: 'Unit tests pass.',
      risks: 'None.',
      userVisibleBehaviorChanges: 'Cache expires after 5m.',
      verification: ['test fails before', 'test passes after'],
    };
    fs.writeFileSync(inputPath, JSON.stringify(input), 'utf-8');

    execFileSync('node', [SCRIPT, inputPath, outputPath], { encoding: 'utf-8' });

    const body = fs.readFileSync(outputPath, 'utf-8');
    expect(body).toContain('## Problem Situation');
    expect(body).toContain('Cache never invalidates.');
    expect(body).toContain('## Approach');
    expect(body).toContain('Add TTL.');
    expect(body).toContain('- test fails before');
    expect(body).toContain('Tag: oh-my-kimicode-generated');
    expect(body).toContain('https://github.com/ckanner/oh-my-kimicode');
  });

  it('errors on missing required fields', () => {
    const inputPath = path.join(tmpDir, 'input.json');
    fs.writeFileSync(inputPath, JSON.stringify({ title: 'x' }), 'utf-8');
    expect(() => execFileSync('node', [SCRIPT, inputPath, path.join(tmpDir, 'out.md')], { encoding: 'utf-8' })).toThrow();
  });
});
