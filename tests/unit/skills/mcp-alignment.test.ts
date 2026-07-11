import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const SKILL_DIR = path.join(ROOT, 'plugin/skills');
const SOURCE_PATHS = [
  path.join(ROOT, 'src/components/codegraph/serve.mjs'),
  path.join(ROOT, 'src/components/lsp/mcp-server.ts'),
  path.join(ROOT, 'src/components/lsp/daemon.ts'),
  path.join(ROOT, 'src/components/git-bash/mcp-server.ts'),
];

const TOOL_NAME_RE = /\{\s*name:\s*'([^']+)',/g;
const SKILL_TOOL_RE = /\b(?:(?:codegraph|lsp)_[a-z_]+|git_bash)\b/g;
const OUTDATED_CLI_RE = /lsp-tools-mcp/;

function declaredToolNames(): Set<string> {
  const names = new Set<string>();
  for (const filePath of SOURCE_PATHS) {
    const text = fs.readFileSync(filePath, 'utf-8');
    let match: RegExpExecArray | null;
    while ((match = TOOL_NAME_RE.exec(text)) !== null) {
      names.add(match[1]);
    }
  }
  return names;
}

function skillFiles(): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(SKILL_DIR)) {
    const full = path.join(SKILL_DIR, entry, 'SKILL.md');
    if (fs.existsSync(full)) files.push(full);
  }
  return files;
}

describe('MCP tool / skill alignment', () => {
  const declared = declaredToolNames();

  it('declares the tools referenced by skills', () => {
    const expected = ['codegraph_status', 'lsp_prepare_rename', 'lsp_rename', 'git_bash'];
    for (const name of expected) {
      expect(declared).toContain(name);
    }
  });

  it('declares git_bash in plugin manifest', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'plugin/kimi.plugin.json'), 'utf-8'));
    expect(manifest.mcpServers).toHaveProperty('git_bash');
    expect(manifest.mcpServers.git_bash.command).toBe('node');
    expect(manifest.mcpServers.git_bash.args).toContain('./components/git-bash/dist/mcp-server.mjs');
    expect(manifest.mcpServers.git_bash.cwd).toBe('./');
  });

  it('does not reference unknown MCP tools in skills', () => {
    const missing: string[] = [];
    for (const filePath of skillFiles()) {
      const text = fs.readFileSync(filePath, 'utf-8');
      let match: RegExpExecArray | null;
      while ((match = SKILL_TOOL_RE.exec(text)) !== null) {
        const name = match[0];
        if (!declared.has(name)) missing.push(`${name} in ${path.relative(ROOT, filePath)}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('does not use the outdated lsp-tools-mcp CLI style in skills', () => {
    const offenders: string[] = [];
    for (const filePath of skillFiles()) {
      const text = fs.readFileSync(filePath, 'utf-8');
      if (OUTDATED_CLI_RE.test(text)) offenders.push(path.relative(ROOT, filePath));
    }
    expect(offenders).toEqual([]);
  });
});
