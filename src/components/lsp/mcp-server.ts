import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runDiagnostics, createTransport } from './diagnostics.js';
import { LspClient } from './lsp-client.js';

export function startLspServer() {
  const server = new Server({ name: 'lsp', version: '0.1.0' }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      { name: 'lsp_status', description: 'LSP server status', inputSchema: { type: 'object', properties: {}, required: [] } },
      { name: 'lsp_diagnostics', description: 'Get diagnostics for a file', inputSchema: { type: 'object', properties: { file: { type: 'string' } }, required: ['file'] } },
      { name: 'lsp_goto_definition', description: 'Go to definition', inputSchema: { type: 'object', properties: { file: { type: 'string' }, line: { type: 'number' }, character: { type: 'number' } }, required: ['file', 'line', 'character'] } },
      { name: 'lsp_find_references', description: 'Find references', inputSchema: { type: 'object', properties: { file: { type: 'string' }, line: { type: 'number' }, character: { type: 'number' } }, required: ['file', 'line', 'character'] } },
      { name: 'lsp_symbols', description: 'List document symbols for a file', inputSchema: { type: 'object', properties: { file: { type: 'string' } }, required: ['file'] } },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const lspCommand = process.env.OMO_KIMI_LSP_COMMAND;
    const lspArgs = process.env.OMO_KIMI_LSP_ARGS?.split(' ') ?? [];

    switch (req.params.name) {
      case 'lsp_status': {
        const transport = lspCommand ? createTransport(lspCommand, lspArgs) : undefined;
        const status = transport ? 'ready' : 'no LSP configured';
        transport?.close();
        return { content: [{ type: 'text', text: status }] };
      }
      case 'lsp_diagnostics': {
        const file = (req.params.arguments as { file: string }).file;
        const transport = lspCommand ? createTransport(lspCommand, lspArgs) : undefined;
        try {
          const diagnostics = transport ? await runDiagnostics(file, transport) : [];
          return { content: [{ type: 'text', text: JSON.stringify({ diagnostics }) }] };
        } finally {
          transport?.close();
        }
      }
      case 'lsp_goto_definition':
      case 'lsp_find_references': {
        const args = req.params.arguments as { file: string; line: number; character: number };
        const transport = lspCommand ? createTransport(lspCommand, lspArgs) : undefined;
        if (!transport) {
          return { content: [{ type: 'text', text: JSON.stringify({ locations: [] }) }] };
        }
        const client = new LspClient(transport);
        try {
          const uri = pathToFileURL(path.resolve(args.file)).href;
          const text = fs.existsSync(args.file) ? fs.readFileSync(args.file, 'utf-8') : '';
          await client.initialize(pathToFileURL(process.cwd()).href);
          client.openDocument(uri, path.extname(args.file).replace('.', '') || 'text', text);
          const locations = await (req.params.name === 'lsp_goto_definition'
            ? client.gotoDefinition(uri, { line: args.line, character: args.character })
            : client.findReferences(uri, { line: args.line, character: args.character }));
          return { content: [{ type: 'text', text: JSON.stringify({ locations }) }] };
        } catch (err) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: (err as Error).message }) }], isError: true };
        } finally {
          client.close();
        }
      }
      case 'lsp_symbols': {
        const file = (req.params.arguments as { file: string }).file;
        const transport = lspCommand ? createTransport(lspCommand, lspArgs) : undefined;
        if (!transport) {
          return { content: [{ type: 'text', text: JSON.stringify({ symbols: [] }) }] };
        }
        const client = new LspClient(transport);
        try {
          const uri = pathToFileURL(path.resolve(file)).href;
          const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '';
          await client.initialize(pathToFileURL(process.cwd()).href);
          client.openDocument(uri, path.extname(file).replace('.', '') || 'text', text);
          const symbols = await client.documentSymbol(uri);
          return { content: [{ type: 'text', text: JSON.stringify({ symbols }) }] };
        } catch (err) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: (err as Error).message }) }], isError: true };
        } finally {
          client.close();
        }
      }
      default:
        return { content: [{ type: 'text', text: 'unknown tool' }], isError: true };
    }
  });

  const transport = new StdioServerTransport();
  server.connect(transport);
}
