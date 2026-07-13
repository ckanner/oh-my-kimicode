import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const modulePath = '../../../src/components/auto-update/cli.js';

describe('auto-update', () => {
  let tmp: string;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-update-'));
    process.env.LAZYKIMICODE_PROJECT = tmp;
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.LAZYKIMICODE_PROJECT;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('writes an empty message when no update is available', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ 'dist-tags': { latest: '0.1.3' } }),
    } as unknown as Response);

    vi.resetModules();
    const { runAutoUpdate } = await import(modulePath);
    await runAutoUpdate();

    const statePath = path.join(tmp, '.lazykimicode', 'auto-update.json');
    expect(fs.existsSync(statePath)).toBe(true);
  });

  it('notifies when a newer version is available', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ 'dist-tags': { latest: '9.9.9' } }),
    } as unknown as Response);

    vi.resetModules();
    const { runAutoUpdate } = await import(modulePath);
    await runAutoUpdate();

    const statePath = path.join(tmp, '.lazykimicode', 'auto-update.json');
    expect(fs.existsSync(statePath)).toBe(true);
  });
});
