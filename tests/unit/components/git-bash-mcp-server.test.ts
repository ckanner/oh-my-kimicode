import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';

const modulePath = '../../../src/components/git-bash/mcp-server.js';

describe('git-bash mcp-server findBashPath', () => {
  let existsSyncSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    existsSyncSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    // clear module cache to re-import
    vi.resetModules();
  });

  afterEach(() => {
    existsSyncSpy.mockRestore();
  });

  it('returns the first existing candidate', async () => {
    existsSyncSpy.mockImplementation((p: fs.PathLike) =>
      String(p).includes('Git\\bin\\bash.exe'),
    );
    const { findBashPath } = await import(modulePath);
    expect(findBashPath()).toContain('Git');
  });

  it('returns null when no candidate exists', async () => {
    const { findBashPath } = await import(modulePath);
    expect(findBashPath()).toBeNull();
  });
});
