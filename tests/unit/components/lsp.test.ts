import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { readCache, writeCache, runDiagnostics } from '../../../src/components/lsp/diagnostics.js';
import { MockLspTransport } from '../../../src/components/lsp/transport.js';

describe('lsp diagnostics', () => {
  let tmp: string;
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-')); });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.LAZYKIMICODE_PROJECT;
    vi.restoreAllMocks();
  });

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

  it('initializes with rootUri from LAZYKIMICODE_PROJECT', async () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-project-'));
    process.env.LAZYKIMICODE_PROJECT = projectDir;
    const file = path.join(projectDir, 'x.ts');
    fs.writeFileSync(file, 'const x = 1;\n');

    let capturedRootUri: string | undefined;
    const transport = new MockLspTransport([
      { jsonrpc: '2.0', id: 1, result: { capabilities: {} } },
    ]);
    transport.onSend((msg) => {
      if (msg.method === 'initialize') {
        capturedRootUri = (msg.params as { rootUri: string }).rootUri;
      }
      if (msg.method === 'textDocument/didOpen' || msg.method === 'textDocument/didChange') {
        return {
          jsonrpc: '2.0',
          method: 'textDocument/publishDiagnostics',
          params: { uri: pathToFileURL(file).href, diagnostics: [] },
        };
      }
      return undefined;
    });

    await runDiagnostics(file, transport);
    expect(capturedRootUri).toBe(pathToFileURL(projectDir).href + '/');

    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it('prefers explicit rootUri over LAZYKIMICODE_PROJECT', async () => {
    const envProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-env-'));
    const explicitProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-explicit-'));
    process.env.LAZYKIMICODE_PROJECT = envProjectDir;
    const file = path.join(explicitProjectDir, 'x.ts');
    fs.writeFileSync(file, 'const x = 1;\n');

    let capturedRootUri: string | undefined;
    const transport = new MockLspTransport([
      { jsonrpc: '2.0', id: 1, result: { capabilities: {} } },
    ]);
    transport.onSend((msg) => {
      if (msg.method === 'initialize') {
        capturedRootUri = (msg.params as { rootUri: string }).rootUri;
      }
      if (msg.method === 'textDocument/didOpen' || msg.method === 'textDocument/didChange') {
        return {
          jsonrpc: '2.0',
          method: 'textDocument/publishDiagnostics',
          params: { uri: pathToFileURL(file).href, diagnostics: [] },
        };
      }
      return undefined;
    });

    await runDiagnostics(file, transport, pathToFileURL(explicitProjectDir).href + '/');
    expect(capturedRootUri).toBe(pathToFileURL(explicitProjectDir).href + '/');

    fs.rmSync(envProjectDir, { recursive: true, force: true });
    fs.rmSync(explicitProjectDir, { recursive: true, force: true });
  });

  it('resolves relative file paths against LAZYKIMICODE_PROJECT', async () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-rel-'));
    process.env.LAZYKIMICODE_PROJECT = projectDir;
    const file = path.join(projectDir, 'src', 'x.ts');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'const x = 1;\n');

    let capturedUri: string | undefined;
    const transport = new MockLspTransport([
      { jsonrpc: '2.0', id: 1, result: { capabilities: {} } },
    ]);
    transport.onSend((msg) => {
      if (msg.method === 'textDocument/didOpen') {
        capturedUri = (msg.params as { textDocument: { uri: string } }).textDocument.uri;
      }
      if (msg.method === 'textDocument/didOpen' || msg.method === 'textDocument/didChange') {
        return {
          jsonrpc: '2.0',
          method: 'textDocument/publishDiagnostics',
          params: { uri: pathToFileURL(file).href, diagnostics: [] },
        };
      }
      return undefined;
    });

    await runDiagnostics('src/x.ts', transport);
    expect(capturedUri).toBe(pathToFileURL(file).href);

    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it('filters diagnostics by severity', async () => {
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
              { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, severity: 1, message: 'error' },
              { range: { start: { line: 0, character: 2 }, end: { line: 0, character: 3 } }, severity: 2, message: 'warning' },
              { range: { start: { line: 0, character: 4 }, end: { line: 0, character: 5 } }, severity: 3, message: 'info' },
            ],
          },
        };
      }
      return undefined;
    });

    const errors = await runDiagnostics(file, transport, undefined, 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe('error');

    const warnings = await runDiagnostics(file, transport, undefined, 'warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].severity).toBe('warning');
  });

  it('recursively collects diagnostics from a directory', async () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-dir-'));
    process.env.LAZYKIMICODE_PROJECT = projectDir;
    const srcDir = path.join(projectDir, 'src');
    const fileA = path.join(srcDir, 'a.ts');
    const fileB = path.join(srcDir, 'b.ts');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(fileA, 'const a = 1;\n');
    fs.writeFileSync(fileB, 'const b = 1;\n');

    const transport = new MockLspTransport([
      { jsonrpc: '2.0', id: 1, result: { capabilities: {} } },
    ]);
    const openedUris: string[] = [];
    transport.onSend((msg) => {
      if (msg.method === 'textDocument/didOpen') {
        openedUris.push((msg.params as { textDocument: { uri: string } }).textDocument.uri);
      }
      if (msg.method === 'textDocument/didOpen' || msg.method === 'textDocument/didChange') {
        const uri = (msg.params as { textDocument: { uri: string } }).textDocument.uri;
        return {
          jsonrpc: '2.0',
          method: 'textDocument/publishDiagnostics',
          params: { uri, diagnostics: [] },
        };
      }
      return undefined;
    });

    await runDiagnostics('src', transport);
    expect(openedUris).toHaveLength(2);
    expect(openedUris).toContain(pathToFileURL(fileA).href);
    expect(openedUris).toContain(pathToFileURL(fileB).href);

    fs.rmSync(projectDir, { recursive: true, force: true });
  });
});
