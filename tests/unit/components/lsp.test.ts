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
    delete process.env.OMO_KIMI_PROJECT;
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

  it('initializes with rootUri from OMO_KIMI_PROJECT', async () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-project-'));
    process.env.OMO_KIMI_PROJECT = projectDir;
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

  it('prefers explicit rootUri over OMO_KIMI_PROJECT', async () => {
    const envProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-env-'));
    const explicitProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-explicit-'));
    process.env.OMO_KIMI_PROJECT = envProjectDir;
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
});
