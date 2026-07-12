export interface KimiEnv {
  kimiCodeHome: string;
  projectDirectory: string;
  binDir: string;
  version: string;
}

export interface HookPayload {
  hookEventName: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  response?: unknown;
  prompt?: string | Array<{ type?: string; text?: string }>;
  sessionId?: string;
  subagentType?: string;
  stopHookActive?: boolean;
  [key: string]: unknown;
}

export type HookDecision = 'block' | 'allow';

export interface HookOutput {
  /**
   * Top-level message that Kimi Code CLI may append to context.
   * Use this for advisory/context-injecting hooks.
   */
  message?: string;
  hookSpecificOutput?: {
    /**
     * Legacy field kept for compatibility; prefer `message` at the top level.
     */
    hookEventName?: string;
    /**
     * @deprecated Use top-level `message` instead. Kimi ignores `additionalContext`.
     */
    additionalContext?: string;
    message?: string;
    permissionDecision?: 'deny' | 'allow';
    permissionDecisionReason?: string;
  };
  decision?: HookDecision;
  reason?: string;
}
