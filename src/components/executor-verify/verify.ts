import type { HookPayload, HookOutput } from '../../shared/types.js';

export function verifyEvidence(payload: HookPayload): HookOutput {
  const output = JSON.stringify(payload.toolOutput ?? payload.response ?? '');
  if (output.includes('EVIDENCE_RECORDED:')) {
    return { hookSpecificOutput: { hookEventName: 'SubagentStop' } };
  }
  const message = 'The executor must output EVIDENCE_RECORDED: <path> before stopping.';
  return {
    message,
    hookSpecificOutput: {
      hookEventName: 'SubagentStop',
      message,
    },
  };
}
