import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, type ChildProcess } from 'node:child_process';

const DAEMON = path.resolve('plugin/components/lsp/dist/daemon.mjs');

interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
}

function writeMessage(proc: ChildProcess, msg: JsonRpcMessage): void {
  proc.stdin!.write(JSON.stringify(msg) + '\n');
}

function readMessages(proc: ChildProcess, expectedIds: number[]): Promise<JsonRpcMessage[]> {
  return new Promise((resolve, reject) => {
    const messages: JsonRpcMessage[] = [];
    const stderrChunks: Buffer[] = [];
    const onData = (chunk: Buffer) => {
      const lines = chunk.toString('utf-8').split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          messages.push(JSON.parse(line) as JsonRpcMessage);
        } catch {
          // ignore malformed messages
        }
      }
      if (expectedIds.every((id) => messages.some((m) => m.id === id))) {
        proc.stdout!.off('data', onData);
        resolve(messages);
      }
    };
    proc.stdout!.on('data', onData);
    proc.stderr!.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });
    proc.on('error', reject);
    proc.on('exit', (code) => {
      proc.stdout!.off('data', onData);
      if (expectedIds.every((id) => messages.some((m) => m.id === id))) {
        resolve(messages);
      } else {
        const stderr = Buffer.concat(stderrChunks).toString('utf-8').trim();
        reject(new Error(`daemon exited (code ${code}) before response; stderr: ${stderr || '(empty)'}`));
      }
    });
    // Safety timeout
    setTimeout(() => {
      const stderr = Buffer.concat(stderrChunks).toString('utf-8').trim();
      proc.kill();
      reject(new Error(`timed out waiting for response ids [${expectedIds.join(',')}]; stderr: ${stderr || '(empty)'}`));
    }, 15000);
  });
}

function createMockLspServer(tmp: string): string {
  const script = path.join(tmp, 'mock-lsp.mjs');
  fs.writeFileSync(
    script,
    `import fs from 'node:fs';
let buffer = '';
function send(msg) {
  const body = JSON.stringify(msg);
  process.stdout.write('Content-Length: ' + Buffer.byteLength(body) + '\\r\\n\\r\\n' + body);
}
process.stdin.on('data', (chunk) => {
  buffer += chunk.toString('utf-8');
  while (true) {
    const m = buffer.match(/Content-Length: (\\d+)\\r\\n\\r\\n/);
    if (!m) break;
    const len = parseInt(m[1], 10);
    const end = m.index + m[0].length;
    if (buffer.length < end + len) break;
    const body = buffer.slice(end, end + len);
    buffer = buffer.slice(end + len);
    const msg = JSON.parse(body);
    if (msg.method === 'initialize') {
      send({ jsonrpc: '2.0', id: msg.id, result: { capabilities: {} } });
    } else if (msg.method === 'initialized') {
      // no-op
    } else if (msg.method === 'textDocument/didOpen' || msg.method === 'textDocument/didChange') {
      const uri = msg.params.textDocument?.uri;
      const languageId = msg.params.textDocument?.languageId;
      if (languageId) {
        fs.writeFileSync(process.argv[2], languageId);
      }
      send({ jsonrpc: '2.0', method: 'textDocument/publishDiagnostics', params: { uri, diagnostics: [] } });
    } else if (msg.method === 'shutdown') {
      send({ jsonrpc: '2.0', id: msg.id, result: null });
    } else if (msg.method === 'exit') {
      process.exit(0);
    }
  }
});
`,
    'utf-8',
  );
  return script;
}

