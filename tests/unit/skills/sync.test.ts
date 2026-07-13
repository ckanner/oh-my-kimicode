import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const SKILL_DIR = path.join(ROOT, 'plugin', 'skills');

const EXPECTED_SKILLS = [
  'ast-grep', 'coding-agent-sessions', 'comment-checker', 'debugging', 'frontend', 'git-master',
  'init-deep', 'lcx-contribute-bug-fix', 'lcx-doctor', 'lcx-report-bug',
  'lsp', 'lsp-setup', 'programming', 'refactor', 'remove-ai-slops', 'review-work',
  'rules', 'start-work', 'teammode', 'ultimate-browsing', 'ultrawork',
  'ultraresearch', 'ulw-loop', 'ulw-plan', 'ulw-research', 'visual-qa',
];

const REQUIRED_FIELDS = ['name', 'description', 'type', 'whenToUse'];

const RAW_CODEX_MARKERS = [
  'multi_agent_v1',
  'codex_app',
  'apply_patch',
  'browser:control-in-app-browser',
  'create_thread',
  'send_message_to_thread',
  'read_thread',
];

function parseFrontmatter(content: string): Record<string, string> | null {
  const normalized = content.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  if (lines[0] !== '---') return null;
  const end = lines.indexOf('---', 1);
  if (end === -1) return null;
  const frontmatter: Record<string, string> = {};
  let i = 1;
  while (i < end) {
    const line = lines[i];
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if (value === '>-' || value === '>' || value === '|' || value === '|-') {
        const blockLines: string[] = [];
        i++;
        while (i < end && (lines[i].startsWith(' ') || lines[i].startsWith('\t') || lines[i] === '')) {
          blockLines.push(lines[i]);
          i++;
        }
        const nonEmpty = blockLines.filter((l) => l.trim() !== '');
        if (nonEmpty.length > 0) {
          const minIndent = Math.min(...nonEmpty.map((l) => l.length - l.trimStart().length));
          const trimmed = blockLines.map((l) => l.slice(minIndent));
          const folded = value === '>-' || value === '>';
          value = trimmed.join(folded ? ' ' : '\n').trim();
        } else {
          value = '';
        }
        i--;
      }
      frontmatter[key] = value;
    }
    i++;
  }
  return frontmatter;
}

describe('skill sync', () => {
  const actual = fs.readdirSync(SKILL_DIR).filter((name) =>
    fs.existsSync(path.join(SKILL_DIR, name, 'SKILL.md')),
  );

  it('every actual skill is in the expected list', () => {
    for (const name of actual) {
      expect(EXPECTED_SKILLS).toContain(name);
    }
  });

  it('every expected skill exists on disk', () => {
    for (const name of EXPECTED_SKILLS) {
      expect(fs.existsSync(path.join(SKILL_DIR, name, 'SKILL.md'))).toBe(true);
    }
  });
});

describe('skill quality', () => {
  const actual = fs.readdirSync(SKILL_DIR).filter((name) =>
    fs.existsSync(path.join(SKILL_DIR, name, 'SKILL.md')),
  );

  it('each skill has valid frontmatter with required fields', () => {
    for (const name of actual) {
      const content = fs.readFileSync(path.join(SKILL_DIR, name, 'SKILL.md'), 'utf-8');
      const frontmatter = parseFrontmatter(content);
      expect(frontmatter, `${name}: missing or malformed frontmatter`).not.toBeNull();
      for (const field of REQUIRED_FIELDS) {
        expect(frontmatter?.[field], `${name}: missing ${field}`).toBeTruthy();
      }
      expect(frontmatter?.name, `${name}: frontmatter name must match directory`).toBe(name);
      expect(frontmatter?.type, `${name}: frontmatter type must be 'prompt'`).toBe('prompt');
      expect(frontmatter?.description.length, `${name}: description is too short`).toBeGreaterThan(10);
      expect(frontmatter?.whenToUse.length, `${name}: whenToUse is too short`).toBeGreaterThan(5);
      expect(content, `${name}: missing Kimi Code Harness Compatibility section`).toMatch(/#{1,6}\s+Kimi Code Harness Compatibility/i);
    }
  });

  it('no raw Codex tool calls appear before the Kimi Code Harness Compatibility section', () => {
    for (const name of actual) {
      const content = fs.readFileSync(path.join(SKILL_DIR, name, 'SKILL.md'), 'utf-8');
      const compatMatch = content.match(/#{1,6}\s+Kimi Code Harness Compatibility/i);
      const beforeCompat = compatMatch ? content.slice(0, compatMatch.index) : content;
      for (const marker of RAW_CODEX_MARKERS) {
        expect(beforeCompat).not.toContain(marker);
      }
    }
  });
});
