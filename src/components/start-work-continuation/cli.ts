import { readBoulder, hasIncompleteWork } from './boulder.js';
import { writeHookOutput } from '../../shared/serialize.js';

async function main() {
  const event = process.argv[3];
  const projectDir = process.env.OMO_KIMI_PROJECT ?? process.cwd();
  const state = readBoulder(projectDir);
  const hookEventName = event === 'subagent-stop' ? 'SubagentStop' : 'Stop';
  if (hasIncompleteWork(state)) {
    writeHookOutput({
      decision: 'block',
      reason: 'Active Boulder work is incomplete',
      hookSpecificOutput: {
        hookEventName,
        additionalContext: 'There is an active start-work plan. Finish it before stopping.',
      },
    });
  } else {
    writeHookOutput({ hookSpecificOutput: { hookEventName, additionalContext: '' } });
  }
}

main().catch((e) => { console.error(e); process.exit(0); });
