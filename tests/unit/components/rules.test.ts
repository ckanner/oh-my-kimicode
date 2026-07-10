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
});
