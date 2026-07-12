import fs from 'node:fs';
import path from 'node:path';
import type { CodeGraphIndex, Symbol } from './symbols.js';
import { parseFile } from './symbols.js';

const SUPPORTED_EXTS = new Set(['.ts', '.js', '.py', '.go', '.rs']);

export function listProjectFiles(projectDir: string): string[] {
  const files: string[] = [];

  function walk(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'plugin') continue;
        walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (SUPPORTED_EXTS.has(ext)) files.push(full);
      }
    }
  }

  walk(projectDir);
  return files.map((f) => path.relative(projectDir, f));
}

export function buildIndex(projectDir: string): CodeGraphIndex {
  const files = listProjectFiles(projectDir);
  const allSymbols: Symbol[] = [];
  const byFile: Record<string, Symbol[]> = {};

  for (const rel of files) {
    const full = path.join(projectDir, rel);
    try {
      const content = fs.readFileSync(full, 'utf-8');
      const symbols = parseFile(rel, content);
      if (symbols.length) {
        allSymbols.push(...symbols);
        byFile[rel] = symbols;
      }
    } catch {
      // Skip files that cannot be read or parsed; keep indexing the rest.
    }
  }

  return { version: '1', symbols: allSymbols, byFile };
}

export function indexPath(projectDir: string): string {
  return path.join(projectDir, '.lazykimicode', 'codegraph-index.json');
}

export function loadIndex(projectDir: string): CodeGraphIndex | null {
  const p = indexPath(projectDir);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as CodeGraphIndex;
}

export function saveIndex(projectDir: string, index: CodeGraphIndex): void {
  const p = indexPath(projectDir);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(index, null, 2));
}
