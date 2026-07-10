import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { resolveKimiEnv, pluginCacheDir } from '../shared/paths.js';
import { MANAGED_BINS } from './bin-links.js';

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

export function runDoctor(options: DoctorOptions = {}): HealthCheck[] {
  const env = resolveKimiEnv(options);
  const version = process.env.OMO_KIMI_VERSION ?? '0.1.0';
  const cache = pluginCacheDir(env.kimiCodeHome, version);
  const results: HealthCheck[] = [];

  // Kimi CLI
  try {
    const out = execFileSync('kimi', ['--version'], { encoding: 'utf-8', timeout: 5000 }).trim();
    results.push({ name: 'kimi-cli', ok: true, message: `Kimi Code CLI found: ${out}` });
  } catch {
    results.push({ name: 'kimi-cli', ok: false, message: 'Kimi Code CLI not found on PATH' });
  }

  // Plugin cache
  if (fs.existsSync(cache)) {
    results.push({ name: 'plugin-cache', ok: true, message: `Plugin cache present: ${cache}` });
  } else {
    results.push({ name: 'plugin-cache', ok: false, message: `Plugin cache missing: ${cache}` });
  }

  // Managed bins
  const missingBins = MANAGED_BINS.filter((name) => !fs.existsSync(path.join(env.binDir, name)));
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
    if (raw.includes('oh-my-kimicode')) {
      results.push({ name: 'config-hooks', ok: true, message: `${omoHooks} hook block(s) found in config.toml` });
    } else {
      results.push({ name: 'config-hooks', ok: false, message: 'No oh-my-kimicode hooks found in config.toml' });
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
  try {
    const out = execFileSync('which', ['sg'], { encoding: 'utf-8' }).trim();
    results.push({ name: 'ast-grep', ok: true, message: `ast-grep found: ${out}` });
  } catch {
    results.push({ name: 'ast-grep', ok: false, message: 'ast-grep (sg) not found; install via `cargo install ast-grep` or `brew install ast-grep`' });
  }

  return results;
}
