import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION } from '../../shared/version.js';

export interface McpRequest {
  jsonrpc: '2.0';
  id?: number | string;
  method: string;
  params?: unknown;
}

export interface McpResponse {
  jsonrpc: '2.0';
  id?: number | string;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface GitBashCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface ServerOptions {
  platform?: string;
  spawnImpl?: typeof spawn;
  bashPath?: string;
}

const GIT_BASH_CANDIDATES = [
  'C:\\Program Files\\Git\\bin\\bash.exe',
  'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
  'C:\\Program Files (x86)\\Git\\usr\\bin\\bash.exe',
  '/usr/bin/bash',
  '/bin/bash',
  'bash.exe',
  'bash',
];

export function findBashPath(): string | null {
  for (const candidate of GIT_BASH_CANDIDATES) {
    if (path.isAbsolute(candidate) || candidate.includes(path.sep)) {
      if (fs.existsSync(candidate)) return candidate;
      continue;
    }

    // Bare names: check cwd first, then search PATH (and Path/path on Windows).
    if (fs.existsSync(candidate)) return candidate;
    const pathEnv = process.env.PATH ?? process.env.Path ?? process.env.path ?? '';
    const dirs = pathEnv.split(path.delimiter).filter(Boolean);
    for (const dir of dirs) {
      const full = path.join(dir, candidate);
      if (fs.existsSync(full)) return full;
      // On Windows, also try the default executable extension.
      if (process.platform === 'win32' && !path.extname(candidate)) {
        const fullExe = `${full}.exe`;
        if (fs.existsSync(fullExe)) return fullExe;
      }
    }
  }
  return null;
}

export async function executeGitBash(
  command: string,
  cwd: string,
  options: ServerOptions = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const platform = options.platform ?? os.platform();
  const spawnImpl = options.spawnImpl ?? spawn;
  const bashPath = options.bashPath ?? findBashPath();

  return new Promise((resolve, reject) => {
    let child: ChildProcessWithoutNullStreams;
    if (platform === 'win32') {
      if (!bashPath) {
        reject(new Error('git bash path not found'));
        return;
      }
      child = spawnImpl(bashPath, ['-c', command], { cwd }) as ChildProcessWithoutNullStreams;
    } else {
      child = spawnImpl('/bin/sh', ['-c', command], { cwd }) as ChildProcessWithoutNullStreams;
    }

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode ?? 0 });
    });
  });
}

export async function handleRequest(request: McpRequest, options: ServerOptions = {}): Promise<McpResponse> {
  const id = request.id;

  switch (request.method) {
    case 'initialize': {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'lazykimicode-git-bash', version: VERSION },
        },
      };
    }
    case 'initialized':
      return { jsonrpc: '2.0', id };
    case 'tools/list': {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: [
            {
              name: 'git_bash',
              description: 'On Windows, execute a shell command through Git Bash; on other platforms, advise using the native Bash tool.',
              inputSchema: {
                type: 'object',
                properties: {
                  command: { type: 'string', description: 'Shell command to execute' },
                  cwd: { type: 'string', description: 'Working directory' },
                },
                required: ['command'],
              },
            },
          ],
        },
      };
    }
    case 'tools/call': {
      const params = request.params as GitBashCallParams | undefined;
      if (params?.name !== 'git_bash') {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: 'unknown tool' }],
            isError: true,
          },
        };
      }

      const platform = options.platform ?? os.platform();
      const args = params.arguments ?? {};
      const command = String(args.command ?? '');
      const cwd = String(args.cwd ?? process.cwd());

      if (!command) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32602, message: 'Missing command argument' },
        };
      }

      if (platform !== 'win32') {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: `On ${platform}, prefer the native Bash tool. Git Bash MCP is optimized for Windows.`,
              },
            ],
            isError: false,
          },
        };
      }

      const bashPath = options.bashPath ?? findBashPath();
      if (!bashPath) {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify({ error: 'bash not found' }) }],
            isError: true,
          },
        };
      }

      try {
        const { stdout, stderr, exitCode } = await executeGitBash(command, cwd, { ...options, bashPath });
        const content: Array<{ type: string; text: string }> = [];
        if (stdout) content.push({ type: 'text', text: stdout });
        if (stderr) content.push({ type: 'text', text: stderr });
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: content.length ? content : [{ type: 'text', text: '' }],
            isError: exitCode !== 0,
          },
        };
      } catch (e) {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: e instanceof Error ? e.message : String(e) }],
            isError: true,
          },
        };
      }
    }
    default:
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${request.method}` } };
  }
}

export async function runServer(options: ServerOptions = {}): Promise<void> {
  const stdin = process.stdin;
  stdin.setEncoding('utf8');
  let buffer = '';
  stdin.on('data', async (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const request = JSON.parse(trimmed) as McpRequest;
        const response = await handleRequest(request, options);
        process.stdout.write(JSON.stringify(response) + '\n');
      } catch {
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' } }) + '\n');
      }
    }
  });
  await new Promise<void>((resolve) => stdin.on('end', resolve));
}

const modulePath = path.resolve(fileURLToPath(import.meta.url));
const entryPath = path.resolve(process.argv[1] ?? '');
if (modulePath === entryPath) {
  runServer();
}
