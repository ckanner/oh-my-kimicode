import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { MockLspTransport } from '../../../src/components/lsp/transport.js';

const modulePath = '../../../src/components/lsp/mcp-server.js';
const SERVER = path.resolve('plugin/components/lsp/dist/mcp-server.mjs');

describe('lsp mcp-server', () => {
  let tmp: string;
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-mcp-')); });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.OMO_KIMI_PROJECT;
    delete process.env.OMO_KIMI_LSP_COMMAND;
    vi.restoreAllMocks();
  });

  it('derives rootUri from OMO_KIMI_PROJECT', async () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-root-'));
    process.env.OMO_KIMI_PROJECT = projectDir;
    vi.resetModules();
    const { rootUri } = await import(modulePath);
    expect(rootUri).toBe(pathToFileURL(projectDir).href + '/');
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it('initializes LSP client with rootUri in tool handler', async () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-root-'));
    const expectedRootUri = pathToFileURL(projectDir).href + '/';
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

    const { handleToolRequest } = await import(modulePath);
    process.env.OMO_KIMI_LSP_COMMAND = 'mock-lsp';
    await handleToolRequest(
      { params: { name: 'lsp_diagnostics', arguments: { file } } },
      expectedRootUri,
      { createTransport: () => transport },
    );

    expect(capturedRootUri).toBe(expectedRootUri);

    fs.rmSync(projectDir, { recursive: true, force: true });
  });
});

describe('lsp mcp-server entry', () => {
  it('lists all lsp tools', () => {
    const result = spawnSync('node', [SERVER], {
      input: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) + '\n',
      encoding: 'utf-8',
    });
    expect(result.status).toBe(0);
    const tools = JSON.parse(result.stdout).result.tools.map((t: { name: string }) => t.name);
    expect(tools).toContain('lsp_status');
    expect(tools).toContain('lsp_diagnostics');
    expect(tools).toContain('lsp_goto_definition');
  });

  it('returns no LSP configured for lsp_status', () => {
    const result = spawnSync('node', [SERVER], {
      input: JSON.stringify({
        jsonrpc: '2.0', id: 2, method: 'tools/call',
        params: { name: 'lsp_status', arguments: {} },
      }) + '\n',
      encoding: 'utf-8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('no LSP configured');
  });

  it('returns empty diagnostics for lsp_diagnostics', () => {
    const result = spawnSync('node', [SERVER], {
      input: JSON.stringify({
        jsonrpc: '2.0', id: 3, method: 'tools/call',
        params: { name: 'lsp_diagnostics', arguments: { file: 'src/components/lsp/mcp-server.ts' } },
      }) + '\n',
      encoding: 'utf-8',
    });
    expect(result.status).toBe(0);
    const response = JSON.parse(result.stdout);
    expect(response.result.content[0].text).toContain('"diagnostics":[]');
  });

  it('returns error for unknown tool', () => {
    const result = spawnSync('node', [SERVER], {
      input: JSON.stringify({
        jsonrpc: '2.0', id: 4, method: 'tools/call',
        params: { name: 'unknown', arguments: {} },
      }) + '\n',
      encoding: 'utf-8',
    });
    expect(result.status).toBe(0);
    const response = JSON.parse(result.stdout);
    expect(response.result.isError).toBe(true);
  });
});
