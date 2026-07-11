import fs from 'node:fs';

const MARKERS = ['TODO', 'FIXME', 'HACK', 'XXX', 'BUG'];
const MARKER_RE = new RegExp(`\\b(${MARKERS.join('|')})\\b`, 'g');

export interface CheckResult {
  hasIssue: boolean;
  matches: string[];
}

// Returns true if `index` in `line` falls inside a single- or double-quoted
// string literal on that line. This is a cheap heuristic; it does not track
// multi-line template literals or interpolated strings.
function isInsideString(line: string, index: number): boolean {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < index && i < line.length; i++) {
    const ch = line[i];
    const prev = i > 0 ? line[i - 1] : '';
    if (ch === '\\' && prev !== '\\') {
      i++; // skip escaped character
      continue;
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    }
  }
  return inSingle || inDouble;
}

function extractComments(content: string): Array<{ text: string; line: number }> {
  const comments: Array<{ text: string; line: number }> = [];
  const lines = content.split('\n');
  let inBlock = false;
  let blockStartLine = 0;
  let blockText = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (inBlock) {
      const end = line.indexOf('*/');
      if (end !== -1 && !isInsideString(line, end)) {
        blockText += '\n' + line.slice(0, end);
        comments.push({ text: blockText, line: blockStartLine + 1 });
        blockText = '';
        inBlock = false;
      } else {
        blockText += '\n' + line;
      }
      continue;
    }

    // HTML block comment start/end on same line
    const htmlMatch = line.match(/<!--(.*?)-->/);
    if (htmlMatch) {
      comments.push({ text: htmlMatch[1], line: i + 1 });
    }

    // C-style block comment start
    const start = line.indexOf('/*');
    if (start !== -1 && !isInsideString(line, start)) {
      const end = line.indexOf('*/', start + 2);
      if (end !== -1) {
        comments.push({ text: line.slice(start + 2, end), line: i + 1 });
      } else {
        inBlock = true;
        blockStartLine = i;
        blockText = line.slice(start + 2);
      }
    }

    // Line comments. Require start-of-line or whitespace before the comment
    // marker so that URLs such as https://example.com or example.com#anchor
    // are not treated as comments.
    const lineMatch = line.match(/(?:^|\s)(?:\/\/|#)(.*)/);
    if (lineMatch) {
      comments.push({ text: lineMatch[1], line: i + 1 });
    }
  }
  return comments;
}

export function findStaleMarkers(content: string): Array<{ line: number; marker: string; text: string }> {
  const results: Array<{ line: number; marker: string; text: string }> = [];
  const seen = new Set<string>();
  const comments = extractComments(content);
  for (const comment of comments) {
    const matches = [...comment.text.matchAll(MARKER_RE)];
    for (const m of matches) {
      const key = `${comment.line}:${m[1]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ line: comment.line, marker: m[1], text: comment.text.trim() });
    }
  }
  return results;
}

export function checkFile(filePath: string): CheckResult {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const markers = findStaleMarkers(content);
    return { hasIssue: markers.length > 0, matches: markers.map((m) => m.marker) };
  } catch {
    return { hasIssue: false, matches: [] };
  }
}
