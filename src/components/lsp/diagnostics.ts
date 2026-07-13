import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { languageIdFromExtension } from './language-id.js';
import { LspClient } from './lsp-client.js';
import { StdioLspTransport, type LspTransport } from './transport.js';
import { getProjectDir } from '../../shared/env.js';

export type SeverityFilter = 'error' | 'warning' | 'information' | 'hint' | 'all';

export interface Diagnostic {
  file: string;
  line: number;
  message: string;
  severity: 'error' | 'warning' | 'information' | 'hint';
}

const CACHE_FILE = '.lazykimicode/lsp-cache.json';

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

function severityNumberToName(severity?: number): Diagnostic['severity'] {
  switch (severity) {
    case 1: return 'error';
    case 2: return 'warning';
    case 3: return 'information';
    case 4: return 'hint';
    default: return 'information';
  }
}

function severityMatches(filter: SeverityFilter, severity: Diagnostic['severity']): boolean {
  if (filter === 'all') return true;
  return filter === severity;
}

export async function runDiagnostics(
  file: string,
  transport?: LspTransport,
  rootUri?: string,
  severityFilter: SeverityFilter = 'all',
): Promise<Diagnostic[]> {
  const projectDir = getProjectDir();
  const filePath = path.resolve(projectDir, file);
  const resolvedRootUri = rootUri ?? pathToFileURL(projectDir).href + '/';

  if (!transport) {
    return [];
  }

  const files = collectFiles(filePath);
  const client = new LspClient(transport);
  try {
    await client.initialize(resolvedRootUri);
    const results: Diagnostic[] = [];
    for (const f of files) {
      const content = fs.readFileSync(f, 'utf-8');
      const uri = pathToFileURL(f).href;
      const languageId = languageIdFromExtension(path.extname(f).replace('.', ''));
      client.openDocument(uri, languageId, content);
      const raw = await client.requestDiagnostics(uri);
      for (const d of raw) {
        const severity = severityNumberToName(d.severity);
        if (!severityMatches(severityFilter, severity)) continue;
        results.push({
          file: path.relative(projectDir, f),
          line: d.range.start.line + 1,
          message: d.message,
          severity,
        });
      }
    }
    return results;
  } finally {
    client.close();
  }
}

function collectFiles(filePath: string): string[] {
  if (!fs.existsSync(filePath)) return [];
  const stat = fs.statSync(filePath);
  if (stat.isFile()) return [filePath];
  if (!stat.isDirectory()) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(filePath, { withFileTypes: true })) {
    const p = path.join(filePath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(p));
    } else if (entry.isFile()) {
      files.push(p);
    }
  }
  return files;
}
