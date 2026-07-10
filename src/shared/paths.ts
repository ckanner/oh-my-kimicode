import path from 'node:path';
import os from 'node:os';

export interface PathOptions {
  kimiCodeHome?: string;
  projectDirectory?: string;
  binDir?: string;
}

export function resolveKimiEnv(options: PathOptions = {}): {
  kimiCodeHome: string;
  projectDirectory: string;
  binDir: string;
} {
  const kimiCodeHome = options.kimiCodeHome
    ?? process.env.KIMI_CODE_HOME
    ?? path.join(os.homedir(), '.kimi-code');

  const projectDirectory = options.projectDirectory
    ?? process.env.OMO_KIMI_PROJECT
    ?? process.cwd();

  const defaultHome = path.join(os.homedir(), '.kimi-code');
  const binDir = options.binDir
    ?? process.env.KIMI_LOCAL_BIN_DIR
    ?? (kimiCodeHome === defaultHome ? path.join(os.homedir(), '.local', 'bin') : path.join(kimiCodeHome, 'bin'));

  return { kimiCodeHome, projectDirectory, binDir };
}

export function pluginCacheDir(kimiCodeHome: string, version: string): string {
  return path.join(kimiCodeHome, 'plugins', 'cache', 'oh-my-kimicode', version);
}

export function omoConfigDir(): string {
  return path.join(os.homedir(), '.omo');
}
