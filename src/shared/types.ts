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
  prompt?: string;
  sessionId?: string;
  subagentType?: string;
  stopHookActive?: boolean;
  [key: string]: unknown;
}

export type HookDecision = 'block' | 'allow';

export interface HookOutput {
  hookSpecificOutput?: {
    hookEventName: string;
    additionalContext?: string;
    permissionDecision?: 'deny' | 'allow';
    permissionDecisionReason?: string;
  };
  decision?: HookDecision;
  reason?: string;
}
