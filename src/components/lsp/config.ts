import fs from 'node:fs';
import path from 'node:path';
import { getEnv, getProjectDir } from '../../shared/env.js';
import { parseLspArgs } from './args.js';

export interface LspConfig {
  command?: string;
  args?: string[];
}

export function getLspConfigPath(): string {
  return path.resolve(getProjectDir(), '.lazykimicode', 'lsp.json');
}

export function loadLspConfig(): LspConfig | undefined {
  const configPath = getLspConfigPath();
  if (!fs.existsSync(configPath)) return undefined;
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (!isLspConfig(parsed)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export function resolveLspCommand(): string | undefined {
  return getEnv('LSP_COMMAND') ?? loadLspConfig()?.command;
}

export function resolveLspArgs(): string[] {
  const envArgs = getEnv('LSP_ARGS');
  if (envArgs) return parseLspArgs(envArgs);
  return loadLspConfig()?.args ?? [];
}

function isLspConfig(value: unknown): value is LspConfig {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.command !== undefined && typeof v.command !== 'string') return false;
  if (v.args !== undefined && !Array.isArray(v.args)) return false;
  if (Array.isArray(v.args) && v.args.some((a) => typeof a !== 'string')) return false;
  return true;
}
