import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';

export const DEFAULT_STATE_DIR = path.join(os.homedir(), '.local', 'share', 'oh-my-kimicode');
export const DEFAULT_STATE_FILE = path.join(DEFAULT_STATE_DIR, 'posthog-activity.json');

export function getStateFile(stateDir?: string): string {
  if (process.env.OMO_KIMI_STATE_FILE) return process.env.OMO_KIMI_STATE_FILE;
  const dir = stateDir ?? process.env.OMO_KIMI_STATE_DIR ?? DEFAULT_STATE_DIR;
  return path.join(dir, 'posthog-activity.json');
}

export function isTelemetryDisabled(): boolean {
  const env = process.env;
  return (
    env.OMO_KIMI_DISABLE_POSTHOG === '1' ||
    env.OMO_DISABLE_POSTHOG === '1' ||
    ['0', 'false', 'no'].includes(env.OMO_KIMI_SEND_ANONYMOUS_TELEMETRY?.toLowerCase() ?? '') ||
    ['0', 'false', 'no'].includes(env.OMO_SEND_ANONYMOUS_TELEMETRY?.toLowerCase() ?? '')
  );
}

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
