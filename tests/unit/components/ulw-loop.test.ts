import { describe, it, expect } from 'vitest';
import { parseSteer, enforceGoalBudget } from '../../../src/components/ulw-loop/steer.js';

describe('ulw-loop', () => {
  it('parses steering instruction', () => {
    const out = parseSteer({ hookEventName: 'UserPromptSubmit', prompt: 'do it OMO_ULW_LOOP_STEER: skip tests' });
    expect(out.hookSpecificOutput?.additionalContext).toContain('STEERING');
  });

  it('denies budgeted CreateGoal', () => {
    const out = enforceGoalBudget({ hookEventName: 'PreToolUse', toolInput: { budget: 5 } });
    expect(out.hookSpecificOutput?.permissionDecision).toBe('deny');
  });
});
