import { parseSteer, enforceGoalBudget } from './steer.js';
import { writeHookOutput } from '../../shared/serialize.js';

async function main() {
  const event = process.argv[3];
  let raw = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) raw += chunk;
  const payload = raw ? JSON.parse(raw) : {};

  if (event === 'user-prompt-submit') {
    writeHookOutput(parseSteer(payload));
  } else if (event === 'pre-tool-use') {
    writeHookOutput(enforceGoalBudget(payload));
  } else {
    writeHookOutput({ hookSpecificOutput: { hookEventName: event ?? '', additionalContext: '' } });
  }
}

main().catch((e) => { console.error(e); process.exit(0); });
