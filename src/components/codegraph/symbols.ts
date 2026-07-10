export interface Symbol {
  name: string;
  kind: 'function' | 'class' | 'variable' | 'type' | 'method';
  file: string;
  line: number;
  column: number;
}

export interface CodeGraphIndex {
  version: string;
  symbols: Symbol[];
  byFile: Record<string, Symbol[]>;
}

const PARSERS: Record<string, RegExp[]> = {
  '.ts': [
    /(?:export\s+)?(?:async\s+)?function\s+(?<name>\w+)/dg,
    /(?:export\s+)?class\s+(?<name>\w+)/dg,
    /(?:export\s+)?(?:const|let|var)\s+(?<name>\w+)/dg,
    /(?:export\s+)?interface\s+(?<name>\w+)/dg,
    /(?:export\s+)?type\s+(?<name>\w+)/dg,
  ],
  '.js': [
    /(?:export\s+)?(?:async\s+)?function\s+(?<name>\w+)/dg,
    /(?:export\s+)?class\s+(?<name>\w+)/dg,
    /(?:export\s+)?(?:const|let|var)\s+(?<name>\w+)/dg,
  ],
  '.py': [
    /def\s+(?<name>\w+)/dg,
    /class\s+(?<name>\w+)/dg,
  ],
  '.go': [
    /func\s+(?:\(.*\)\s+)?(?<name>\w+)/dg,
    /type\s+(?<name>\w+)/dg,
  ],
  '.rs': [
    /fn\s+(?<name>\w+)/dg,
    /struct\s+(?<name>\w+)/dg,
    /impl\s+(?:<.*?>\s+)?(?<name>\w+)/dg,
  ],
};

export function inferLanguageId(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf('.'));
  return ext;
}

export function parseFile(filePath: string, content: string): Symbol[] {
  const ext = inferLanguageId(filePath);
  const patterns = PARSERS[ext];
  if (!patterns) return [];

  const symbols: Symbol[] = [];
  const lines = content.split('\n');

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      const name = match.groups?.name;
      if (!name) continue;
      const index = match.indices?.groups?.name?.[0] ?? match.index;
      const line = content.slice(0, index).split('\n').length;
      const column = index - content.lastIndexOf('\n', index - 1);
      let kind: Symbol['kind'] = 'function';
      if (pattern.source.includes('class')) kind = 'class';
      else if (pattern.source.includes('struct')) kind = 'class';
      else if (pattern.source.includes('interface')) kind = 'type';
      else if (pattern.source.includes('type') && !pattern.source.includes('def')) kind = 'type';
      else if (pattern.source.includes('const') || pattern.source.includes('let') || pattern.source.includes('var')) kind = 'variable';
      symbols.push({ name, kind, file: filePath, line, column });
    }
  }

  return symbols;
}
