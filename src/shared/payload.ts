import type { HookPayload } from './types.js';

const SNAKE_TO_CAMEL: Record<string, keyof HookPayload> = {
  hook_event_name: 'hookEventName',
  tool_name: 'toolName',
  tool_input: 'toolInput',
  tool_output: 'toolOutput',
  tool_call_id: 'toolCallId',
  session_id: 'sessionId',
  agent_name: 'subagentType',
  subagent_type: 'subagentType',
  stop_hook_active: 'stopHookActive',
  response: 'response',
  prompt: 'prompt',
};

/**
 * Normalize a raw hook payload from Kimi Code CLI into the internal
 * HookPayload shape. Kimi sends snake_case fields; we accept both snake_case
 * and camelCase so tests and real sessions work.
 */
export function normalizeHookPayload(raw: unknown): HookPayload {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { hookEventName: '' };
  }

  const input = raw as Record<string, unknown>;
  const out = {} as HookPayload;

  for (const [key, value] of Object.entries(input)) {
    const camelKey = SNAKE_TO_CAMEL[key] ?? (key as keyof HookPayload);
    (out as Record<string, unknown>)[camelKey as string] = value;
  }

  // Ensure hookEventName is always a string.
  if (typeof out.hookEventName !== 'string') {
    out.hookEventName = '';
  }

  return out;
}

/**
 * Extract plain text from a UserPromptSubmit prompt. Kimi may send either a
 * string or an array of ContentPart objects.
 */
export function extractPromptText(payload: HookPayload): string {
  const prompt = payload.prompt;
  if (typeof prompt === 'string') return prompt;
  if (Array.isArray(prompt)) {
    return prompt
      .map((part) => (typeof part === 'object' && part !== null ? (part as { text?: string }).text ?? '' : String(part)))
      .join('');
  }
  return '';
}
