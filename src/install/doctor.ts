import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
import { resolveKimiEnv, pluginCacheDir } from '../shared/paths.js';
import { MANAGED_BINS } from './bin-links.js';
import { VERSION } from '../shared/version.js';

export interface DoctorOptions {
  kimiCodeHome?: string;
  projectDirectory?: string;
  binDir?: string;
}

export interface HealthCheck {
  name: string;
  ok: boolean;
  message: string;
}

function findOnPath(name: string): string | null {
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    const out = execFileSync(cmd, [name], { encoding: 'utf-8', timeout: 5000 }).trim();
    return out.split(/\r?\n/)[0] || null;
  } catch {
    return null;
  }
}

function runVersion(command: string, fallbackPath?: string): string {
  const candidates = fallbackPath ? [fallbackPath, command] : [command];
  for (const candidate of candidates) {
    try {
      if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(candidate)) {
        return execSync(`"${candidate}" --version`, { encoding: 'utf-8', timeout: 5000 }).trim();
      }
      return execFileSync(candidate, ['--version'], { encoding: 'utf-8', timeout: 5000 }).trim();
    } catch {
      // try next candidate
    }
  }
  throw new Error(`${command} --version failed`);
}

export function runDoctor(options: DoctorOptions = {}): HealthCheck[] {
  const env = resolveKimiEnv(options);
  const version = process.env.OMO_KIMI_VERSION ?? VERSION;
  const cache = pluginCacheDir(env.kimiCodeHome, version);
  const results: HealthCheck[] = [];

  // Kimi CLI
  const kimiPath = findOnPath('kimi');
  if (kimiPath) {
    try {
      const out = runVersion('kimi', kimiPath);
      results.push({ name: 'kimi-cli', ok: true, message: `Kimi Code CLI found: ${out}` });
    } catch {
      results.push({ name: 'kimi-cli', ok: false, message: 'Kimi Code CLI found on PATH but --version failed' });
    }
  } else {
    results.push({ name: 'kimi-cli', ok: false, message: 'Kimi Code CLI not found on PATH' });
  }

  // Plugin cache
  if (fs.existsSync(cache)) {
    results.push({ name: 'plugin-cache', ok: true, message: `Plugin cache present: ${cache}` });
  } else {
    results.push({ name: 'plugin-cache', ok: false, message: `Plugin cache missing: ${cache}` });
  }

  // Managed bins (POSIX symlinks or Windows .cmd wrappers)
  const missingBins = MANAGED_BINS.filter((name) => {
    const base = path.join(env.binDir, name);
    if (fs.existsSync(base)) return false;
    if (process.platform === 'win32' && fs.existsSync(`${base}.cmd`)) return false;
    return true;
  });
  if (missingBins.length === 0) {
    results.push({ name: 'managed-bins', ok: true, message: `All managed bins linked in ${env.binDir}` });
  } else {
    results.push({ name: 'managed-bins', ok: false, message: `Missing bins: ${missingBins.join(', ')}` });
  }

  // Hooks in config.toml
  const configPath = path.join(env.kimiCodeHome, 'config.toml');
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const omoHooks = (raw.match(/\[\[hooks\]\]/g) ?? []).length;
    if (raw.includes('lazykimicode')) {
      results.push({ name: 'config-hooks', ok: true, message: `${omoHooks} hook block(s) found in config.toml` });
    } else {
      results.push({ name: 'config-hooks', ok: false, message: 'No lazykimicode hooks found in config.toml' });
    }
  } else {
    results.push({ name: 'config-hooks', ok: false, message: `config.toml not found: ${configPath}` });
  }

  // AGENTS.md / .omo/rules
  const agentsMd = path.join(env.projectDirectory, 'AGENTS.md');
  const rulesDir = path.join(env.projectDirectory, '.omo', 'rules');
  if (fs.existsSync(agentsMd) || fs.existsSync(rulesDir)) {
    results.push({ name: 'project-rules', ok: true, message: 'Project rules found' });
  } else {
    results.push({ name: 'project-rules', ok: false, message: 'No AGENTS.md or .omo/rules found in project directory' });
  }

  // ast-grep
  const sgPath = findOnPath('sg');
  if (sgPath) {
    results.push({ name: 'ast-grep', ok: true, message: `ast-grep found: ${sgPath}` });
  } else {
    results.push({ name: 'ast-grep', ok: false, message: 'ast-grep (sg) not found; install via `cargo install ast-grep` or `brew install ast-grep`' });
  }

  return results;
}
