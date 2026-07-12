import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBoulder, hasUncheckedTasks, formatResumeContext } from './boulder.js';
import { writeHookOutput, exitCodeForHookOutput, writeBlockReason } from '../../shared/serialize.js';
import type { HookPayload, HookOutput } from '../../shared/types.js';

export function runStop(_payload: HookPayload): HookOutput {
  const boulder = readBoulder();
  if (!boulder || !hasUncheckedTasks(boulder)) {
    return { hookSpecificOutput: { hookEventName: 'Stop' } };
  }
  const message = formatResumeContext(boulder);
  return {
    decision: 'block',
    reason: 'Active work has unchecked tasks',
    message,
    hookSpecificOutput: {
      hookEventName: 'Stop',
      message,
    },
  };
}

export function runSubagentStop(_payload: HookPayload): HookOutput {
  const boulder = readBoulder();
  if (!boulder || !hasUncheckedTasks(boulder)) {
    return { hookSpecificOutput: { hookEventName: 'SubagentStop' } };
  }
  const message = formatResumeContext(boulder);
  return {
    message,
    hookSpecificOutput: {
      hookEventName: 'SubagentStop',
      message,
    },
  };
}

async function main() {
  const event = process.argv[3];
  const payload: HookPayload = { hookEventName: event === 'subagent-stop' ? 'SubagentStop' : 'Stop' };
  const output = event === 'subagent-stop' ? runSubagentStop(payload) : runStop(payload);
  writeHookOutput(output);
  if (output.decision === 'block' && output.reason) {
    writeBlockReason(output.reason);
  }
  process.exit(exitCodeForHookOutput(output));
}

const isMain =
  import.meta.url.startsWith('file:') &&
  path.resolve(process.argv[1] ?? '') === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((e) => { console.error(e); process.exit(0); });
}
