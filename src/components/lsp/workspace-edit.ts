import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface TextEdit {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  newText: string;
}

export interface WorkspaceEdit {
  changes?: Record<string, TextEdit[]>;
  documentChanges?: Array<{
    textDocument: { uri: string; version: number };
    edits: TextEdit[];
  }>;
}

function applyTextEdits(content: string, edits: TextEdit[]): string {
  const lines = content.split('\n');
  // Apply edits in reverse order to preserve positions.
  const sorted = [...edits].sort((a, b) => {
    const lineDiff = b.range.start.line - a.range.start.line;
    if (lineDiff !== 0) return lineDiff;
    return b.range.start.character - a.range.start.character;
  });

  for (const edit of sorted) {
    const { start, end } = edit.range;
    const startLine = lines[start.line] ?? '';
    const endLine = lines[end.line] ?? '';
    const before = startLine.slice(0, start.character);
    const after = endLine.slice(end.character);
    const newLines = edit.newText.split('\n');
    if (newLines.length === 1) {
      lines[start.line] = before + newLines[0] + after;
      if (end.line !== start.line) {
        lines.splice(start.line + 1, end.line - start.line);
      }
    } else {
      const first = before + newLines[0];
      const last = newLines[newLines.length - 1] + after;
      const middle = newLines.slice(1, -1);
      lines.splice(start.line, end.line - start.line + 1, first, ...middle, last);
    }
  }
  return lines.join('\n');
}

export function applyWorkspaceEdit(edit: WorkspaceEdit): { applied: number; errors: string[] } {
  const errors: string[] = [];
  let applied = 0;

  if (edit.changes) {
    for (const [uri, edits] of Object.entries(edit.changes)) {
      try {
        const filePath = fileURLToPath(uri);
        const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
        const newContent = applyTextEdits(content, edits);
        fs.writeFileSync(filePath, newContent, 'utf-8');
        applied++;
      } catch (err) {
        errors.push(`${uri}: ${(err as Error).message}`);
      }
    }
  }

  if (edit.documentChanges) {
    for (const change of edit.documentChanges) {
      try {
        const filePath = fileURLToPath(change.textDocument.uri);
        const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
        const newContent = applyTextEdits(content, change.edits);
        fs.writeFileSync(filePath, newContent, 'utf-8');
        applied++;
      } catch (err) {
        errors.push(`${change.textDocument.uri}: ${(err as Error).message}`);
      }
    }
  }

  return { applied, errors };
}
