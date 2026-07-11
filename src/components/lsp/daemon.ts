import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { LspClient } from './lsp-client.js';
import { StdioLspTransport, type LspTransport } from './transport.js';

const projectDir = process.env.OMO_KIMI_PROJECT ?? process.cwd();
const lspCommand = process.env.OMO_KIMI_LSP_COMMAND;
const lspArgs = process.env.OMO_KIMI_LSP_ARGS?.split(' ') ?? [];

interface LspDaemonOptions {
  command?: string;
  args?: string[];
  cwd?: string;
}

class LspDaemon {
  private options: LspDaemonOptions;
  private transport?: LspTransport;
  private client?: LspClient;
  private pendingInit?: Promise<void>;
  private lockPromise: Promise<void> = Promise.resolve();

  constructor(options: LspDaemonOptions = {}) {
    this.options = options;
  }

  isConfigured(): boolean {
    return Boolean(this.options.command);
  }

  private async acquire(): Promise<() => void> {
    const previous = this.lockPromise;
    let release: () => void;
    const next = new Promise<void>((resolve) => {
      release = () => resolve();
    });
    this.lockPromise = previous.then(() => next);
    await previous;
    return release!;
  }

  async withClient<T>(fn: (client: LspClient) => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      await this.ensureInitialized();
      if (!this.client) {
        throw new Error('LSP client is not available');
      }
      return await fn(this.client);
    } finally {
      release();
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.client) return;
    if (this.pendingInit) return this.pendingInit;

    this.pendingInit = this.doInitialize();
    try {
      await this.pendingInit;
    } finally {
      this.pendingInit = undefined;
    }
  }

  private async doInitialize(): Promise<void> {
    if (!this.options.command) return;
    this.transport = StdioLspTransport.spawn(this.options.command, this.options.args ?? [], this.options.cwd ?? projectDir);
    this.client = new LspClient(this.transport);
    await this.client.initialize(pathToFileURL(projectDir).href + '/');
  }

  close(): void {
    try {
      this.client?.shutdown().catch(() => undefined);
    } finally {
      this.transport?.close();
      this.client = undefined;
      this.transport = undefined;
    }
  }
}

function inferLanguageId(filePath: string): string {
  const ext = path.extname(filePath);
  switch (ext) {
    case '.ts': return 'typescript';
    case '.tsx': return 'typescriptreact';
    case '.js': return 'javascript';
    case '.jsx': return 'javascriptreact';
    case '.py': return 'python';
    case '.json': return 'json';
    case '.md': return 'markdown';
    default: return 'plaintext';
  }
}

function resolveUri(file: string): string {
  return pathToFileURL(path.resolve(projectDir, file)).href;
}

function readFileText(file: string): string {
  const full = path.resolve(projectDir, file);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf-8') : '';
}

