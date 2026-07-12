import { runBootstrap, runPostToolUse } from './bootstrap.js';
import { writeHookOutput } from '../../shared/serialize.js';
import { normalizeHookPayload } from '../../shared/payload.js';

async function main() {
  const event = process.argv[3];
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  const payload = normalizeHookPayload(raw ? JSON.parse(raw) : {});

  if (event === 'session-start') {
    writeHookOutput(runBootstrap(payload));
  } else if (event === 'post-tool-use') {
    writeHookOutput(runPostToolUse(payload));
  } else {
    writeHookOutput({ hookSpecificOutput: { hookEventName: event ?? '' } });
  }
}

main().catch((e) => { console.error(e); process.exit(0); });
