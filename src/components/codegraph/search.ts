import type { CodeGraphIndex, Symbol } from './symbols.js';

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
