import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const SERVER = path.resolve('plugin/components/codegraph/dist/serve.mjs');

describe('codegraph serve', () => {
  it('lists all codegraph tools', () => {
    const result = spawnSync('node', [SERVER], {
      input: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) + '\n',
      encoding: 'utf-8',
    });
    expect(result.status).toBe(0);
    const tools = JSON.parse(result.stdout).result.tools.map((t: { name: string }) => t.name);
    expect(tools).toContain('codegraph_search');
    expect(tools).toContain('codegraph_status');
    expect(tools).toContain('codegraph_reindex');
  });

  it('returns error for unknown tool', () => {
    const result = spawnSync('node', [SERVER], {
      input: JSON.stringify({
        jsonrpc: '2.0', id: 2, method: 'tools/call',
        params: { name: 'unknown', arguments: {} },
      }) + '\n',
      encoding: 'utf-8',
    });
    expect(result.status).toBe(0);
    const response = JSON.parse(result.stdout);
    expect(response.result.isError).toBe(true);
  });
});
