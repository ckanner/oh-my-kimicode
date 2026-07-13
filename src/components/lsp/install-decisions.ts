import fs from 'node:fs';
import path from 'node:path';
import { getProjectDir } from '../../shared/env.js';

export type InstallDecision = 'declined' | 'allowed';

export interface InstallDecisionRecord {
  readonly decision: InstallDecision;
  readonly decidedAt: string;
}

type InstallDecisions = Record<string, InstallDecisionRecord>;

export function getInstallDecisionsPath(): string {
  return path.resolve(getProjectDir(), '.lazykimicode', 'lsp-install-decisions.json');
}

export function loadInstallDecisions(): InstallDecisions {
  const decisionsPath = getInstallDecisionsPath();
  if (!fs.existsSync(decisionsPath)) return {};
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(decisionsPath, 'utf-8'));
    return isInstallDecisions(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function loadInstallDecision(serverId: string): InstallDecisionRecord | undefined {
  return loadInstallDecisions()[serverId];
}

export function recordInstallDecision(
  serverId: string,
  decision: InstallDecision,
  decidedAt: string = new Date().toISOString(),
): void {
  const decisions = loadInstallDecisions();
  decisions[serverId] = { decision, decidedAt };
  writeInstallDecisions(decisions);
}

export function isInstallDecision(value: unknown): value is InstallDecision {
  return value === 'declined' || value === 'allowed';
}

function writeInstallDecisions(decisions: InstallDecisions): void {
  const decisionsPath = getInstallDecisionsPath();
  fs.mkdirSync(path.dirname(decisionsPath), { recursive: true });
  const tmpPath = `${decisionsPath}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(decisions, null, 2)}\n`, 'utf-8');
  fs.renameSync(tmpPath, decisionsPath);
}

function isInstallDecisions(value: unknown): value is InstallDecisions {
  return isRecord(value) && Object.values(value).every(isInstallDecisionRecord);
}

function isInstallDecisionRecord(value: unknown): value is InstallDecisionRecord {
  if (!isRecord(value)) return false;
  return isInstallDecision(value['decision']) && typeof value['decidedAt'] === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
