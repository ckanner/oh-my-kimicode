import type { HookPayload, HookOutput } from '../../shared/types.js';
import { extractPromptText } from '../../shared/payload.js';

const STEER_PATTERN = /OMO_ULW_LOOP_STEER:\s*(.+)/i;

export function parseSteer(payload: HookPayload): HookOutput {
  const prompt = extractPromptText(payload);
  const match = prompt.match(STEER_PATTERN);
  if (!match) {
    return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit' } };
  }
  const message = `ULW-LOOP STEERING: ${match[1].trim()}`;
  return {
    message,
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      message,
    },
  };
}

export function enforceGoalBudget(payload: HookPayload): HookOutput {
  const toolInput = payload.toolInput as Record<string, unknown> | undefined;
  if (toolInput?.budget) {
    return {
      message: 'Remove the budget parameter from CreateGoal.',
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'Budgeted goals are not allowed in ulw-loop mode',
        message: 'Remove the budget parameter from CreateGoal.',
      },
    };
  }
  return { hookSpecificOutput: { hookEventName: 'PreToolUse' } };
}
