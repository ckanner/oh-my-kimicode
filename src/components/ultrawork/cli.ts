import { detectUltrawork } from './detect.js';
import { writeHookOutput } from '../../shared/serialize.js';
import { normalizeHookPayload } from '../../shared/payload.js';

async function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) raw += chunk;
  const payload = normalizeHookPayload(raw ? JSON.parse(raw) : {});
  writeHookOutput(detectUltrawork(payload));
}

main().catch((e) => { console.error(e); process.exit(0); });
