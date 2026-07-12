import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, execSync } from 'node:child_process';
import { linkManagedBins, getManagedBinTargets } from '../../install/bin-links.js';
import { findOnPath } from '../../shared/cross-platform.js';

export interface ProvisionResult {
  binLinksOk: boolean;
  agentCacheDir: string;
  sgAvailable: boolean;
  sgInstalled: boolean;
  sgPath?: string;
  warnings: string[];
}

export function ensureAgentCache(kimiCodeHome: string): string {
  const dir = path.join(kimiCodeHome, '.lazykimicode', 'kimi-agents');
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
  const found = findOnPath('sg');
  if (found) {
    return { available: true, path: found };
  }
  return { available: false };
}

function sgBinName(): string {
  return process.platform === 'win32' ? 'sg.exe' : 'sg';
}

function npmCommand(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

export function installAstGrep(binDir: string): { installed: boolean; path?: string; warning?: string } {
  const binPath = path.join(binDir, sgBinName());
  if (fs.existsSync(binPath)) {
    return { installed: true, path: binPath };
  }

  const installDir = path.join(os.homedir(), '.lazykimicode', 'sg-npm');
  try {
    fs.mkdirSync(installDir, { recursive: true });
    const npm = npmCommand();
    if (process.platform === 'win32') {
      execSync(`"${npm}" install --no-save --prefix "${installDir}" @ast-grep/cli`, {
        encoding: 'utf-8',
        timeout: 120000,
        stdio: 'pipe',
      });
    } else {
      execFileSync(npm, ['install', '--no-save', '--prefix', installDir, '@ast-grep/cli'], {
        encoding: 'utf-8',
        timeout: 120000,
        stdio: 'pipe',
      });
    }
    const candidate = path.join(installDir, 'node_modules', '@ast-grep', 'cli', sgBinName());
    if (!fs.existsSync(candidate)) {
      return { installed: false, warning: 'npm installed @ast-grep/cli but binary not found' };
    }
    fs.mkdirSync(binDir, { recursive: true });
    fs.copyFileSync(candidate, binPath);
    fs.chmodSync(binPath, 0o755);
    return { installed: true, path: binPath };
  } catch (e) {
    return {
      installed: false,
      warning: `Failed to install ast-grep via npm: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

export function runBootstrapProvisioning(cacheDir: string, binDir: string, kimiCodeHome: string): ProvisionResult {
  const warnings: string[] = [];
  let binLinksOk = true;
  try {
    const linked = new Set(linkManagedBins(cacheDir, binDir));
    const managed = getManagedBinTargets(cacheDir).map((b) => b.name);
    const missingManaged = managed.filter((name) => !linked.has(name));
    if (missingManaged.length) {
      warnings.push(`Missing managed bins: ${missingManaged.join(', ')}`);
    }
  } catch (e) {
    binLinksOk = false;
    warnings.push(`Bin link failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  const agentCacheDir = ensureAgentCache(kimiCodeHome);
  let sg = checkAstGrep();
  let sgInstalled = false;
  if (!sg.available) {
    const installResult = installAstGrep(binDir);
    if (installResult.installed && installResult.path) {
      sg = { available: true, path: installResult.path };
      sgInstalled = true;
    } else {
      warnings.push(installResult.warning ?? 'ast-grep (sg) not found on PATH and could not be installed');
    }
  }

  return {
    binLinksOk,
    agentCacheDir,
    sgAvailable: sg.available,
    sgInstalled,
    sgPath: sg.path,
    warnings,
  };
}
