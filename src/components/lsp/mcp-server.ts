import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { runDiagnostics, createTransport } from './diagnostics.js';
import { parseLspArgs } from './args.js';
import { languageIdFromExtension } from './language-id.js';
import { LspClient } from './lsp-client.js';
import {
  getInstallDecisionsPath,
  isInstallDecision,
  recordInstallDecision,
} from './install-decisions.js';
import { VERSION } from '../../shared/version.js';
import { getEnv, getProjectDir } from '../../shared/env.js';

export interface ToolRequest {
  params: {
    name: string;
    arguments?: Record<string, unknown>;
  };
}

export { getProjectDir };

export function getRootUri(): string {
  return pathToFileURL(getProjectDir()).href + '/';
}

export async function handleToolRequest(
  req: ToolRequest,
  rootUri: string,
  options: { createTransport?: typeof createTransport } = {},
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const createTransportImpl = options.createTransport ?? createTransport;
  const lspCommand = getEnv('LSP_COMMAND');
  const lspArgs = getEnv('LSP_ARGS') ? parseLspArgs(getEnv('LSP_ARGS')!) : [];

  switch (req.params.name) {
    case 'lsp_status': {
      const transport = lspCommand ? createTransportImpl(lspCommand, lspArgs) : undefined;
      const status = transport ? 'ready' : 'no LSP configured';
      transport?.close();
      return { content: [{ type: 'text', text: status }] };
    }
    case 'lsp_diagnostics': {
      const file = (req.params.arguments as { file: string }).file;
      const transport = lspCommand ? createTransportImpl(lspCommand, lspArgs) : undefined;
      try {
        const diagnostics = transport ? await runDiagnostics(file, transport, rootUri) : [];
        return { content: [{ type: 'text', text: JSON.stringify({ diagnostics }) }] };
      } finally {
        transport?.close();
      }
    }
    case 'lsp_goto_definition':
    case 'lsp_find_references': {
      const args = req.params.arguments as { file: string; line: number; character: number };
      const transport = lspCommand ? createTransportImpl(lspCommand, lspArgs) : undefined;
      if (!transport) {
        return { content: [{ type: 'text', text: JSON.stringify({ locations: [] }) }] };
      }
      const client = new LspClient(transport);
      try {
        const filePath = path.resolve(getProjectDir(), args.file);
        const uri = pathToFileURL(filePath).href;
        const text = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
        await client.initialize(rootUri);
        client.openDocument(uri, languageIdFromExtension(path.extname(args.file).replace('.', '')), text);
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
      const args = req.params.arguments as {
        file: string;
        scope?: string;
        query?: string;
        limit?: number;
      };
      const file = args.file;
      const scope = args.scope === 'workspace' ? 'workspace' : 'document';
      const limit = typeof args.limit === 'number' && args.limit > 0 ? args.limit : undefined;
      const transport = lspCommand ? createTransportImpl(lspCommand, lspArgs) : undefined;
      if (!transport) {
        return { content: [{ type: 'text', text: JSON.stringify({ symbols: [] }) }] };
      }
      const client = new LspClient(transport);
      try {
        let symbols: unknown;
        if (scope === 'workspace') {
          if (!args.query) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ error: "'query' is required for workspace scope" }),
              }],
              isError: true,
            };
          }
          await client.initialize(rootUri);
          const result = await client.workspaceSymbol(args.query);
          symbols = limit && Array.isArray(result) ? result.slice(0, limit) : result;
        } else {
          const filePath = path.resolve(getProjectDir(), file);
          const uri = pathToFileURL(filePath).href;
          const text = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
          await client.initialize(rootUri);
          client.openDocument(uri, languageIdFromExtension(path.extname(file).replace('.', '')), text);
          const result = await client.documentSymbol(uri);
          symbols = limit && Array.isArray(result) ? result.slice(0, limit) : result;
        }
        return { content: [{ type: 'text', text: JSON.stringify({ symbols }) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: (err as Error).message }) }], isError: true };
      } finally {
        client.close();
      }
    }
    case 'lsp_install_decision': {
      const args = req.params.arguments as { server_id: string; decision: string };
      if (!isInstallDecision(args.decision)) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: `Invalid decision '${args.decision}'. Expected "declined" or "allowed".` }),
          }],
          isError: true,
        };
      }
      recordInstallDecision(args.server_id, args.decision);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            serverId: args.server_id,
            decision: args.decision,
            path: getInstallDecisionsPath(),
          }),
        }],
      };
    }
    case 'lsp_prepare_rename':
    case 'lsp_rename': {
      const args = req.params.arguments as { file: string; line: number; character: number; newName?: string };
      const transport = lspCommand ? createTransportImpl(lspCommand, lspArgs) : undefined;
      if (!transport) {
        return { content: [{ type: 'text', text: JSON.stringify({ result: null }) }] };
      }
      const client = new LspClient(transport);
      try {
        const filePath = path.resolve(getProjectDir(), args.file);
        const uri = pathToFileURL(filePath).href;
        const text = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
        await client.initialize(rootUri);
        client.openDocument(uri, languageIdFromExtension(path.extname(args.file).replace('.', '')), text);
        const pos = { line: args.line, character: args.character };
        const result = req.params.name === 'lsp_prepare_rename'
          ? await client.prepareRename(uri, pos)
          : await client.rename(uri, pos, args.newName ?? '');
        return { content: [{ type: 'text', text: JSON.stringify({ result }) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: (err as Error).message }) }], isError: true };
      } finally {
        client.close();
      }
    }
    default:
      return { content: [{ type: 'text', text: 'unknown tool' }], isError: true };
  }
}

