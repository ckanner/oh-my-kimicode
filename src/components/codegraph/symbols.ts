// Lightweight heuristic parser. Does not handle macros, complex generics,
// dynamic imports, or every language edge case. Good enough for structural
// search; for deeper analysis use the LSP component.

export interface Symbol {
  name: string;
  kind: 'function' | 'method' | 'class' | 'variable' | 'type' | 'enum' | 'trait' | 'module';
  file: string;
  line: number;
  column: number;
}

export interface CodeGraphIndex {
  version: string;
  symbols: Symbol[];
  byFile: Record<string, Symbol[]>;
}

interface ParserPattern {
  regex: RegExp;
  kind: Symbol['kind'];
}

const PARSERS: Record<string, ParserPattern[]> = {
  '.ts': [
    { regex: /(?:export\s+)?(?:async\s+)?function\s+(?<name>\w+)/dg, kind: 'function' },
    { regex: /(?:export\s+)?class\s+(?<name>\w+)/dg, kind: 'class' },
    { regex: /(?:export\s+)?(?:const|let|var)\s+(?<name>\w+)/dg, kind: 'variable' },
    { regex: /(?:export\s+)?interface\s+(?<name>\w+)/dg, kind: 'type' },
    { regex: /(?:export\s+)?type\s+(?<name>\w+)/dg, kind: 'type' },
    { regex: /\b(?<name>\w+)\s*\([^)]*\)\s*\{/dg, kind: 'method' },
    { regex: /\b(?:const|let|var)\s+(?<name>\w+)\s*=\s*[^=]*=>/dg, kind: 'function' },
  ],
  '.js': [
    { regex: /(?:export\s+)?(?:async\s+)?function\s+(?<name>\w+)/dg, kind: 'function' },
    { regex: /(?:export\s+)?class\s+(?<name>\w+)/dg, kind: 'class' },
    { regex: /(?:export\s+)?(?:const|let|var)\s+(?<name>\w+)/dg, kind: 'variable' },
    { regex: /\b(?<name>\w+)\s*\([^)]*\)\s*\{/dg, kind: 'method' },
    { regex: /\b(?:const|let|var)\s+(?<name>\w+)\s*=\s*[^=]*=>/dg, kind: 'function' },
  ],
  '.py': [
    { regex: /def\s+(?<name>\w+)/dg, kind: 'function' },
    { regex: /class\s+(?<name>\w+)/dg, kind: 'class' },
  ],
  '.go': [
    { regex: /func\s+(?:\(.*\)\s+)?(?<name>\w+)/dg, kind: 'function' },
    { regex: /type\s+(?<name>\w+)/dg, kind: 'class' },
    { regex: /\bfunc\s+\([^)]+\)\s+(?<name>\w+)\s*\(/dg, kind: 'function' },
  ],
  '.rs': [
    { regex: /fn\s+(?<name>\w+)/dg, kind: 'function' },
    { regex: /struct\s+(?<name>\w+)/dg, kind: 'class' },
    { regex: /\bimpl(?:\s+(?:<[^>]+>\s*)?(?<name>\w+))?/dg, kind: 'function' },
    { regex: /\benum\s+(?<name>\w+)/dg, kind: 'enum' },
    { regex: /\btrait\s+(?<name>\w+)/dg, kind: 'trait' },
    { regex: /\bmod\s+(?<name>\w+)/dg, kind: 'module' },
  ],
};

// Reserved words that should not be treated as method names by the generic
// "word(args) {" heuristic.
const RESERVED_METHOD_NAMES = new Set(['if', 'while', 'for', 'switch', 'catch', 'with', 'using']);

// When two patterns match the same symbol position, prefer the richer kind.
const KIND_PRIORITY: Record<Symbol['kind'], number> = {
  function: 0,
  method: 1,
  class: 2,
  type: 3,
  enum: 4,
  trait: 5,
  module: 6,
  variable: 7,
};

export function inferLanguageId(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf('.'));
  return ext;
}

export function parseFile(filePath: string, content: string): Symbol[] {
  const ext = inferLanguageId(filePath);
  const patterns = PARSERS[ext];
  if (!patterns) return [];

  const raw: Symbol[] = [];

  for (const { regex, kind } of patterns) {
    // Reset lastIndex for global regex
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const name = match.groups?.name;
      if (!name) continue;
      if (kind === 'method' && RESERVED_METHOD_NAMES.has(name)) continue;
      const index = match.indices?.groups?.name?.[0] ?? match.index;
      const line = content.slice(0, index).split('\n').length;
      const column = index - content.lastIndexOf('\n', index - 1);
      raw.push({ name, kind, file: filePath, line, column });
    }
  }

  // Deduplicate overlapping matches at the same position, keeping the kind with
  // the highest priority (e.g. an arrow function over a bare const declaration).
  const seen = new Map<string, Symbol>();
  for (const symbol of raw) {
    const key = `${symbol.line}:${symbol.column}:${symbol.name}`;
    const existing = seen.get(key);
    if (!existing || KIND_PRIORITY[symbol.kind] < KIND_PRIORITY[existing.kind]) {
      seen.set(key, symbol);
    }
  }

  return Array.from(seen.values());
}
