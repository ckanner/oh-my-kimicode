import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';

const STATE_DIR = path.join(os.homedir(), '.local', 'share', 'oh-my-kimicode');
const STATE_FILE = path.join(STATE_DIR, 'posthog-activity.json');

export function isTelemetryDisabled(): boolean {
  const env = process.env;
  return (
    env.OMO_KIMI_DISABLE_POSTHOG === '1' ||
    env.OMO_DISABLE_POSTHOG === '1' ||
    ['0', 'false', 'no'].includes(env.OMO_KIMI_SEND_ANONYMOUS_TELEMETRY?.toLowerCase() ?? '') ||
    ['0', 'false', 'no'].includes(env.OMO_SEND_ANONYMOUS_TELEMETRY?.toLowerCase() ?? '')
  );
}

export function shouldEmitDailyActive(): boolean {
  if (isTelemetryDisabled()) return false;
  const today = new Date().toISOString().slice(0, 10);
  const state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as Record<string, string> : {};
  if (state.lastEventDate === today) return false;
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify({ lastEventDate: today }));
  return true;
}

export function getDistinctId(): string {
  return crypto.createHash('sha256').update(`omo-kimicode:${os.hostname()}`).digest('hex');
}
