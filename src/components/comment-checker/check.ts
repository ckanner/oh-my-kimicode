import fs from 'node:fs';

const MARKERS = ['TODO', 'FIXME', 'HACK', 'XXX', 'BUG'];
const MARKER_RE = new RegExp(`\\b(${MARKERS.join('|')})\\b`, 'g');

export interface CheckResult {
  hasIssue: boolean;
  matches: string[];
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
      if (end !== -1) {
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
    if (start !== -1) {
      const end = line.indexOf('*/', start + 2);
      if (end !== -1) {
        comments.push({ text: line.slice(start + 2, end), line: i + 1 });
      } else {
        inBlock = true;
        blockStartLine = i;
        blockText = line.slice(start + 2);
      }
    }

    // Line comments
    const lineMatch = line.match(/(?:\/\/|#)(.*)/);
    if (lineMatch) {
      comments.push({ text: lineMatch[1], line: i + 1 });
    }
  }
  return comments;
}

export function findStaleMarkers(content: string): Array<{ line: number; marker: string; text: string }> {
  const results: Array<{ line: number; marker: string; text: string }> = [];
  const comments = extractComments(content);
  for (const comment of comments) {
    const matches = [...comment.text.matchAll(MARKER_RE)];
    for (const m of matches) {
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
