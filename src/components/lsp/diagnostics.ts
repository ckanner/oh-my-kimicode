import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { languageIdFromExtension } from './language-id.js';
import { LspClient } from './lsp-client.js';
import { StdioLspTransport, type LspTransport } from './transport.js';

export interface Diagnostic {
  file: string;
  line: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

const CACHE_FILE = '.omo/lsp-cache.json';

export function readCache(projectDir: string): string[] {
  const p = path.join(projectDir, CACHE_FILE);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) as string[] : [];
}

export function writeCache(projectDir: string, files: string[]): void {
  const p = path.join(projectDir, CACHE_FILE);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(files));
}

export function createTransport(command?: string, args?: string[], cwd?: string): LspTransport | undefined {
  if (!command) return undefined;
  try {
    return StdioLspTransport.spawn(command, args ?? [], cwd);
  } catch {
    return undefined;
  }
}

export async function runDiagnostics(file: string, transport?: LspTransport, rootUri?: string): Promise<Diagnostic[]> {
  const projectDir = process.env.OMO_KIMI_PROJECT ?? process.cwd();
  const filePath = path.resolve(projectDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  const uri = pathToFileURL(filePath).href;
  const languageId = languageIdFromExtension(path.extname(filePath).replace('.', ''));
  const resolvedRootUri = rootUri ?? pathToFileURL(projectDir).href + '/';

  if (!transport) {
    return [];
  }

  const client = new LspClient(transport);
  try {
    await client.initialize(resolvedRootUri);
    client.openDocument(uri, languageId, content);
    const raw = await client.requestDiagnostics(uri);
    return raw.map((d) => ({
      file,
      line: d.range.start.line + 1,
      message: d.message,
      severity: d.severity === 1 ? 'error' : d.severity === 2 ? 'warning' : 'info',
    }));
  } finally {
    client.close();
  }
}
