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
    delete process.env.LAZYKIMICODE_PROJECT;
    delete process.env.LAZYKIMICODE_LSP_COMMAND;
    vi.restoreAllMocks();
  });

  it('derives rootUri from LAZYKIMICODE_PROJECT', async () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-root-'));
    process.env.LAZYKIMICODE_PROJECT = projectDir;
    vi.resetModules();
    const { getRootUri } = await import(modulePath);
    expect(getRootUri()).toBe(pathToFileURL(projectDir).href + '/');
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
    process.env.LAZYKIMICODE_LSP_COMMAND = 'mock-lsp';
    await handleToolRequest(
      { params: { name: 'lsp_diagnostics', arguments: { file } } },
      expectedRootUri,
      { createTransport: () => transport },
    );

    expect(capturedRootUri).toBe(expectedRootUri);

    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it('resolves relative file paths against LAZYKIMICODE_PROJECT', async () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-project-'));
    const expectedRootUri = pathToFileURL(projectDir).href + '/';
    const file = path.join(projectDir, 'src', 'x.ts');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'const x = 1;\n');
    process.env.LAZYKIMICODE_PROJECT = projectDir;

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

    const { handleToolRequest } = await import(modulePath);
    process.env.LAZYKIMICODE_LSP_COMMAND = 'mock-lsp';
    await handleToolRequest(
      { params: { name: 'lsp_diagnostics', arguments: { file: 'src/x.ts' } } },
      expectedRootUri,
      { createTransport: () => transport },
    );

    expect(capturedUri).toBe(pathToFileURL(file).href);

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
    expect(tools).toContain('lsp_symbols');
    expect(tools).toContain('lsp_install_decision');
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

  it('records and reads lsp_install_decision', async () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-decision-'));
    process.env.LAZYKIMICODE_PROJECT = projectDir;
    const { handleToolRequest } = await import(modulePath);

    const response = await handleToolRequest(
      { params: { name: 'lsp_install_decision', arguments: { server_id: 'typescript', decision: 'allowed' } } },
      pathToFileURL(projectDir).href + '/',
    );
    const text = JSON.parse(response.content[0].text);
    expect(text.serverId).toBe('typescript');
    expect(text.decision).toBe('allowed');
    expect(text.path).toBe(path.join(projectDir, '.lazykimicode', 'lsp-install-decisions.json'));

    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it('rejects invalid lsp_install_decision', async () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-decision-'));
    process.env.LAZYKIMICODE_PROJECT = projectDir;
    const { handleToolRequest } = await import(modulePath);

    const response = await handleToolRequest(
      { params: { name: 'lsp_install_decision', arguments: { server_id: 'typescript', decision: 'maybe' } } },
      pathToFileURL(projectDir).href + '/',
    );
    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('Invalid decision');

    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it('searches workspace symbols with lsp_symbols', async () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-symbols-'));
    process.env.LAZYKIMICODE_PROJECT = projectDir;
    process.env.LAZYKIMICODE_LSP_COMMAND = 'mock-lsp';
    const expectedRootUri = pathToFileURL(projectDir).href + '/';

    const transport = new MockLspTransport([
      { jsonrpc: '2.0', id: 1, result: { capabilities: {} } },
      { jsonrpc: '2.0', id: 2, result: [{ name: 'foo', kind: 12 }] },
    ]);

    const { handleToolRequest } = await import(modulePath);
    const response = await handleToolRequest(
      { params: { name: 'lsp_symbols', arguments: { file: 'src/x.ts', scope: 'workspace', query: 'foo', limit: 5 } } },
      expectedRootUri,
      { createTransport: () => transport },
    );

    const text = JSON.parse(response.content[0].text);
    expect(text.symbols).toEqual([{ name: 'foo', kind: 12 }]);

    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it('lists document symbols with lsp_symbols', async () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-symbols-'));
    const file = path.join(projectDir, 'src', 'x.ts');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'const foo = 1;\n');
    process.env.LAZYKIMICODE_PROJECT = projectDir;
    process.env.LAZYKIMICODE_LSP_COMMAND = 'mock-lsp';
    const expectedRootUri = pathToFileURL(projectDir).href + '/';

    const transport = new MockLspTransport([
      { jsonrpc: '2.0', id: 1, result: { capabilities: {} } },
      { jsonrpc: '2.0', id: 2, result: [{ name: 'foo', kind: 12 }] },
    ]);

    const { handleToolRequest } = await import(modulePath);
    const response = await handleToolRequest(
      { params: { name: 'lsp_symbols', arguments: { file: 'src/x.ts' } } },
      expectedRootUri,
      { createTransport: () => transport },
    );

    const text = JSON.parse(response.content[0].text);
    expect(text.symbols).toEqual([{ name: 'foo', kind: 12 }]);

    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it('returns error for workspace lsp_symbols without query', async () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-symbols-'));
    process.env.LAZYKIMICODE_PROJECT = projectDir;
    process.env.LAZYKIMICODE_LSP_COMMAND = 'mock-lsp';
    const expectedRootUri = pathToFileURL(projectDir).href + '/';

    const transport = new MockLspTransport([
      { jsonrpc: '2.0', id: 1, result: { capabilities: {} } },
    ]);

    const { handleToolRequest } = await import(modulePath);
    const response = await handleToolRequest(
      { params: { name: 'lsp_symbols', arguments: { file: 'src/x.ts', scope: 'workspace' } } },
      expectedRootUri,
      { createTransport: () => transport },
    );

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain("'query' is required");

    fs.rmSync(projectDir, { recursive: true, force: true });
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
