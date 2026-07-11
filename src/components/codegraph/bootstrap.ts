import type { HookPayload, HookOutput } from '../../shared/types.js';
import { buildIndex, loadIndex, saveIndex } from './indexer.js';

export function runBootstrap(_payload: HookPayload): HookOutput {
  const projectDir = process.env.OMO_KIMI_PROJECT ?? process.cwd();
  if (!loadIndex(projectDir)) {
    try {
      const index = buildIndex(projectDir);
      saveIndex(projectDir, index);
    } catch {
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

function isToolFailure(toolOutput: unknown): boolean {
  if (typeof toolOutput === 'string') {
    return /error|failed/i.test(toolOutput);
  }
  if (typeof toolOutput === 'object' && toolOutput !== null) {
    const obj = toolOutput as Record<string, unknown>;
    return ('error' in obj && obj.error != null) || ('isError' in obj && obj.isError === true);
  }
  return false;
}

export function runPostToolUse(payload: HookPayload): HookOutput {
  const isCodegraphTool =
    payload.toolName &&
    /^(codegraph[._].*|mcp__codegraph__.*)$/.test(payload.toolName);

  if (isCodegraphTool && isToolFailure(payload.toolOutput)) {
    return {
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext:
          'CodeGraph tool failed. Try running `codegraph_reindex` to rebuild the index, then retry the query.',
      },
    };
  }

  return {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: '',
    },
  };
}
