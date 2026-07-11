import { fileURLToPath } from 'node:url';
import { readBoulder, hasUncheckedTasks, formatResumeContext } from './boulder.js';
import { writeHookOutput, exitCodeForHookOutput } from '../../shared/serialize.js';
import type { HookPayload, HookOutput } from '../../shared/types.js';

export function runStop(_payload: HookPayload): HookOutput {
  const boulder = readBoulder();
  if (!boulder || !hasUncheckedTasks(boulder)) {
    return { hookSpecificOutput: { hookEventName: 'Stop', additionalContext: '' } };
  }
  return {
    decision: 'block',
    reason: 'Active work has unchecked tasks',
    hookSpecificOutput: {
      hookEventName: 'Stop',
      additionalContext: formatResumeContext(boulder),
    },
  };
}

export function runSubagentStop(_payload: HookPayload): HookOutput {
  const boulder = readBoulder();
  if (!boulder || !hasUncheckedTasks(boulder)) {
    return { hookSpecificOutput: { hookEventName: 'SubagentStop', additionalContext: '' } };
  }
  return {
    decision: 'block',
    reason: 'Active work has unchecked tasks; subagent cannot stop yet',
    hookSpecificOutput: {
      hookEventName: 'SubagentStop',
      additionalContext: formatResumeContext(boulder),
    },
  };
}

async function main() {
  const event = process.argv[3];
  const payload: HookPayload = { hookEventName: event === 'subagent-stop' ? 'SubagentStop' : 'Stop' };
  const output = event === 'subagent-stop' ? runSubagentStop(payload) : runStop(payload);
  writeHookOutput(output);
  process.exit(exitCodeForHookOutput(output));
}

const isMain = import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((e) => { console.error(e); process.exit(0); });
}
