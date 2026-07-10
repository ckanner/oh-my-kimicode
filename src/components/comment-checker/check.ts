import fs from 'node:fs';

const COMMENT_PATTERN = /(?:\/\/.*|\/\*[\s\S]*?\*\/|#.*)\b(TODO|FIXME|HACK|XXX|BUG)\b/gi;

export interface CheckResult {
  hasIssue: boolean;
  matches: string[];
}

export function checkFile(filePath: string): CheckResult {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const matches = content.match(COMMENT_PATTERN) ?? [];
    return { hasIssue: matches.length > 0, matches };
  } catch {
    return { hasIssue: false, matches: [] };
  }
}
