import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { readCache, writeCache, runDiagnostics } from '../../../src/components/lsp/diagnostics.js';
import { MockLspTransport } from '../../../src/components/lsp/transport.js';

describe('lsp diagnostics', () => {
  let tmp: string;
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-')); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('reads and writes cache', () => {
    expect(readCache(tmp)).toEqual([]);
    writeCache(tmp, ['a.ts', 'b.ts']);
    expect(readCache(tmp)).toEqual(['a.ts', 'b.ts']);
  });

  it('returns empty diagnostics when no transport', async () => {
    const file = path.join(tmp, 'x.ts');
    fs.writeFileSync(file, 'const x = 1;\n');
    const diagnostics = await runDiagnostics(file);
    expect(diagnostics).toEqual([]);
  });

  it('parses diagnostics from mock transport', async () => {
    const file = path.join(tmp, 'x.ts');
    fs.writeFileSync(file, 'const x: string = 1;\n');

    const transport = new MockLspTransport([
      { jsonrpc: '2.0', id: 1, result: { capabilities: {} } },
    ]);
    transport.onSend((msg) => {
      if (msg.method === 'textDocument/didOpen' || msg.method === 'textDocument/didChange') {
        return {
          jsonrpc: '2.0',
          method: 'textDocument/publishDiagnostics',
          params: {
            uri: pathToFileURL(file).href,
            diagnostics: [
              {
                range: { start: { line: 0, character: 6 }, end: { line: 0, character: 7 } },
                severity: 1,
                message: 'Type mismatch',
              },
            ],
          },
        };
      }
      return undefined;
    });

    const diagnostics = await runDiagnostics(file, transport);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].line).toBe(1);
    expect(diagnostics[0].severity).toBe('error');
    expect(diagnostics[0].message).toBe('Type mismatch');
  });
});
