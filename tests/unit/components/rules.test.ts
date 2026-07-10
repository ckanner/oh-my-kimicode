import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { discoverRules, formatRulesContext } from '../../../src/components/rules/discover.js';

describe('rules', () => {
  let tmp: string;
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-')); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('discovers AGENTS.md and .omo/rules', () => {
    fs.mkdirSync(path.join(tmp, '.omo', 'rules'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'AGENTS.md'), '# Rules\nUse TypeScript.');
    fs.writeFileSync(path.join(tmp, '.omo', 'rules', 'api.md'), '# API\nUse REST.');
    const rules = discoverRules(tmp);
    expect(rules.agentsMd).toContain('TypeScript');
    expect(rules.ruleFiles).toHaveLength(1);
    const ctx = formatRulesContext(rules);
    expect(ctx).toContain('AGENTS.md');
    expect(ctx).toContain('api.md');
  });

  it('returns empty rules for project without rules', () => {
    const rules = discoverRules(tmp);
    expect(rules.agentsMd).toBeUndefined();
    expect(rules.ruleFiles).toHaveLength(0);
    expect(formatRulesContext(rules)).toBe('');
  });

  it('ignores non-markdown files in rules directory', () => {
    fs.mkdirSync(path.join(tmp, '.omo', 'rules'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.omo', 'rules', 'notes.txt'), 'not a rule');
    fs.writeFileSync(path.join(tmp, '.omo', 'rules', 'valid.md'), '# Valid');
    const rules = discoverRules(tmp);
    expect(rules.ruleFiles).toHaveLength(1);
    expect(rules.ruleFiles[0].path).toContain('valid.md');
  });

  it('reads multiple rule files', () => {
    fs.mkdirSync(path.join(tmp, '.omo', 'rules'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.omo', 'rules', 'b.md'), '# B');
    fs.writeFileSync(path.join(tmp, '.omo', 'rules', 'a.md'), '# A');
    const rules = discoverRules(tmp);
    const names = rules.ruleFiles.map((f) => path.basename(f.path)).sort();
    expect(names).toEqual(['a.md', 'b.md']);
  });
});
