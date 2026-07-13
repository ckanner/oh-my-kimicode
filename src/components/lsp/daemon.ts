import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LspClient } from './lsp-client.js';
import { VERSION } from '../../shared/version.js';
import { StdioLspTransport, type LspTransport } from './transport.js';
import { languageIdFromExtension } from './language-id.js';
import { getProjectDir } from '../../shared/env.js';
import {
  getInstallDecisionsPath,
  isInstallDecision,
  recordInstallDecision,
  validateInstallDecisionServerId,
} from './install-decisions.js';
import { findServerByCommand } from './server-catalog.js';
import { applyWorkspaceEdit } from './workspace-edit.js';
import { resolveLspCommand, resolveLspArgs } from './config.js';

const projectDir = getProjectDir();
const lspCommand = resolveLspCommand();
const lspArgs = resolveLspArgs();

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
  return languageIdFromExtension(path.extname(filePath).slice(1));
}

function resolveUri(file: string): string {
  return pathToFileURL(path.resolve(projectDir, file)).href;
}

function readFileText(file: string): string {
  const full = path.resolve(projectDir, file);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf-8') : '';
}

function resolveFileArg(args: { file?: string; filePath?: string }): string {
  return args.filePath ?? args.file ?? '';
}

function collectFiles(filePath: string): string[] {
  const full = path.resolve(projectDir, filePath);
  if (!fs.existsSync(full)) return [];
  const stat = fs.statSync(full);
  if (stat.isFile()) return [full];
  if (!stat.isDirectory()) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const p = path.join(full, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(path.relative(projectDir, p)));
    } else if (entry.isFile()) {
      files.push(p);
    }
  }
  return files;
}

function severityNumberToName(severity?: number): string {
  switch (severity) {
    case 1: return 'error';
    case 2: return 'warning';
    case 3: return 'information';
    case 4: return 'hint';
    default: return 'information';
  }
}

function severityMatches(filter: string, severity: string): boolean {
  if (filter === 'all' || !filter) return true;
  return filter === severity;
}

function inferConfiguredServer(): { id?: string; name?: string; extensions?: string[] } | undefined {
  if (!lspCommand) return undefined;
  const server = findServerByCommand(lspCommand);
  return server ? { id: server.id, name: server.name, extensions: server.extensions } : undefined;
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

export function startLspDaemon() {
  const daemon = new LspDaemon({ command: lspCommand, args: lspArgs, cwd: projectDir });

  const server = new Server({ name: 'lsp-daemon', version: VERSION }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      { name: 'status', description: 'LSP daemon status (alias for lsp_status)', inputSchema: { type: 'object', properties: {}, required: [] } },
      { name: 'lsp_status', description: 'LSP daemon status', inputSchema: { type: 'object', properties: {}, required: [] } },
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

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    try {
      const toolName = normalizeLspToolName(req.params.name);
      switch (toolName) {
        case 'lsp_status': {
          const configured = daemon.isConfigured();
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                status: configured ? 'ready' : 'no LSP configured',
                configured,
                command: lspCommand || undefined,
                args: lspArgs.length > 0 ? lspArgs : undefined,
                server: inferConfiguredServer(),
              }),
            }],
          };
        }
        case 'lsp_diagnostics': {
          if (!daemon.isConfigured()) {
            return { content: [{ type: 'text', text: JSON.stringify({ diagnostics: [] }) }] };
          }
          const args = req.params.arguments as { file?: string; filePath?: string; severity?: string };
          const file = resolveFileArg(args);
          const severityFilter = args.severity ?? 'all';
          const files = collectFiles(file);
          const diagnostics = await daemon.withClient(async (client) => {
            const results: Array<{ file: string; line: number; message: string; severity: string }> = [];
            for (const f of files) {
              const uri = pathToFileURL(f).href;
              const text = fs.readFileSync(f, 'utf-8');
              client.openDocument(uri, inferLanguageId(f), text);
              client.didChange(uri, text);
              const raw = await client.requestDiagnostics(uri);
              for (const d of raw) {
                const severity = severityNumberToName(d.severity);
                if (!severityMatches(severityFilter, severity)) continue;
                results.push({
                  file: path.relative(projectDir, f),
                  line: d.range.start.line + 1,
                  message: d.message,
                  severity,
                });
              }
            }
            return results;
          });
          return { content: [{ type: 'text', text: JSON.stringify({ diagnostics }) }] };
        }
        case 'lsp_goto_definition':
        case 'lsp_find_references': {
          if (!daemon.isConfigured()) {
            return { content: [{ type: 'text', text: JSON.stringify({ locations: [] }) }] };
          }
          const args = req.params.arguments as {
            file?: string;
            filePath?: string;
            line: number;
            character: number;
            includeDeclaration?: boolean;
          };
          const file = resolveFileArg(args);
          const uri = resolveUri(file);
          const text = readFileText(file);
          const locations = await daemon.withClient(async (client) => {
            client.openDocument(uri, inferLanguageId(file), text);
            const pos = { line: args.line, character: args.character };
            return req.params.name === 'lsp_goto_definition'
              ? client.gotoDefinition(uri, pos)
              : client.findReferences(uri, pos, args.includeDeclaration);
          });
          return { content: [{ type: 'text', text: JSON.stringify({ locations }) }] };
        }
        case 'lsp_symbols': {
          if (!daemon.isConfigured()) {
            return { content: [{ type: 'text', text: JSON.stringify({ symbols: [] }) }] };
          }
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
          const symbols = await daemon.withClient(async (client) => {
            let result: unknown;
            if (scope === 'workspace') {
              if (!args.query) {
                throw new Error("'query' is required for workspace scope");
              }
              result = await client.workspaceSymbol(args.query);
            } else {
              const uri = resolveUri(file);
              const text = readFileText(file);
              client.openDocument(uri, inferLanguageId(file), text);
              result = await client.documentSymbol(uri);
            }
            return limit && Array.isArray(result) ? result.slice(0, limit) : result;
          });
          return { content: [{ type: 'text', text: JSON.stringify({ symbols }) }] };
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
          if (!daemon.isConfigured()) {
            return { content: [{ type: 'text', text: JSON.stringify({ result: null }) }] };
          }
          const args = req.params.arguments as {
            file?: string;
            filePath?: string;
            line: number;
            character: number;
            newName?: string;
          };
          const file = resolveFileArg(args);
          const uri = resolveUri(file);
          const text = readFileText(file);
          const result = await daemon.withClient(async (client) => {
            client.openDocument(uri, inferLanguageId(file), text);
            const pos = { line: args.line, character: args.character };
            return req.params.name === 'lsp_prepare_rename'
              ? client.prepareRename(uri, pos)
              : client.rename(uri, pos, args.newName ?? '');
          });
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

if (
  import.meta.url.startsWith('file:') &&
  path.resolve(process.argv[1] ?? '') === path.resolve(fileURLToPath(import.meta.url))
) {
  startLspDaemon();
}
