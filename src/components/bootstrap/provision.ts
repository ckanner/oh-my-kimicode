import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { linkManagedBins } from '../../install/bin-links.js';

export interface ProvisionResult {
  binLinksOk: boolean;
  agentCacheDir: string;
  sgAvailable: boolean;
  sgPath?: string;
  warnings: string[];
}

export function ensureAgentCache(kimiCodeHome: string): string {
  const dir = path.join(kimiCodeHome, '.omo', 'kimi-agents');
  fs.mkdirSync(dir, { recursive: true });

  const profiles: Record<string, string> = {
    'coder.md': `# Coder Agent

You are a senior software engineer. Implement changes with clean, tested code. Prefer minimal diffs and follow project conventions. Run tests and lint before finishing.
`,
    'explore.md': `# Explore Agent

You are a research engineer. Read code, docs, and tests to answer questions. Do not modify files unless explicitly asked. Cite specific files and line numbers.
`,
    'plan.md': `# Plan Agent

You are a technical architect. Break work into small, verifiable steps. Identify risks and produce a clear execution order. Do not implement.
`,
    'reviewer.md': `# Reviewer Agent

You are a code reviewer. Check correctness, style, tests, and edge cases. Be precise and constructive. Block unclear or unsafe changes.
`,
  };

  for (const [file, content] of Object.entries(profiles)) {
    const full = path.join(dir, file);
    if (!fs.existsSync(full)) fs.writeFileSync(full, content, 'utf-8');
  }
  return dir;
}

export function checkAstGrep(): { available: boolean; path?: string } {
  try {
    const out = execFileSync('which', ['sg'], { encoding: 'utf-8' }).trim();
    return { available: true, path: out };
  } catch {
    return { available: false };
  }
}

export function runBootstrapProvisioning(cacheDir: string, binDir: string, kimiCodeHome: string): ProvisionResult {
  const warnings: string[] = [];
  let binLinksOk = true;
  try {
    const linked = linkManagedBins(cacheDir, binDir);
    if (linked.length < 4) warnings.push(`Only ${linked.length}/4 managed bins linked`);
  } catch (e) {
    binLinksOk = false;
    warnings.push(`Bin link failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  const agentCacheDir = ensureAgentCache(kimiCodeHome);
  const sg = checkAstGrep();
  if (!sg.available) {
    warnings.push('ast-grep (sg) not found on PATH; install via `cargo install ast-grep` or `brew install ast-grep`');
  }

  return {
    binLinksOk,
    agentCacheDir,
    sgAvailable: sg.available,
    sgPath: sg.path,
    warnings,
  };
}