export function startLspDaemon() {
  const daemon = new LspDaemon({ command: lspCommand, args: lspArgs, cwd: projectDir });

  const server = new Server({ name: 'lsp-daemon', version: '0.1.0' }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      { name: 'lsp_status', description: 'LSP daemon status', inputSchema: { type: 'object', properties: {}, required: [] } },
      { name: 'lsp_diagnostics', description: 'Get diagnostics for a file', inputSchema: { type: 'object', properties: { file: { type: 'string' } }, required: ['file'] } },
      { name: 'lsp_goto_definition', description: 'Go to definition', inputSchema: { type: 'object', properties: { file: { type: 'string' }, line: { type: 'number' }, character: { type: 'number' } }, required: ['file', 'line', 'character'] } },
      { name: 'lsp_find_references', description: 'Find references', inputSchema: { type: 'object', properties: { file: { type: 'string' }, line: { type: 'number' }, character: { type: 'number' } }, required: ['file', 'line', 'character'] } },
      { name: 'lsp_symbols', description: 'List document symbols for a file', inputSchema: { type: 'object', properties: { file: { type: 'string' } }, required: ['file'] } },
      { name: 'lsp_prepare_rename', description: 'Validate a symbol rename is possible', inputSchema: { type: 'object', properties: { file: { type: 'string' }, line: { type: 'number' }, character: { type: 'number' } }, required: ['file', 'line', 'character'] } },
      { name: 'lsp_rename', description: 'Execute a symbol rename', inputSchema: { type: 'object', properties: { file: { type: 'string' }, line: { type: 'number' }, character: { type: 'number' }, newName: { type: 'string' } }, required: ['file', 'line', 'character', 'newName'] } },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    try {
      switch (req.params.name) {
        case 'lsp_status': {
          const status = daemon.isConfigured() ? 'ready' : 'no LSP configured';
          return { content: [{ type: 'text', text: status }] };
        }
        case 'lsp_diagnostics': {
          if (!daemon.isConfigured()) {
            return { content: [{ type: 'text', text: JSON.stringify({ diagnostics: [] }) }] };
          }
          const file = (req.params.arguments as { file: string }).file;
          const uri = resolveUri(file);
          const text = readFileText(file);
          const diagnostics = await daemon.withClient(async (client) => {
            client.openDocument(uri, inferLanguageId(file), text);
            client.didChange(uri, text);
            return client.requestDiagnostics(uri);
          });
          return { content: [{ type: 'text', text: JSON.stringify({ diagnostics }) }] };
        }
        case 'lsp_goto_definition':
        case 'lsp_find_references': {
          if (!daemon.isConfigured()) {
            return { content: [{ type: 'text', text: JSON.stringify({ locations: [] }) }] };
          }
          const args = req.params.arguments as { file: string; line: number; character: number };
          const uri = resolveUri(args.file);
          const text = readFileText(args.file);
          const locations = await daemon.withClient(async (client) => {
            client.openDocument(uri, inferLanguageId(args.file), text);
            const pos = { line: args.line, character: args.character };
            return req.params.name === 'lsp_goto_definition'
              ? client.gotoDefinition(uri, pos)
              : client.findReferences(uri, pos);
          });
          return { content: [{ type: 'text', text: JSON.stringify({ locations }) }] };
        }
        case 'lsp_symbols': {
          if (!daemon.isConfigured()) {
            return { content: [{ type: 'text', text: JSON.stringify({ symbols: [] }) }] };
          }
          const file = (req.params.arguments as { file: string }).file;
          const uri = resolveUri(file);
          const text = readFileText(file);
          const symbols = await daemon.withClient(async (client) => {
            client.openDocument(uri, inferLanguageId(file), text);
            return client.documentSymbol(uri);
          });
          return { content: [{ type: 'text', text: JSON.stringify({ symbols }) }] };
        }
        case 'lsp_prepare_rename':
        case 'lsp_rename': {
          if (!daemon.isConfigured()) {
            return { content: [{ type: 'text', text: JSON.stringify({ result: null }) }] };
          }
          const args = req.params.arguments as { file: string; line: number; character: number; newName?: string };
          const uri = resolveUri(args.file);
          const text = readFileText(args.file);
          const result = await daemon.withClient(async (client) => {
            client.openDocument(uri, inferLanguageId(args.file), text);
            const pos = { line: args.line, character: args.character };
            return req.params.name === 'lsp_prepare_rename'
              ? client.prepareRename(uri, pos)
              : client.rename(uri, pos, args.newName ?? '');
          });
          return { content: [{ type: 'text', text: JSON.stringify({ result }) }] };
        }
        default:
          return { content: [{ type: 'text', text: 'unknown tool' }], isError: true };
      }
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: (err as Error).message }) }], isError: true };
    }
  });

  const transport = new StdioServerTransport();
  server.connect(transport);

  process.on('SIGINT', () => daemon.close());
  process.on('SIGTERM', () => daemon.close());
}

startLspDaemon();
