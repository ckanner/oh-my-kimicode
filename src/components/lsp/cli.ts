import { readCache, writeCache, runDiagnostics, createTransport } from './diagnostics.js';
import { writeHookOutput } from '../../shared/serialize.js';
import { pathToFileURL } from 'node:url';
import { parseLspArgs } from './args.js';
import { normalizeHookPayload } from '../../shared/payload.js';
import { getEnv, getProjectDir } from '../../shared/env.js';

async function main() {
  const event = process.argv[3];
  const projectDir = getProjectDir();
  const rootUri = pathToFileURL(projectDir).href + '/';
  if (event === 'post-compact') {
    writeCache(projectDir, []);
    writeHookOutput({ hookSpecificOutput: { hookEventName: 'PostCompact' } });
    return;
  }
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  const payload = normalizeHookPayload(raw ? JSON.parse(raw) : {});
  const toolInput = payload.toolInput as Record<string, unknown> | undefined;
  const filePath = toolInput?.path ?? toolInput?.file_path;
  const files = filePath && typeof filePath === 'string' ? [filePath] : [];
  const cached = new Set(readCache(projectDir));
  for (const f of files) cached.add(f);
  writeCache(projectDir, [...cached]);

  const lspCommand = getEnv('LSP_COMMAND');
  const lspArgs = getEnv('LSP_ARGS') ? parseLspArgs(getEnv('LSP_ARGS')!) : [];
  const transport = lspCommand ? createTransport(lspCommand, lspArgs, projectDir) : undefined;

  const all: string[] = [];
  try {
    for (const f of files) {
      const diagnostics = await runDiagnostics(f, transport, rootUri);
      if (diagnostics.length) {
        all.push(...diagnostics.map((d) => `${d.file}:${d.line}: ${d.severity}: ${d.message}`));
      }
    }
  } finally {
    transport?.close();
  }

  const message = all.length ? `LSP diagnostics:\n${all.join('\n')}` : '';
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
