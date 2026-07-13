import fs from 'node:fs';
import path from 'node:path';
import { getProjectDir } from '../../shared/env.js';
import { VERSION } from '../../shared/version.js';
import { writeHookOutput } from '../../shared/serialize.js';

interface NpmView {
  'dist-tags'?: { latest?: string };
}

async function fetchLatestVersion(): Promise<string | undefined> {
  try {
    const res = await fetch('https://registry.npmjs.org/lazykimicode/latest', {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as NpmView;
    return data['dist-tags']?.latest;
  } catch {
    return undefined;
  }
}

function readLastCheck(projectDir: string): string | undefined {
  const p = path.join(projectDir, '.lazykimicode', 'auto-update.json');
  if (!fs.existsSync(p)) return undefined;
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as { lastCheck?: string; lastVersion?: string };
    return parsed.lastCheck;
  } catch {
    return undefined;
  }
}

function writeLastCheck(projectDir: string, version: string): void {
  const p = path.join(projectDir, '.lazykimicode', 'auto-update.json');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ lastCheck: new Date().toISOString(), lastVersion: version }, null, 2));
}

export async function runAutoUpdate(): Promise<void> {
  const projectDir = getProjectDir();
  const lastCheck = readLastCheck(projectDir);
  const now = Date.now();
  // Check at most once per day.
  if (lastCheck && now - new Date(lastCheck).getTime() < 24 * 60 * 60 * 1000) {
    writeHookOutput({ message: '' });
    return;
  }

  const latest = await fetchLatestVersion();
  writeLastCheck(projectDir, VERSION);

  if (!latest) {
    writeHookOutput({ message: '' });
    return;
  }

  if (latest !== VERSION) {
    writeHookOutput({
      message: `LazyKimiCode ${latest} is available (you are running ${VERSION}). Run "pnpm add -g lazykimicode" or reinstall to update.`,
    });
    return;
  }

  writeHookOutput({ message: '' });
}

if (process.argv[2] === 'hook' && process.argv[3] === 'session-start') {
  runAutoUpdate().catch(() => {
    writeHookOutput({ message: '' });
  });
}
