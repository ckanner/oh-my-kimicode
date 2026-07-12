import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { recommendGitBash } from '../../../src/components/git-bash/recommend.js';
import { handleRequest, executeGitBash, findBashPath } from '../../../src/components/git-bash/mcp-server.js';

function createMockSpawn(stdout: string, stderr: string, exitCode: number) {
  return vi.fn((_cmd: string, _args: string[], _opts: unknown) => {
    const child = new EventEmitter() as unknown as ChildProcessWithoutNullStreams;
    const stdoutEmitter = new EventEmitter() as unknown as { setEncoding: ReturnType<typeof vi.fn>; on: EventEmitter['on']; emit: EventEmitter['emit'] };
    const stderrEmitter = new EventEmitter() as unknown as { setEncoding: ReturnType<typeof vi.fn>; on: EventEmitter['on']; emit: EventEmitter['emit'] };
    stdoutEmitter.setEncoding = vi.fn();
    stderrEmitter.setEncoding = vi.fn();
    child.stdout = stdoutEmitter as unknown as ChildProcessWithoutNullStreams['stdout'];
    child.stderr = stderrEmitter as unknown as ChildProcessWithoutNullStreams['stderr'];
    setImmediate(() => {
      stdoutEmitter.emit('data', stdout);
      stderrEmitter.emit('data', stderr);
      child.emit('close', exitCode);
    });
    return child;
  });
}

describe('git-bash', () => {
  let existsSyncSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    existsSyncSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
  });

  afterEach(() => {
    existsSyncSpy.mockRestore();
  });

  describe('recommend hook', () => {
    it('returns empty context on non-Windows', () => {
      const out = recommendGitBash({ hookEventName: 'PreToolUse' }, 'darwin');
      expect(out.message).toBeUndefined();
    });

    it('recommends git bash on Windows', () => {
      const out = recommendGitBash({ hookEventName: 'PreToolUse' }, 'win32');
      expect(out.message).toContain('git_bash MCP');
    });
  });

  describe('MCP server', () => {
    it('responds to initialize', async () => {
      const response = await handleRequest({ jsonrpc: '2.0', id: 1, method: 'initialize' });
      expect(response.id).toBe(1);
      expect((response.result as Record<string, unknown>).protocolVersion).toBe('2024-11-05');
    });

    it('lists git_bash tool', async () => {
      const response = await handleRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
      const tools = (response.result as { tools: Array<{ name: string }> }).tools;
      expect(tools.map((t) => t.name)).toContain('git_bash');
    });

    it('rejects unknown tool', async () => {
      const response = await handleRequest({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'unknown' },
      });
      const result = response.result as { content: Array<{ text: string }>; isError: boolean };
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('unknown tool');
    });

    it('returns recommendation on non-Windows', async () => {
      const response = await handleRequest(
        {
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: { name: 'git_bash', arguments: { command: 'echo hi' } },
        },
        { platform: 'darwin' },
      );
      const text = (response.result as { content: Array<{ text: string }> }).content[0].text;
      expect(text).toContain('prefer the native Bash tool');
    });

    it('executes command on Windows via mock spawn', async () => {
      const spawnMock = createMockSpawn('hello\n', '', 0);
      const response = await handleRequest(
        {
          jsonrpc: '2.0',
          id: 5,
          method: 'tools/call',
          params: { name: 'git_bash', arguments: { command: 'echo hello' } },
        },
        { platform: 'win32', spawnImpl: spawnMock as unknown as typeof import('node:child_process').spawn, bashPath: 'bash.exe' },
      );
      expect(spawnMock).toHaveBeenCalledWith('bash.exe', ['-c', 'echo hello'], expect.objectContaining({ cwd: expect.any(String) }));
      const result = response.result as { content: Array<{ text: string }>; isError: boolean };
      expect(result.content[0].text).toBe('hello\n');
      expect(result.isError).toBe(false);
    });

    it('captures stderr and non-zero exit', async () => {
      const spawnMock = createMockSpawn('', 'oops', 1);
      const response = await handleRequest(
        {
          jsonrpc: '2.0',
          id: 6,
          method: 'tools/call',
          params: { name: 'git_bash', arguments: { command: 'exit 1' } },
        },
        { platform: 'win32', spawnImpl: spawnMock as unknown as typeof import('node:child_process').spawn, bashPath: 'bash.exe' },
      );
      const result = response.result as { content: Array<{ text: string }>; isError: boolean };
      expect(result.content.map((c) => c.text)).toContain('oops');
      expect(result.isError).toBe(true);
    });

    it('returns error when bash is not found on Windows', async () => {
      const response = await handleRequest(
        {
          jsonrpc: '2.0',
          id: 7,
          method: 'tools/call',
          params: { name: 'git_bash', arguments: { command: 'echo hello' } },
        },
        { platform: 'win32' },
      );
      const result = response.result as { content: Array<{ text: string }>; isError: boolean };
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('bash not found');
    });

    it('findBashPath returns null when no candidate exists', () => {
      expect(findBashPath()).toBeNull();
    });

    it('findBashPath returns the first existing candidate', () => {
      existsSyncSpy.mockImplementation((p: fs.PathLike) => String(p) === 'bash.exe');
      expect(findBashPath()).toBe('bash.exe');
    });
  });

  describe('executeGitBash', () => {
    it('resolves with output from mocked spawn', async () => {
      const spawnMock = createMockSpawn('out', 'err', 0);
      const result = await executeGitBash('cmd', '/tmp', {
        platform: 'win32',
        spawnImpl: spawnMock as unknown as typeof import('node:child_process').spawn,
        bashPath: 'bash.exe',
      });
      expect(result.stdout).toBe('out');
      expect(result.stderr).toBe('err');
      expect(result.exitCode).toBe(0);
    });

    it('rejects when bash path missing on Windows', async () => {
      await expect(
        executeGitBash('cmd', '/tmp', { platform: 'win32', bashPath: '' }),
      ).rejects.toThrow('git bash path not found');
    });
  });
});
