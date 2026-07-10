import type { HookPayload, HookOutput } from '../../shared/types.js';

export function verifyEvidence(payload: HookPayload): HookOutput {
  const output = JSON.stringify(payload.toolOutput ?? '');
  if (output.includes('EVIDENCE_RECORDED:')) {
    return { hookSpecificOutput: { hookEventName: 'SubagentStop', additionalContext: '' } };
  }
  return {
    decision: 'block',
    reason: 'Executor subagent stopped without recording evidence',
    hookSpecificOutput: {
      hookEventName: 'SubagentStop',
      additionalContext: 'The executor must output EVIDENCE_RECORDED: <path> before stopping.',
    },
  };
}
