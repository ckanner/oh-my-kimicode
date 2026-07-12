import { describe, it, expect } from 'vitest';
import { serializeHookOutput, exitCodeForHookOutput } from '../../../src/shared/serialize.js';

describe('serialize', () => {
  it('serializes hook output to JSON with top-level message', () => {
    const out = serializeHookOutput({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: 'ok' } });
    expect(JSON.parse(out)).toEqual({
      message: 'ok',
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: 'ok' },
    });
  });

  it('returns exit code 2 for block decision', () => {
    expect(exitCodeForHookOutput({ decision: 'block', reason: 'stop' })).toBe(2);
  });

  it('returns exit code 0 for permission deny so Kimi parses permissionDecision JSON', () => {
    expect(
      exitCodeForHookOutput({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: 'no budget',
        },
      }),
    ).toBe(0);
  });

  it('returns exit code 0 for advisory output', () => {
    expect(exitCodeForHookOutput({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: '' } })).toBe(0);
  });
});
