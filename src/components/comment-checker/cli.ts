import { checkFile } from './check.js';
import { writeHookOutput } from '../../shared/serialize.js';
import { normalizeHookPayload } from '../../shared/payload.js';

async function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) raw += chunk;
  const payload = normalizeHookPayload(raw ? JSON.parse(raw) : {});
  const toolInput = payload.toolInput as Record<string, unknown> | undefined;
  const filePath = toolInput?.path ?? toolInput?.file_path;
  if (!filePath || typeof filePath !== 'string') {
    writeHookOutput({ hookSpecificOutput: { hookEventName: 'PostToolUse' } });
    return;
  }
  const result = checkFile(filePath);
  const message = result.hasIssue
    ? `Please resolve TODO/FIXME comments in ${filePath} before proceeding. Found: ${result.matches.slice(0, 3).join(', ')}.`
    : '';
  writeHookOutput(
    message
      ? {
          message,
          hookSpecificOutput: {
            hookEventName: 'PostToolUse',
            message,
          },
        }
      : { hookSpecificOutput: { hookEventName: 'PostToolUse' } },
  );
}

main().catch((e) => { console.error(e); process.exit(0); });
