import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { runDiagnostics, createTransport } from './diagnostics.js';
import { languageIdFromExtension } from './language-id.js';
import { LspClient } from './lsp-client.js';
import {
  getInstallDecisionsPath,
  isInstallDecision,
  recordInstallDecision,
  validateInstallDecisionServerId,
} from './install-decisions.js';
import { VERSION } from '../../shared/version.js';
import { getProjectDir } from '../../shared/env.js';
import { LSP_SERVER_CATALOG } from './server-catalog.js';
import { applyWorkspaceEdit } from './workspace-edit.js';
import { resolveLspCommand, resolveLspArgs } from './config.js';

export interface ToolRequest {
  params: {
    name: string;
    arguments?: Record<string, unknown>;
  };
}

const SHORT_TO_LONG_TOOL_NAME: Record<string, string> = {
  status: 'lsp_status',
  diagnostics: 'lsp_diagnostics',
  goto_definition: 'lsp_goto_definition',
  find_references: 'lsp_find_references',
  symbols: 'lsp_symbols',
  install_decision: 'lsp_install_decision',
  prepare_rename: 'lsp_prepare_rename',
  rename: 'lsp_rename',
};

function normalizeLspToolName(name: string): string {
  return SHORT_TO_LONG_TOOL_NAME[name] ?? name;
}

export { getProjectDir };

export function getRootUri(): string {
  return pathToFileURL(getProjectDir()).href + '/';
}

function resolveFileArg(args: { file?: string; filePath?: string }): string {
  return (args.filePath ?? args.file ?? '');
}

function inferConfiguredServer(): { id?: string; name?: string; extensions?: string[] } | undefined {
  const lspCommand = resolveLspCommand();
  if (!lspCommand) return undefined;
  const commandName = path.basename(lspCommand);
  const server = LSP_SERVER_CATALOG.find((s) => path.basename(s.command) === commandName);
  return server ? { id: server.id, name: server.name, extensions: server.extensions } : undefined;
}

