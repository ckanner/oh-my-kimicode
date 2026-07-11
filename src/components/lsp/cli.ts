import { readCache, writeCache, runDiagnostics, createTransport } from './diagnostics.js';
import { writeHookOutput } from '../../shared/serialize.js';
import { pathToFileURL } from 'node:url';

async function main() {
  const event = process.argv[3];
  const projectDir = process.env.OMO_KIMI_PROJECT ?? process.cwd();
  const rootUri = pathToFileURL(projectDir).href + '/';
  if (event === 'post-compact') {
    writeCache(projectDir, []);
    writeHookOutput({ hookSpecificOutput: { hookEventName: 'PostCompact', additionalContext: '' } });
    return;
  }
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  const payload = raw ? JSON.parse(raw) : {};
  const filePath = payload.toolInput?.path ?? payload.toolInput?.file_path;
  const files = filePath && typeof filePath === 'string' ? [filePath] : [];
  const cached = new Set(readCache(projectDir));
  for (const f of files) cached.add(f);
  writeCache(projectDir, [...cached]);

  const lspCommand = process.env.OMO_KIMI_LSP_COMMAND;
  const lspArgs = process.env.OMO_KIMI_LSP_ARGS?.split(' ') ?? [];
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

  writeHookOutput({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: all.length ? `LSP diagnostics:\n${all.join('\n')}` : '',
    },
  });
}

main().catch((e) => { console.error(e); process.exit(0); });
