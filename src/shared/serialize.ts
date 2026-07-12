import type { HookOutput } from './types.js';

/**
 * Build a Kimi-compatible hook output object.
 *
 * Kimi Code CLI's runner only understands:
 *   - top-level `message`
 *   - `hookSpecificOutput.message`
 *   - `hookSpecificOutput.permissionDecision` / `permissionDecisionReason`
 *
 * The legacy `additionalContext` field is ignored, so we copy it to `message`.
 */
export function buildHookOutput(output: HookOutput): HookOutput {
  const message = output.message ?? output.hookSpecificOutput?.message ?? output.hookSpecificOutput?.additionalContext;
  if (message !== undefined && output.message === undefined) {
    return { ...output, message };
  }
  return output;
}

export function serializeHookOutput(output: HookOutput): string {
  return JSON.stringify(buildHookOutput(output));
}

export function writeHookOutput(output: HookOutput): void {
  process.stdout.write(serializeHookOutput(output) + '\n');
}

/**
 * For a `Stop` block, Kimi uses stderr as the reason. Write the reason to
 * stderr before exiting with code 2.
 */
export function writeBlockReason(reason: string): void {
  process.stderr.write(reason + '\n');
}

export function exitCodeForHookOutput(output: HookOutput): number {
  // A hard block (Stop) uses exit code 2; stderr carries the reason.
  if (output.decision === 'block') return 2;
  // PreToolUse deny must exit 0 so Kimi parses permissionDecision JSON.
  if (output.hookSpecificOutput?.permissionDecision === 'deny') return 0;
  return 0;
}
