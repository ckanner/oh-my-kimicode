import type { HookPayload, HookOutput } from '../../shared/types.js';
import { extractPromptText } from '../../shared/payload.js';

const KEYWORDS = /\b(ultrawork|ulw)\b/i;

export function detectUltrawork(payload: HookPayload): HookOutput {
  const prompt = extractPromptText(payload);
  if (!KEYWORDS.test(prompt)) {
    return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit' } };
  }
  const message = 'ULTRAWORK MODE ACTIVE. Proceed autonomously. Use TodoList. Verify completion with evidence.';
  return {
    message,
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      message,
    },
  };
}