export async function handleToolRequest(
  req: ToolRequest,
  rootUri: string,
  options: { createTransport?: typeof createTransport } = {},
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const createTransportImpl = options.createTransport ?? createTransport;
  const lspCommand = resolveLspCommand();
  const lspArgs = resolveLspArgs();
  const toolName = normalizeLspToolName(req.params.name);

  switch (toolName) {
    case 'lsp_status': {
      const transport = lspCommand ? createTransportImpl(lspCommand, lspArgs) : undefined;
      const configured = transport !== undefined;
      const server = inferConfiguredServer();
      transport?.close();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: configured ? 'ready' : 'no LSP configured',
            configured,
            command: lspCommand || undefined,
            args: lspArgs.length > 0 ? lspArgs : undefined,
            server,
          }),
        }],
      };
    }
    case 'lsp_diagnostics': {
      const args = req.params.arguments as { file?: string; filePath?: string; severity?: string };
      const file = resolveFileArg(args);
      const severity = (args.severity ?? 'all') as import('./diagnostics.js').SeverityFilter;
      const transport = lspCommand ? createTransportImpl(lspCommand, lspArgs) : undefined;
      try {
        const diagnostics = transport ? await runDiagnostics(file, transport, rootUri, severity) : [];
        return { content: [{ type: 'text', text: JSON.stringify({ diagnostics }) }] };
      } finally {
        transport?.close();
      }
    }
    case 'lsp_goto_definition':
    case 'lsp_find_references': {
      const args = req.params.arguments as {
        file?: string;
        filePath?: string;
        line: number;
        character: number;
        includeDeclaration?: boolean;
      };
      const file = resolveFileArg(args);
      const transport = lspCommand ? createTransportImpl(lspCommand, lspArgs) : undefined;
      if (!transport) {
        return { content: [{ type: 'text', text: JSON.stringify({ locations: [] }) }] };
      }
      const client = new LspClient(transport);
      try {
        const filePath = path.resolve(getProjectDir(), file);
        const uri = pathToFileURL(filePath).href;
        const text = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
        await client.initialize(rootUri);
        client.openDocument(uri, languageIdFromExtension(path.extname(file).replace('.', '')), text);
        const locations = await (req.params.name === 'lsp_goto_definition'
          ? client.gotoDefinition(uri, { line: args.line, character: args.character })
          : client.findReferences(uri, { line: args.line, character: args.character }, args.includeDeclaration));
        return { content: [{ type: 'text', text: JSON.stringify({ locations }) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: (err as Error).message }) }], isError: true };
      } finally {
        client.close();
      }
    }
    case 'lsp_symbols': {
      const args = req.params.arguments as {
        file?: string;
        filePath?: string;
        scope?: string;
        query?: string;
        limit?: number;
      };
      const file = resolveFileArg(args);
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
      const unknownServer = validateInstallDecisionServerId(args.server_id);
      if (unknownServer) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: unknownServer, serverId: args.server_id }) }],
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
      const args = req.params.arguments as {
        file?: string;
        filePath?: string;
        line: number;
        character: number;
        newName?: string;
      };
      const file = resolveFileArg(args);
      const transport = lspCommand ? createTransportImpl(lspCommand, lspArgs) : undefined;
      if (!transport) {
        return { content: [{ type: 'text', text: JSON.stringify({ result: null }) }] };
      }
      const client = new LspClient(transport);
      try {
        const filePath = path.resolve(getProjectDir(), file);
        const uri = pathToFileURL(filePath).href;
        const text = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
        await client.initialize(rootUri);
        client.openDocument(uri, languageIdFromExtension(path.extname(file).replace('.', '')), text);
        const pos = { line: args.line, character: args.character };
        const result = req.params.name === 'lsp_prepare_rename'
          ? await client.prepareRename(uri, pos)
          : await client.rename(uri, pos, args.newName ?? '');
        if (req.params.name === 'lsp_rename' && result && typeof result === 'object') {
          const editResult = applyWorkspaceEdit(result as import('./workspace-edit.js').WorkspaceEdit);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ result, applied: editResult.applied, errors: editResult.errors }),
            }],
            isError: editResult.errors.length > 0,
          };
        }
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
      { name: 'status', description: 'LSP server status (alias for lsp_status)', inputSchema: { type: 'object', properties: {}, required: [] } },
      { name: 'lsp_status', description: 'LSP server status', inputSchema: { type: 'object', properties: {}, required: [] } },
      {
        name: 'diagnostics',
        description: 'Get diagnostics for a file or directory (alias for lsp_diagnostics)',
        inputSchema: {
          type: 'object',
          properties: {
            file: { type: 'string', description: 'File or directory path' },
            filePath: { type: 'string', description: 'Alias for file' },
            severity: { type: 'string', enum: ['error', 'warning', 'information', 'hint', 'all'], description: 'Severity filter' },
          },
          required: [],
        },
      },
      {
        name: 'lsp_diagnostics',
        description: 'Get diagnostics for a file or directory',
        inputSchema: {
          type: 'object',
          properties: {
            file: { type: 'string', description: 'File or directory path' },
            filePath: { type: 'string', description: 'Alias for file' },
            severity: { type: 'string', enum: ['error', 'warning', 'information', 'hint', 'all'], description: 'Severity filter' },
          },
          required: [],
        },
      },
      {
        name: 'goto_definition',
        description: 'Go to definition (alias for lsp_goto_definition)',
        inputSchema: {
          type: 'object',
          properties: {
            file: { type: 'string' },
            filePath: { type: 'string', description: 'Alias for file' },
            line: { type: 'number' },
            character: { type: 'number' },
          },
          required: ['line', 'character'],
        },
      },
      {
        name: 'lsp_goto_definition',
        description: 'Go to definition',
        inputSchema: {
          type: 'object',
          properties: {
            file: { type: 'string' },
            filePath: { type: 'string', description: 'Alias for file' },
            line: { type: 'number' },
            character: { type: 'number' },
          },
          required: ['line', 'character'],
        },
      },
      {
        name: 'find_references',
        description: 'Find references (alias for lsp_find_references)',
        inputSchema: {
          type: 'object',
          properties: {
            file: { type: 'string' },
            filePath: { type: 'string', description: 'Alias for file' },
            line: { type: 'number' },
            character: { type: 'number' },
            includeDeclaration: { type: 'boolean', description: 'Include the declaration in results' },
          },
          required: ['line', 'character'],
        },
      },
      {
        name: 'lsp_find_references',
        description: 'Find references',
        inputSchema: {
          type: 'object',
          properties: {
            file: { type: 'string' },
            filePath: { type: 'string', description: 'Alias for file' },
            line: { type: 'number' },
            character: { type: 'number' },
            includeDeclaration: { type: 'boolean', description: 'Include the declaration in results' },
          },
          required: ['line', 'character'],
        },
      },
      {
        name: 'symbols',
        description: 'List document symbols for a file or search workspace symbols (alias for lsp_symbols)',
        inputSchema: {
          type: 'object',
          properties: {
            file: { type: 'string', description: 'File path used as LSP context' },
            filePath: { type: 'string', description: 'Alias for file' },
            scope: { type: 'string', enum: ['document', 'workspace'], description: 'document for file outline, workspace for project-wide search' },
            query: { type: 'string', description: 'Workspace symbol query (required when scope is workspace)' },
            limit: { type: 'number', description: 'Maximum number of symbols to return' },
          },
          required: [],
        },
      },
      {
        name: 'lsp_symbols',
        description: 'List document symbols for a file or search workspace symbols',
        inputSchema: {
          type: 'object',
          properties: {
            file: { type: 'string', description: 'File path used as LSP context' },
            filePath: { type: 'string', description: 'Alias for file' },
            scope: { type: 'string', enum: ['document', 'workspace'], description: 'document for file outline, workspace for project-wide search' },
            query: { type: 'string', description: 'Workspace symbol query (required when scope is workspace)' },
            limit: { type: 'number', description: 'Maximum number of symbols to return' },
          },
          required: [],
        },
      },
      {
        name: 'install_decision',
        description: "Record whether the user allowed or declined installing a missing LSP server (alias for lsp_install_decision). 'declined' silences future prompts; 'allowed' pre-authorizes installation.",
        inputSchema: {
          type: 'object',
          properties: {
            server_id: { type: 'string', description: "The LSP server id (e.g. 'typescript', 'rust')." },
            decision: { type: 'string', enum: ['declined', 'allowed'], description: 'declined or allowed' },
          },
          required: ['server_id', 'decision'],
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
      {
        name: 'prepare_rename',
        description: 'Validate a symbol rename is possible (alias for lsp_prepare_rename)',
        inputSchema: {
          type: 'object',
          properties: {
            file: { type: 'string' },
            filePath: { type: 'string', description: 'Alias for file' },
            line: { type: 'number' },
            character: { type: 'number' },
          },
          required: ['line', 'character'],
        },
      },
      {
        name: 'lsp_prepare_rename',
        description: 'Validate a symbol rename is possible',
        inputSchema: {
          type: 'object',
          properties: {
            file: { type: 'string' },
            filePath: { type: 'string', description: 'Alias for file' },
            line: { type: 'number' },
            character: { type: 'number' },
          },
          required: ['line', 'character'],
        },
      },
      {
        name: 'rename',
        description: 'Execute a symbol rename and apply the returned workspace edit (alias for lsp_rename)',
        inputSchema: {
          type: 'object',
          properties: {
            file: { type: 'string' },
            filePath: { type: 'string', description: 'Alias for file' },
            line: { type: 'number' },
            character: { type: 'number' },
            newName: { type: 'string' },
          },
          required: ['line', 'character', 'newName'],
        },
      },
      {
        name: 'lsp_rename',
        description: 'Execute a symbol rename and apply the returned workspace edit',
        inputSchema: {
          type: 'object',
          properties: {
            file: { type: 'string' },
            filePath: { type: 'string', description: 'Alias for file' },
            line: { type: 'number' },
            character: { type: 'number' },
            newName: { type: 'string' },
          },
          required: ['line', 'character', 'newName'],
        },
      },
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
