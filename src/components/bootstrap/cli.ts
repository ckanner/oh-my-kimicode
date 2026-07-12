import { runSessionStart } from './session-start.js';
import { writeHookOutput } from '../../shared/serialize.js';
import { normalizeHookPayload } from '../../shared/payload.js';

async function main() {
  const event = process.argv[3];
  if (event !== 'session-start') {
    writeHookOutput({ hookSpecificOutput: { hookEventName: event ?? '' } });
    return;
  }
  let raw = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) raw += chunk;
  const payload = normalizeHookPayload(raw ? JSON.parse(raw) : {});
  writeHookOutput(runSessionStart(payload));
}

main().catch((e) => {
  console.error(e);
  process.exit(0); // fail-open
});
