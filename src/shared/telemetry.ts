import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { getEnv, getStateDir, isTelemetryDisabled } from './env.js';

export const DEFAULT_STATE_DIR = path.join(os.homedir(), '.local', 'share', 'lazykimicode');
export const DEFAULT_STATE_FILE = path.join(DEFAULT_STATE_DIR, 'posthog-activity.json');

export function getStateFile(stateDir?: string): string {
  const override = getEnv('STATE_FILE');
  if (override) return override;
  const dir = stateDir ?? getStateDir();
  return path.join(dir, 'posthog-activity.json');
}

export { getStateDir, isTelemetryDisabled };

// Re-exported from ./env.ts so callers can import them from either module
// during the transition. The implementation in env.ts owns the namespace
// fallbacks.

export function shouldEmitDailyActive(stateDir?: string): boolean {
  if (isTelemetryDisabled()) return false;
  const today = new Date().toISOString().slice(0, 10);
  const stateFile = getStateFile(stateDir);
  const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf-8')) as Record<string, string> : {};
  if (state.lastEventDate === today) return false;
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify({ lastEventDate: today }));
  return true;
}

export function getDistinctId(): string {
  return crypto.createHash('sha256').update(`omo-kimicode:${os.hostname()}`).digest('hex');
}
