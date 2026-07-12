import { recommendGitBash } from './recommend.js';
import { writeHookOutput } from '../../shared/serialize.js';
import { normalizeHookPayload } from '../../shared/payload.js';

async function main() {
  const event = process.argv[3];
  let raw = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) raw += chunk;
  const payload = normalizeHookPayload(raw ? JSON.parse(raw) : {});
  if (event === 'post-compact') {
    writeHookOutput({ hookSpecificOutput: { hookEventName: 'PostCompact' } });
    return;
  }
  writeHookOutput(recommendGitBash(payload));
}

main().catch((e) => { console.error(e); process.exit(0); });
