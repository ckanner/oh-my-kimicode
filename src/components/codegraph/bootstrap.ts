import type { HookPayload, HookOutput } from '../../shared/types.js';
import { buildIndex, loadIndex, saveIndex } from './indexer.js';

export function runBootstrap(payload: HookPayload): HookOutput {
  const projectDir = process.env.OMO_KIMI_PROJECT ?? process.cwd();
  if (!loadIndex(projectDir)) {
    try {
      const index = buildIndex(projectDir);
      saveIndex(projectDir, index);
    } catch (e) {
      // ignore indexing failures at bootstrap; will retry on tool use
    }
  }
  return {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: 'CodeGraph initialized in background. Use codegraph MCP tools for structural queries.',
    },
  };
}

export function runPostToolUse(_payload: HookPayload): HookOutput {
  return {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: '',
    },
  };
}
