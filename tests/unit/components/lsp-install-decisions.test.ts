import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  getInstallDecisionsPath,
  isInstallDecision,
  loadInstallDecision,
  loadInstallDecisions,
  recordInstallDecision,
  validateInstallDecisionServerId,
} from '../../../src/components/lsp/install-decisions.js';

describe('lsp install decisions', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-decisions-'));
    process.env.LAZYKIMICODE_PROJECT = tmp;
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.LAZYKIMICODE_PROJECT;
  });

  it('returns empty decisions when file does not exist', () => {
    expect(loadInstallDecisions()).toEqual({});
    expect(loadInstallDecision('typescript')).toBeUndefined();
  });

  it('records a decision and reads it back', () => {
    recordInstallDecision('typescript', 'allowed', '2026-01-01T00:00:00.000Z');
    const decisions = loadInstallDecisions();
    expect(decisions.typescript).toEqual({ decision: 'allowed', decidedAt: '2026-01-01T00:00:00.000Z' });
    expect(loadInstallDecision('typescript')).toEqual({ decision: 'allowed', decidedAt: '2026-01-01T00:00:00.000Z' });
  });

  it('overwrites an existing decision', () => {
    recordInstallDecision('typescript', 'allowed');
    recordInstallDecision('typescript', 'declined');
    expect(loadInstallDecision('typescript')?.decision).toBe('declined');
  });

  it('persists to the expected path', () => {
    expect(getInstallDecisionsPath()).toBe(path.join(tmp, '.lazykimicode', 'lsp-install-decisions.json'));
    recordInstallDecision('rust', 'declined');
    expect(fs.existsSync(getInstallDecisionsPath())).toBe(true);
  });

  it('validates install decision values', () => {
    expect(isInstallDecision('allowed')).toBe(true);
    expect(isInstallDecision('declined')).toBe(true);
    expect(isInstallDecision('maybe')).toBe(false);
    expect(isInstallDecision(undefined)).toBe(false);
  });

  it('ignores malformed decision files', () => {
    const decisionsPath = getInstallDecisionsPath();
    fs.mkdirSync(path.dirname(decisionsPath), { recursive: true });
    fs.writeFileSync(decisionsPath, 'not json', 'utf-8');
    expect(loadInstallDecisions()).toEqual({});
  });

  it('accepts known server ids and aliases', () => {
    expect(validateInstallDecisionServerId('typescript-language-server')).toBeUndefined();
    expect(validateInstallDecisionServerId('rust-analyzer')).toBeUndefined();
    expect(validateInstallDecisionServerId('typescript')).toBeUndefined();
    expect(validateInstallDecisionServerId('rust')).toBeUndefined();
    expect(validateInstallDecisionServerId('python')).toBeUndefined();
  });

  it('rejects unknown server ids', () => {
    const error = validateInstallDecisionServerId('unknown-server');
    expect(error).toContain("Unknown LSP server 'unknown-server'");
    expect(error).toContain('typescript-language-server');
  });
});
