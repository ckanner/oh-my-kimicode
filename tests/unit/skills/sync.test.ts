import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SKILLS_DIR = path.resolve(import.meta.dirname, '../../../plugin/skills');

const EXPECTED_SKILLS = [
  'ast-grep',
  'coding-agent-sessions',
  'debugging',
  'frontend',
  'git-master',
  'init-deep',
  'lcx-contribute-bug-fix',
  'lcx-doctor',
  'lcx-report-bug',
  'lsp-setup',
  'programming',
  'refactor',
  'remove-ai-slops',
  'review-work',
  'start-work',
  'teammode',
  'ultimate-browsing',
  'ultrawork',
  'ulw-loop',
  'ulw-plan',
  'ulw-research',
  'visual-qa',
];

function parseFrontmatter(rawContent: string): Record<string, string> | null {
  const content = rawContent.replace(/\r\n/g, '\n');
  if (!content.startsWith('---\n')) return null;
  const end = content.indexOf('\n---\n', 4);
  if (end === -1) return null;
  const meta: Record<string, string> = {};
  const lines = content.slice(4, end).split('\n');
  let currentKey: string | null = null;
  for (const raw of lines) {
    const line = raw.replace(/\r$/, '');
    // Empty line terminates a folded scalar.
    if (line === '') {
      currentKey = null;
      continue;
    }
    // Continuation of a folded/block scalar.
    if (currentKey && (line.startsWith('  ') || line.startsWith('\t'))) {
      meta[currentKey] += ' ' + line.trim();
      continue;
    }
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    value = value.replace(/^["']|["']$/g, '');
    meta[key] = value;
    currentKey = ['description', 'whenToUse'].includes(key) && value === '>-' ? key : null;
  }
  return meta;
}

describe('skill sync', () => {
  it('contains all expected skills', () => {
    const actual = fs.readdirSync(SKILLS_DIR).filter((n) =>
      fs.statSync(path.join(SKILLS_DIR, n)).isDirectory(),
    );
    for (const name of EXPECTED_SKILLS) {
      expect(actual).toContain(name);
    }
  });

  for (const name of EXPECTED_SKILLS) {
    const skillPath = path.join(SKILLS_DIR, name, 'SKILL.md');
    describe(name, () => {
      it('has a SKILL.md file', () => {
        expect(fs.existsSync(skillPath)).toBe(true);
      });

      it('has valid frontmatter with required fields', () => {
        const content = fs.readFileSync(skillPath, 'utf-8');
        const meta = parseFrontmatter(content);
        expect(meta).not.toBeNull();
        expect(meta?.name).toBe(name);
        expect(meta?.description?.length).toBeGreaterThan(10);
        expect(meta?.type).toBe('prompt');
        expect(meta?.whenToUse?.length).toBeGreaterThan(5);
      });

      it('has a Kimi Code Harness Compatibility section', () => {
        const content = fs.readFileSync(skillPath, 'utf-8');
        expect(
          content.includes('## Kimi Code Harness Compatibility') ||
          content.includes('# Kimi Code Harness Compatibility'),
        ).toBe(true);
      });

      it('does not contain raw Codex tool calls outside compatibility mapping', () => {
        const content = fs.readFileSync(skillPath, 'utf-8');
        const idx1 = content.indexOf('# Kimi Code Harness Compatibility');
        const idx2 = content.indexOf('## Kimi Code Harness Compatibility');
        let compatIdx = -1;
        if (idx1 !== -1 && idx2 !== -1) {
          compatIdx = Math.min(idx1, idx2);
        } else if (idx1 !== -1) {
          compatIdx = idx1;
        } else if (idx2 !== -1) {
          compatIdx = idx2;
        }
        const beforeCompat = compatIdx === -1 ? content : content.slice(0, compatIdx);
        const codexPatterns = [
          /multi_agent_v1\./,
          /codex_app\./,
          /apply_patch/,
          /browser:control-in-app-browser/,
        ];
        for (const pattern of codexPatterns) {
          expect(beforeCompat).not.toMatch(pattern);
        }
      });
    });
  }
});
