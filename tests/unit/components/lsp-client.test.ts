import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { LspClient } from '../../../src/components/lsp/lsp-client.js';
import { MockLspTransport } from '../../../src/components/lsp/transport.js';

describe('LspClient', () => {
  let tmp: string;
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-client-')); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('requests goto definition', async () => {
    const transport = new MockLspTransport([
      { jsonrpc: '2.0', id: 1, result: { capabilities: {} } },
      {
        jsonrpc: '2.0',
        id: 2,
        result: [{ uri: 'file:///tmp/test.ts', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } } }],
      },
    ]);
    const client = new LspClient(transport);
    await client.initialize('file:///tmp/');
    const result = await client.gotoDefinition('file:///tmp/test.ts', { line: 1, character: 4 });
    expect(result).toEqual([
      { uri: 'file:///tmp/test.ts', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } } },
    ]);
    client.close();
  });

  it('requests find references', async () => {
    const transport = new MockLspTransport([
      { jsonrpc: '2.0', id: 1, result: { capabilities: {} } },
      {
        jsonrpc: '2.0',
        id: 2,
        result: [{ uri: 'file:///tmp/test.ts', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } } }],
      },
    ]);
    const client = new LspClient(transport);
    await client.initialize('file:///tmp/');
    const result = await client.findReferences('file:///tmp/test.ts', { line: 1, character: 4 });
    expect(result).toEqual([
      { uri: 'file:///tmp/test.ts', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } } },
    ]);
    client.close();
  });

  it('passes includeDeclaration to find references', async () => {
    const transport = new MockLspTransport([
      { jsonrpc: '2.0', id: 1, result: { capabilities: {} } },
      {
        jsonrpc: '2.0',
        id: 2,
        result: [{ uri: 'file:///tmp/test.ts', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } } }],
      },
    ]);
    let capturedIncludeDeclaration: boolean | undefined;
    transport.onSend((msg) => {
      if (msg.method === 'textDocument/references') {
        capturedIncludeDeclaration = (msg.params as { context: { includeDeclaration: boolean } }).context.includeDeclaration;
      }
      return undefined;
    });

    const client = new LspClient(transport);
    await client.initialize('file:///tmp/');
    await client.findReferences('file:///tmp/test.ts', { line: 1, character: 4 }, false);
    expect(capturedIncludeDeclaration).toBe(false);
    client.close();
  });

  it('initializes and receives diagnostics', async () => {
    const transport = new MockLspTransport([
      { jsonrpc: '2.0', id: 1, result: { capabilities: {} } },
    ]);

    let sentDiagnostics = false;
    transport.onSend((msg) => {
      if (msg.method === 'textDocument/didOpen' || msg.method === 'textDocument/didChange') {
        if (sentDiagnostics) return undefined;
        sentDiagnostics = true;
        return {
          jsonrpc: '2.0',
          method: 'textDocument/publishDiagnostics',
          params: {
            uri: 'file:///tmp/test.ts',
            diagnostics: [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, severity: 1, message: 'err' }],
          },
        };
      }
      return undefined;
    });

    const client = new LspClient(transport);
    await client.initialize('file:///tmp/');
    client.openDocument('file:///tmp/test.ts', 'typescript', 'const x = 1;');
    const diagnostics = await client.requestDiagnostics('file:///tmp/test.ts');
    expect(diagnostics).toHaveLength(1);
    client.close();
  });

  it('requests document symbols', async () => {
    const transport = new MockLspTransport([
      { jsonrpc: '2.0', id: 1, result: { capabilities: {} } },
      { jsonrpc: '2.0', id: 2, result: [{ name: 'foo', kind: 12 }] },
    ]);
    const client = new LspClient(transport);
    await client.initialize('file:///tmp/');
    const result = await client.documentSymbol('file:///tmp/test.ts');
    expect(result).toEqual([{ name: 'foo', kind: 12 }]);
    client.close();
  });

  it('requests workspace symbols', async () => {
    const transport = new MockLspTransport([
      { jsonrpc: '2.0', id: 1, result: { capabilities: {} } },
      { jsonrpc: '2.0', id: 2, result: [{ name: 'foo', kind: 12, location: { uri: 'file:///tmp/test.ts', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } } } }] },
    ]);
    const client = new LspClient(transport);
    await client.initialize('file:///tmp/');
    const result = await client.workspaceSymbol('foo');
    expect(result).toEqual([{ name: 'foo', kind: 12, location: { uri: 'file:///tmp/test.ts', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } } } }]);
    client.close();
  });

  it('sends current file content in didChange notification', async () => {
    const file = path.join(tmp, 'test.ts');
    const content = 'const foo = 1;\n';
    fs.writeFileSync(file, content);

    const transport = new MockLspTransport([
      { jsonrpc: '2.0', id: 1, result: { capabilities: {} } },
    ]);
    let didChangeText: string | undefined;
    transport.onSend((msg) => {
      if (msg.method === 'textDocument/didChange') {
        didChangeText = (msg.params as { contentChanges: Array<{ text: string }> }).contentChanges[0].text;
      }
      return undefined;
    });

    const client = new LspClient(transport);
    await client.initialize('file:///tmp/');
    client.requestDiagnostics(pathToFileURL(file).href);
    // Flush the synchronous send through the mock transport.
    await new Promise((resolve) => setImmediate(resolve));
    expect(didChangeText).toBe(content);
    client.close();
  });
});
