import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const SKILL_DIR = path.join(ROOT, 'plugin', 'skills');

describe('skill sync', () => {
  const actual = fs.readdirSync(SKILL_DIR).filter((name) =>
    fs.existsSync(path.join(SKILL_DIR, name, 'SKILL.md')),
  );

  it('every actual skill is in the expected list', () => {
    const expected = [
      'ast-grep', 'coding-agent-sessions', 'debugging', 'frontend', 'git-master',
      'init-deep', 'lcx-contribute-bug-fix', 'lcx-doctor', 'lcx-report-bug',
      'lsp-setup', 'programming', 'refactor', 'remove-ai-slops', 'review-work',
      'rules', 'start-work', 'teammode', 'ultimate-browsing', 'ultrawork',
      'ulw-loop', 'ulw-plan', 'ulw-research', 'visual-qa',
    ];
    for (const name of actual) {
      expect(expected).toContain(name);
    }
  });

  it('every expected skill exists on disk', () => {
    const expected = [
      'ast-grep', 'coding-agent-sessions', 'debugging', 'frontend', 'git-master',
      'init-deep', 'lcx-contribute-bug-fix', 'lcx-doctor', 'lcx-report-bug',
      'lsp-setup', 'programming', 'refactor', 'remove-ai-slops', 'review-work',
      'rules', 'start-work', 'teammode', 'ultimate-browsing', 'ultrawork',
      'ulw-loop', 'ulw-plan', 'ulw-research', 'visual-qa',
    ];
    for (const name of expected) {
      expect(fs.existsSync(path.join(SKILL_DIR, name, 'SKILL.md'))).toBe(true);
    }
  });
});
