import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { LspMessage, LspTransport } from './transport.js';

export interface Diagnostic {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  severity?: number;
  code?: string | number;
  source?: string;
  message: string;
}

export interface PublishDiagnosticsParams {
  uri: string;
  diagnostics: Diagnostic[];
}

export interface Position {
  line: number;
  character: number;
}

export class LspClient {
  private transport: LspTransport;
  private nextId = 1;
  private pending = new Map<number, { resolve: (msg: LspMessage) => void; reject: (err: Error) => void }>();
  private diagnosticsHandlers = new Set<(params: PublishDiagnosticsParams) => void>();

  constructor(transport: LspTransport) {
    this.transport = transport;
    this.transport.onMessage((msg) => this.handleMessage(msg));
    this.transport.onError((err) => {
      for (const [, { reject }] of this.pending) reject(new Error(err.message));
      this.pending.clear();
    });
  }

  initialize(rootUri: string): Promise<LspMessage> {
    return this.request('initialize', {
      processId: process.pid,
      rootUri,
      capabilities: {},
      workspaceFolders: null,
    });
  }

  openDocument(uri: string, languageId: string, text: string): void {
    this.notify('textDocument/didOpen', {
      textDocument: { uri, languageId, version: 1, text },
    });
  }

  didChange(uri: string, text: string): void {
    this.notify('textDocument/didChange', {
      textDocument: { uri, version: 2 },
      contentChanges: [{ text }],
    });
  }

  requestDiagnostics(uri: string): Promise<Diagnostic[]> {
    return new Promise((resolve, _reject) => {
      const handler = (params: PublishDiagnosticsParams) => {
        if (params.uri === uri) {
          this.diagnosticsHandlers.delete(handler);
          resolve(params.diagnostics);
        }
      };
      this.diagnosticsHandlers.add(handler);
      // Some servers require a change notification to publish diagnostics.
      // Send the file's current content so diagnostics reflect reality.
      let text = '';
      try {
        const filePath = fileURLToPath(uri);
        if (fs.existsSync(filePath)) {
          text = fs.readFileSync(filePath, 'utf-8');
        }
      } catch {
        text = '';
      }
      this.notify('textDocument/didChange', {
        textDocument: { uri, version: 2 },
        contentChanges: [{ text }],
      });
      // Timeout fallback
      setTimeout(() => {
        this.diagnosticsHandlers.delete(handler);
        resolve([]);
      }, 5000);
    });
  }

  async gotoDefinition(uri: string, position: Position): Promise<unknown> {
    const msg = await this.request('textDocument/definition', {
      textDocument: { uri },
      position,
    });
    return (msg as { result?: unknown }).result;
  }

  async findReferences(uri: string, position: Position, includeDeclaration = true): Promise<unknown> {
    const msg = await this.request('textDocument/references', {
      textDocument: { uri },
      position,
      context: { includeDeclaration },
    });
    return (msg as { result?: unknown }).result;
  }

  async documentSymbol(uri: string): Promise<unknown> {
    const msg = await this.request('textDocument/documentSymbol', {
      textDocument: { uri },
    });
    return (msg as { result?: unknown }).result;
  }

  async workspaceSymbol(query: string): Promise<unknown> {
    const msg = await this.request('workspace/symbol', { query });
    return (msg as { result?: unknown }).result;
  }

  async prepareRename(uri: string, position: Position): Promise<unknown> {
    const msg = await this.request('textDocument/prepareRename', {
      textDocument: { uri },
      position,
    });
    return (msg as { result?: unknown }).result;
  }

  async rename(uri: string, position: Position, newName: string): Promise<unknown> {
    const msg = await this.request('textDocument/rename', {
      textDocument: { uri },
      position,
      newName,
    });
    return (msg as { result?: unknown }).result;
  }

  shutdown(): Promise<LspMessage> {
    return this.request('shutdown', {});
  }

  exit(): void {
    this.notify('exit', {});
  }

  close(): void {
    this.transport.close();
  }

  private request(method: string, params: unknown): Promise<LspMessage> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.transport.send({ jsonrpc: '2.0', id, method, params });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`LSP request timeout: ${method}`));
        }
      }, 10000);
    });
  }

  private notify(method: string, params: unknown): void {
    this.transport.send({ jsonrpc: '2.0', method, params });
  }

  private handleMessage(msg: LspMessage): void {
    if (msg.method === 'textDocument/publishDiagnostics') {
      const params = msg.params as PublishDiagnosticsParams;
      for (const handler of this.diagnosticsHandlers) handler(params);
      return;
    }
    if (typeof msg.id === 'number' && this.pending.has(msg.id)) {
      const { resolve } = this.pending.get(msg.id)!;
      this.pending.delete(msg.id);
      resolve(msg);
    }
  }
}
