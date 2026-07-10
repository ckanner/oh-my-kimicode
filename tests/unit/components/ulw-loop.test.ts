import { describe, it, expect } from 'vitest';
import { parseSteer, enforceGoalBudget } from '../../../src/components/ulw-loop/steer.js';

describe('ulw-loop', () => {
  it('parses steering instruction', () => {
    const out = parseSteer({ hookEventName: 'UserPromptSubmit', prompt: 'do it OMO_ULW_LOOP_STEER: skip tests' });
    expect(out.hookSpecificOutput?.additionalContext).toContain('STEERING');
    expect(out.hookSpecificOutput?.additionalContext).toContain('skip tests');
  });

  it('is silent without steering marker', () => {
    const out = parseSteer({ hookEventName: 'UserPromptSubmit', prompt: 'do it' });
    expect(out.hookSpecificOutput?.additionalContext).toBe('');
  });

  it('denies budgeted CreateGoal', () => {
    const out = enforceGoalBudget({ hookEventName: 'PreToolUse', toolInput: { budget: 5 } });
    expect(out.hookSpecificOutput?.permissionDecision).toBe('deny');
    expect(out.hookSpecificOutput?.permissionDecisionReason).toContain('Budgeted');
  });

  it('allows CreateGoal without budget', () => {
    const out = enforceGoalBudget({ hookEventName: 'PreToolUse', toolInput: { objective: 'foo' } });
    expect(out.hookSpecificOutput?.permissionDecision).toBeUndefined();
    expect(out.hookSpecificOutput?.additionalContext).toBe('');
  });

  it('handles missing toolInput', () => {
    const out = enforceGoalBudget({ hookEventName: 'PreToolUse' });
    expect(out.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });
});
