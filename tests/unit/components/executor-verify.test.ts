import { describe, it, expect } from 'vitest';
import { verifyEvidence } from '../../../src/components/executor-verify/verify.js';

describe('executor-verify', () => {
  it('allows stop with evidence in toolOutput', () => {
    const out = verifyEvidence({ hookEventName: 'SubagentStop', toolOutput: { result: 'EVIDENCE_RECORDED: /tmp/x' } });
    expect(out.decision).toBeUndefined();
    expect(out.message).toBeUndefined();
  });

  it('warns when stop has no evidence', () => {
    const out = verifyEvidence({ hookEventName: 'SubagentStop', toolOutput: { result: 'done' } });
    expect(out.decision).toBeUndefined();
    expect(out.message).toContain('EVIDENCE_RECORDED');
  });

  it('warns when toolOutput is missing', () => {
    const out = verifyEvidence({ hookEventName: 'SubagentStop' });
    expect(out.decision).toBeUndefined();
    expect(out.message).toContain('EVIDENCE_RECORDED');
  });

  it('detects evidence anywhere in output', () => {
    const out = verifyEvidence({ hookEventName: 'SubagentStop', toolOutput: { result: 'some log\nEVIDENCE_RECORDED: tests passed\nmore log' } });
    expect(out.decision).toBeUndefined();
  });
});
