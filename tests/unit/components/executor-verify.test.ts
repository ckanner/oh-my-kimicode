import { describe, it, expect } from 'vitest';
import { verifyEvidence } from '../../../src/components/executor-verify/verify.js';

describe('executor-verify', () => {
  it('allows stop with evidence in toolOutput', () => {
    const out = verifyEvidence({ hookEventName: 'SubagentStop', toolOutput: { result: 'EVIDENCE_RECORDED: /tmp/x' } });
    expect(out.decision).toBeUndefined();
    expect(out.hookSpecificOutput?.additionalContext).toBe('');
  });

  it('blocks stop without evidence', () => {
    const out = verifyEvidence({ hookEventName: 'SubagentStop', toolOutput: { result: 'done' } });
    expect(out.decision).toBe('block');
    expect(out.reason).toContain('without recording evidence');
  });

  it('blocks stop when toolOutput is missing', () => {
    const out = verifyEvidence({ hookEventName: 'SubagentStop' });
    expect(out.decision).toBe('block');
  });

  it('detects evidence anywhere in output', () => {
    const out = verifyEvidence({ hookEventName: 'SubagentStop', toolOutput: { result: 'some log\nEVIDENCE_RECORDED: tests passed\nmore log' } });
    expect(out.decision).toBeUndefined();
  });
});
