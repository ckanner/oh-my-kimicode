import path from 'node:path';
import { VERSION } from './version.js';
import { getEnv, getProjectDir, getBinDir, getKimiCodeHome, getConfigDir } from './env.js';

export interface PathOptions {
  kimiCodeHome?: string;
  projectDirectory?: string;
  binDir?: string;
  version?: string;
}

export function resolveKimiEnv(options: PathOptions = {}): {
  kimiCodeHome: string;
  projectDirectory: string;
  binDir: string;
  version: string;
} {
  const kimiCodeHome = options.kimiCodeHome ?? getKimiCodeHome();
  const projectDirectory = options.projectDirectory ?? getProjectDir();
  const binDir = options.binDir ?? getBinDir();
  const version = options.version ?? getEnv('VERSION') ?? VERSION;

  return { kimiCodeHome, projectDirectory, binDir, version };
}

export function pluginCacheDir(kimiCodeHome: string, version: string): string {
  return path.join(kimiCodeHome, 'plugins', 'cache', 'lazykimicode', version);
}

export { getConfigDir };
