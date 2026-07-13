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
  loginShell?: boolean;
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
  const { stdout, stderr, exitCode, timedOut } = await executeRun(command, cwd, 0, { ...options, loginShell: false });
  if (timedOut) {
    return { stdout, stderr: `${stderr}\n[timed out]`.trim(), exitCode: 124 };
  }
  return { stdout, stderr, exitCode };
}

export interface BashResolution {
  found: boolean;
  path: string | null;
  source: string;
  checkedPaths: string[];
  installHint?: string;
}

export function resolveBashPath(options: ServerOptions = {}): BashResolution {
  const platform = options.platform ?? os.platform();
  const checkedPaths: string[] = [];

  if (platform !== 'win32') {
    return { found: true, path: null, source: 'not-required', checkedPaths };
  }

  const envOverride = process.env.LAZYKIMICODE_GIT_BASH_PATH;
  if (envOverride) {
    checkedPaths.push(envOverride);
    if (envOverride.endsWith('bash.exe') && fs.existsSync(envOverride)) {
      return { found: true, path: envOverride, source: 'env', checkedPaths };
    }
  }

  for (const candidate of GIT_BASH_CANDIDATES) {
    checkedPaths.push(candidate);
    if (fs.existsSync(candidate)) {
      return { found: true, path: candidate, source: 'candidate', checkedPaths };
    }
  }

  const pathEnv = process.env.PATH ?? process.env.Path ?? process.env.path ?? '';
  const dirs = pathEnv.split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    const full = path.join(dir, 'bash.exe');
    checkedPaths.push(full);
    if (fs.existsSync(full)) {
      const lower = full.toLowerCase();
      if (lower.includes('\\windows\\system32\\') || lower.includes('\\microsoft\\windowsapps\\')) {
        continue;
      }
      return { found: true, path: full, source: 'path', checkedPaths };
    }
  }

  return {
    found: false,
    path: null,
    source: 'none',
    checkedPaths,
    installHint: 'Git Bash is required on native Windows. Install Git for Windows and ensure bash.exe is on PATH.',
  };
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

export async function executeRun(
  command: string,
  cwd: string,
  timeoutMs: number,
  options: ServerOptions = {},
): Promise<RunResult> {
  const platform = options.platform ?? os.platform();
  const spawnImpl = options.spawnImpl ?? spawn;
  const bashPath = options.bashPath ?? findBashPath();
  const loginShell = options.loginShell ?? true;

  return new Promise((resolve, reject) => {
    let child: ChildProcessWithoutNullStreams;
    const shellFlag = loginShell ? '-lc' : '-c';
    if (platform === 'win32') {
      if (!bashPath) {
        reject(new Error('git bash path not found'));
        return;
      }
      child = spawnImpl(bashPath, [shellFlag, command], { cwd }) as ChildProcessWithoutNullStreams;
    } else {
      child = spawnImpl('/bin/sh', ['-c', command], { cwd }) as ChildProcessWithoutNullStreams;
    }

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });

    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        // Force kill after a grace period if still alive.
        setTimeout(() => child.kill('SIGKILL'), 5000);
      }, timeoutMs);
    }

    child.on('error', (err) => {
      if (timeoutId) clearTimeout(timeoutId);
      reject(err);
    });
    child.on('close', (exitCode, signal) => {
      if (timeoutId) clearTimeout(timeoutId);
      resolve({
        stdout,
        stderr,
        exitCode: exitCode ?? (signal ? 1 : 0),
        timedOut,
      });
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
              name: 'run',
              description: 'Execute a shell command through Git Bash on native Windows. Returns JSON with stdout, stderr, exitCode, and timedOut.',
              inputSchema: {
                type: 'object',
                properties: {
                  command: { type: 'string', description: 'The command to execute.' },
                  timeout: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 1800000,
                    description: 'Optional timeout in milliseconds. Defaults to 120000 (2 minutes).',
                  },
                  workdir: {
                    type: 'string',
                    description: 'The working directory to run the command in. Defaults to the current directory.',
                  },
                  description: {
                    type: 'string',
                    description: 'Clear, concise description of what this command does in 5-10 words.',
                  },
                },
                required: ['command'],
                additionalProperties: false,
              },
            },
            {
              name: 'which_bash',
              description: 'Report how Git Bash was resolved on this platform.',
              inputSchema: {
                type: 'object',
                properties: {},
                additionalProperties: false,
              },
            },
            {
              name: 'diagnose',
              description: 'Diagnose the git_bash MCP readiness on this platform.',
              inputSchema: {
                type: 'object',
                properties: {},
                additionalProperties: false,
              },
            },
            {
              name: 'git_bash',
              description: 'Legacy alias for run. On Windows, execute a shell command through Git Bash; on other platforms, advise using the native Bash tool.',
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
      const toolName = params?.name ?? '';
      const platform = options.platform ?? os.platform();

      if (toolName === 'which_bash') {
        const resolution = resolveBashPath(options);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(resolution) }],
            isError: false,
          },
        };
      }

      if (toolName === 'diagnose') {
        const resolution = resolveBashPath(options);
        const enabled = platform === 'win32' && resolution.found;
        let status: string;
        if (platform !== 'win32') {
          status = 'disabled: run is only exposed on native Windows';
        } else if (enabled) {
          status = 'ready';
        } else {
          status = 'missing-git-bash';
        }
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify({
                platform,
                enabled,
                status,
                resolution,
              }),
            }],
            isError: false,
          },
        };
      }

      if (toolName !== 'run' && toolName !== 'git_bash') {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: 'unknown tool' }],
            isError: true,
          },
        };
      }

      const args = params?.arguments ?? {};
      const command = String(args.command ?? '');
      const cwd = String(args.workdir ?? args.cwd ?? process.cwd());
      const timeoutArg = args.timeout ?? args.timeout_ms;
      const timeoutMs = typeof timeoutArg === 'number' && timeoutArg > 0
        ? Math.min(timeoutArg, 1800000)
        : (toolName === 'run' ? 120000 : 0);

      if (!command) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32602, message: 'Missing command argument' },
        };
      }

      if (platform !== 'win32') {
        if (toolName === 'run') {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: JSON.stringify({ error: 'git_bash run is only available on native Windows.' }) }],
              isError: true,
            },
          };
        }
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
        const { stdout, stderr, exitCode, timedOut } = await executeRun(command, cwd, timeoutMs, { ...options, bashPath, loginShell: toolName === 'run' });
        if (toolName === 'run') {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [{
                type: 'text',
                text: JSON.stringify({ stdout, stderr, exitCode, timedOut }),
              }],
              isError: timedOut || exitCode !== 0,
            },
          };
        }
        const content: Array<{ type: string; text: string }> = [];
        if (stdout) content.push({ type: 'text', text: stdout });
        if (stderr) content.push({ type: 'text', text: stderr });
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: content.length ? content : [{ type: 'text', text: '' }],
            isError: timedOut || exitCode !== 0,
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