describe(
  'lsp daemon entry',
  () => {
    let tmp: string;
    let proc: ChildProcess;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-daemon-'));
    delete process.env.LAZYKIMICODE_LSP_COMMAND;
    delete process.env.LAZYKIMICODE_LSP_ARGS;
  });

  afterEach(async () => {
    if (proc && !proc.killed) {
      try {
        proc.kill();
      } catch {
        // ignore
      }
      await new Promise<void>((resolve) => {
        proc.on('exit', resolve);
        setTimeout(resolve, 1000);
      });
    }
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  it('lists all lsp tools', async () => {
    proc = spawn(process.execPath, [DAEMON], { env: { ...process.env } });
    const pending = readMessages(proc, [1]);
    writeMessage(proc, { jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const messages = await pending;
    const response = messages.find((m) => m.id === 1);
    expect(response).toBeDefined();
    const tools = (response!.result as { tools: Array<{ name: string }> }).tools.map((t) => t.name);
    expect(tools).toContain('lsp_status');
    expect(tools).toContain('lsp_diagnostics');
    expect(tools).toContain('lsp_goto_definition');
    expect(tools).toContain('lsp_symbols');
    expect(tools).toContain('lsp_install_decision');
  });

  it('returns no LSP configured for lsp_status', async () => {
    proc = spawn(process.execPath, [DAEMON], { env: { ...process.env } });
    const pending = readMessages(proc, [2]);
    writeMessage(proc, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'lsp_status', arguments: {} },
    });
    const messages = await pending;
    const response = messages.find((m) => m.id === 2);
    expect(response).toBeDefined();
    const text = (response!.result as { content: Array<{ text: string }> }).content[0].text;
    expect(text).toContain('no LSP configured');
  });

  it('initializes and dispatches lsp_diagnostics for a non-TS/JS file', async () => {
    const captureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-daemon-capture-'));
    const languageIdCapture = path.join(captureDir, 'captured-language-id.txt');
    const mockServer = createMockLspServer(tmp);
    const projectDir = fs.mkdtempSync(path.join(tmp, 'project-'));
    const file = path.join(projectDir, 'main.go');
    fs.writeFileSync(file, 'package main\n');

    proc = spawn(process.execPath, [DAEMON], {
      env: {
        ...process.env,
        LAZYKIMICODE_LSP_COMMAND: process.execPath,
        LAZYKIMICODE_LSP_ARGS: `${mockServer} ${languageIdCapture}`,
        LAZYKIMICODE_PROJECT: projectDir,
      },
    });
    const pending = readMessages(proc, [3]);
    writeMessage(proc, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'lsp_diagnostics', arguments: { file: 'main.go' } },
    });
    const messages = await pending;
    const response = messages.find((m) => m.id === 3);
    expect(response).toBeDefined();
    const text = (response!.result as { content: Array<{ text: string }> }).content[0].text;
    expect(text).toContain('"diagnostics":[]');
    expect(fs.existsSync(languageIdCapture)).toBe(true);
    expect(fs.readFileSync(languageIdCapture, 'utf-8')).toBe('go');

    // Clean up the capture directory explicitly; it is not part of `tmp` so
    // `afterEach` will not remove it. On Windows the mock LSP server may still
    // hold a handle to the capture file briefly after the daemon is killed.
    try {
      fs.rmSync(captureDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      // Best-effort cleanup; the OS will reclaim the temp directory.
    }
  });

  it('records lsp_install_decision', async () => {
    const projectDir = fs.mkdtempSync(path.join(tmp, 'project-'));
    proc = spawn(process.execPath, [DAEMON], {
      env: {
        ...process.env,
        LAZYKIMICODE_PROJECT: projectDir,
      },
    });
    const pending = readMessages(proc, [4]);
    writeMessage(proc, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'lsp_install_decision', arguments: { server_id: 'typescript', decision: 'allowed' } },
    });
    const messages = await pending;
    const response = messages.find((m) => m.id === 4);
    expect(response).toBeDefined();
    const text = (response!.result as { content: Array<{ text: string }> }).content[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.serverId).toBe('typescript');
    expect(parsed.decision).toBe('allowed');
    expect(fs.existsSync(path.join(projectDir, '.lazykimicode', 'lsp-install-decisions.json'))).toBe(true);
  });
}, 15000);
