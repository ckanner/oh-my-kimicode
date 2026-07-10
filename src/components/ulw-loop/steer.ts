import type { HookPayload, HookOutput } from '../../shared/types.js';

const STEER_PATTERN = /OMO_ULW_LOOP_STEER:\s*(.+)/i;

export function parseSteer(payload: HookPayload): HookOutput {
  const prompt = payload.prompt ?? '';
  const match = prompt.match(STEER_PATTERN);
  if (!match) {
    return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: '' } };
  }
  return {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: `ULW-LOOP STEERING: ${match[1].trim()}`,
    },
  };
}

export function enforceGoalBudget(payload: HookPayload): HookOutput {
  const toolInput = payload.toolInput as Record<string, unknown> | undefined;
  if (toolInput?.budget) {
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'Budgeted goals are not allowed in ulw-loop mode',
        additionalContext: 'Remove the budget parameter from CreateGoal.',
      },
    };
  }
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: '' } };
}
