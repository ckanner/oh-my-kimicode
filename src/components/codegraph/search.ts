import fs from 'node:fs';
import path from 'node:path';
import type { CodeGraphIndex, Symbol } from './symbols.js';
import { listProjectFiles } from './indexer.js';

export interface SearchQuery {
  query?: string;
  kind?: Symbol['kind'];
  file?: string;
}

export function search(index: CodeGraphIndex, q: SearchQuery): Symbol[] {
  let results = index.symbols;
  if (q.query) {
    const lower = q.query.toLowerCase();
    results = results.filter((s) => s.name.toLowerCase().includes(lower));
  }
  if (q.kind) {
    results = results.filter((s) => s.kind === q.kind);
  }
  if (q.file) {
    results = results.filter((s) => s.file === q.file);
  }
  return results;
}

export function relate(index: CodeGraphIndex, symbol: string): Symbol[] {
  const targets = search(index, { query: symbol });
  if (!targets.length) return [];
  const files = new Set(targets.map((t) => t.file));
  return index.symbols.filter((s) => files.has(s.file));
}

export interface ExploreResult {
  symbol: Symbol;
  neighbors: Symbol[];
}

export function explore(index: CodeGraphIndex, q: SearchQuery & { limit?: number }): ExploreResult[] {
  const results = search(index, q).slice(0, q.limit ?? 20);
  return results.map((s) => ({
    symbol: s,
    neighbors: relate(index, s.name).filter((n) => n.name !== s.name),
  }));
}

export function files(index: CodeGraphIndex, query?: string): string[] {
  const symbols = query ? search(index, { query }) : index.symbols;
  return [...new Set(symbols.map((s) => s.file))].sort();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface CallerInfo {
  file: string;
  matchCount: number;
  symbols: Symbol[];
}

export function callers(index: CodeGraphIndex, projectDir: string, symbolName: string): CallerInfo[] {
  const targets = search(index, { query: symbolName });
  if (!targets.length) return [];
  const word = escapeRegex(symbolName);
  const re = new RegExp(`\\b${word}\\b`, 'g');
  const infos: CallerInfo[] = [];
  for (const rel of listProjectFiles(projectDir)) {
    const full = path.join(projectDir, rel);
    const content = fs.readFileSync(full, 'utf-8');
    const matches = content.match(re);
    if (!matches) continue;
    infos.push({
      file: rel,
      matchCount: matches.length,
      symbols: index.byFile[rel] ?? [],
    });
  }
  return infos.sort((a, b) => b.matchCount - a.matchCount);
}

export function callees(index: CodeGraphIndex, projectDir: string, symbolName: string): Symbol[] {
  const targets = search(index, { query: symbolName });
  if (!targets.length) return [];
  const targetFiles = new Set(targets.map((t) => t.file));
  const candidateSymbols = index.symbols.filter((s) => targetFiles.has(s.file) && s.name !== symbolName);
  const called = new Map<string, Symbol>();
  for (const rel of targetFiles) {
    const full = path.join(projectDir, rel);
    const content = fs.readFileSync(full, 'utf-8');
    for (const s of candidateSymbols) {
      if (s.file !== rel) continue;
      const word = escapeRegex(s.name);
      const re = new RegExp(`\\b${word}\\b`, 'g');
      if (re.test(content)) {
        called.set(`${s.file}:${s.name}`, s);
      }
    }
  }
  return [...called.values()];
}

export function impact(index: CodeGraphIndex, projectDir: string, symbolName: string): string[] {
  const affected = new Set<string>();
  for (const t of search(index, { query: symbolName })) {
    affected.add(t.file);
  }
  for (const c of callers(index, projectDir, symbolName)) {
    affected.add(c.file);
  }
  return [...affected].sort();
}
