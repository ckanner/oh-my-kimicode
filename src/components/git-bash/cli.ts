import { recommendGitBash } from './recommend.js';
import { writeHookOutput } from '../../shared/serialize.js';

async function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) raw += chunk;
  const payload = raw ? JSON.parse(raw) : {};
  writeHookOutput(recommendGitBash(payload));
}

main().catch((e) => { console.error(e); process.exit(0); });
