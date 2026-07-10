import { describe, it, expect } from 'vitest';
import { verifyEvidence } from '../../../src/components/executor-verify/verify.js';

describe('executor-verify', () => {
  it('allows stop with evidence', () => {
    const out = verifyEvidence({ hookEventName: 'SubagentStop', toolOutput: { result: 'EVIDENCE_RECORDED: /tmp/x' } });
    expect(out.decision).toBeUndefined();
  });

  it('blocks stop without evidence', () => {
    const out = verifyEvidence({ hookEventName: 'SubagentStop', toolOutput: { result: 'done' } });
    expect(out.decision).toBe('block');
  });
});