export function startLspServer() {
  const server = new Server({ name: 'lsp', version: VERSION }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      { name: 'lsp_status', description: 'LSP server status', inputSchema: { type: 'object', properties: {}, required: [] } },
      { name: 'lsp_diagnostics', description: 'Get diagnostics for a file', inputSchema: { type: 'object', properties: { file: { type: 'string' } }, required: ['file'] } },
      { name: 'lsp_goto_definition', description: 'Go to definition', inputSchema: { type: 'object', properties: { file: { type: 'string' }, line: { type: 'number' }, character: { type: 'number' } }, required: ['file', 'line', 'character'] } },
      { name: 'lsp_find_references', description: 'Find references', inputSchema: { type: 'object', properties: { file: { type: 'string' }, line: { type: 'number' }, character: { type: 'number' } }, required: ['file', 'line', 'character'] } },
      {
        name: 'lsp_symbols',
        description: 'List document symbols for a file or search workspace symbols',
        inputSchema: {
          type: 'object',
          properties: {
            file: { type: 'string', description: 'File path used as LSP context' },
            scope: { type: 'string', enum: ['document', 'workspace'], description: 'document for file outline, workspace for project-wide search' },
            query: { type: 'string', description: 'Workspace symbol query (required when scope is workspace)' },
            limit: { type: 'number', description: 'Maximum number of symbols to return' },
          },
          required: ['file'],
        },
      },
      {
        name: 'lsp_install_decision',
        description: "Record whether the user allowed or declined installing a missing LSP server. 'declined' silences future prompts; 'allowed' pre-authorizes installation.",
        inputSchema: {
          type: 'object',
          properties: {
            server_id: { type: 'string', description: "The LSP server id (e.g. 'typescript', 'rust')." },
            decision: { type: 'string', enum: ['declined', 'allowed'], description: 'declined or allowed' },
          },
          required: ['server_id', 'decision'],
        },
      },
      { name: 'lsp_prepare_rename', description: 'Validate a symbol rename is possible', inputSchema: { type: 'object', properties: { file: { type: 'string' }, line: { type: 'number' }, character: { type: 'number' } }, required: ['file', 'line', 'character'] } },
      { name: 'lsp_rename', description: 'Execute a symbol rename', inputSchema: { type: 'object', properties: { file: { type: 'string' }, line: { type: 'number' }, character: { type: 'number' }, newName: { type: 'string' } }, required: ['file', 'line', 'character', 'newName'] } },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => handleToolRequest(req, getRootUri()));

  const transport = new StdioServerTransport();
  server.connect(transport);
}

const modulePath = path.resolve(fileURLToPath(import.meta.url));
const entryPath = path.resolve(process.argv[1] ?? '');
if (modulePath === entryPath) {
  startLspServer();
}
