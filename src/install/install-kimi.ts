import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveKimiEnv, pluginCacheDir } from '../shared/paths.js';
import { getHookDefs } from './hook-defs.js';
import { patchConfigToml } from './config-patcher.js';

export interface InstallOptions {
  kimiCodeHome?: string;
  projectDirectory?: string;
  binDir?: string;
  dryRun?: boolean;
  noTui?: boolean;
  autonomous?: boolean;
}

export async function runKimiInstaller(options: InstallOptions = {}): Promise<void> {
  const env = resolveKimiEnv(options);
  const version = process.env.OMO_KIMI_VERSION ?? '0.1.0';
  const cache = pluginCacheDir(env.kimiCodeHome, version);

  if (!options.dryRun) {
    fs.rmSync(cache, { recursive: true, force: true });
    fs.mkdirSync(cache, { recursive: true });
    const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'plugin');
    fs.cpSync(pluginRoot, cache, { recursive: true });
    fs.mkdirSync(env.binDir, { recursive: true });
  }

  const configPath = path.join(env.kimiCodeHome, 'config.toml');
  const hooks = getHookDefs(version, cache);
  const result = patchConfigToml(configPath, hooks, options.dryRun);

  if (options.dryRun) {
    console.log('Dry run. Proposed changes:');
    console.log(result.diff);
    return;
  }

  console.log(`Installed oh-my-kimicode ${version} to ${cache}`);
  if (result.backupPath) console.log(`Backed up config to ${result.backupPath}`);
}
