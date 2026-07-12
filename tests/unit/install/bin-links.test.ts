import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { linkManagedBins, unlinkManagedBins, getBinTargets, MANAGED_BINS } from '../../../src/install/bin-links.js';

describe('bin-links', () => {
  let tmpDir: string;
  let cacheDir: string;
  let binDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bin-links-'));
    cacheDir = path.join(tmpDir, 'cache');
    binDir = path.join(tmpDir, 'bin');
    fs.mkdirSync(cacheDir, { recursive: true });
    for (const { target } of getBinTargets(cacheDir)) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, '#!/usr/bin/env node\n', 'utf-8');
    }
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('links all managed bins that exist', () => {
    const linked = linkManagedBins(cacheDir, binDir);
    expect(linked.sort()).toEqual([...MANAGED_BINS].sort());
    for (const name of MANAGED_BINS) {
      if (process.platform === 'win32') {
        expect(fs.existsSync(path.join(binDir, `${name}.cmd`))).toBe(true);
      } else {
        expect(fs.existsSync(path.join(binDir, name))).toBe(true);
        expect(fs.lstatSync(path.join(binDir, name)).isSymbolicLink()).toBe(true);
      }
    }
  });

  it('skips targets that do not exist', () => {
    fs.rmSync(path.join(cacheDir, 'components', 'codegraph', 'dist', 'serve.mjs'), { force: true });
    const linked = linkManagedBins(cacheDir, binDir);
    expect(linked).not.toContain('codegraph-server');
  });

  it('unlinks managed bins', () => {
    linkManagedBins(cacheDir, binDir);
    const removed = unlinkManagedBins(binDir);
    expect(removed.sort()).toEqual([...MANAGED_BINS].sort());
    for (const name of MANAGED_BINS) {
      expect(fs.existsSync(path.join(binDir, name))).toBe(false);
      expect(fs.existsSync(path.join(binDir, `${name}.cmd`))).toBe(false);
    }
  });

  it('is idempotent on re-link', () => {
    linkManagedBins(cacheDir, binDir);
    if (process.platform === 'win32') {
      const first = fs.readFileSync(path.join(binDir, 'codegraph-server.cmd'), 'utf-8');
      linkManagedBins(cacheDir, binDir);
      const second = fs.readFileSync(path.join(binDir, 'codegraph-server.cmd'), 'utf-8');
      expect(second).toBe(first);
    } else {
      const first = fs.readlinkSync(path.join(binDir, 'codegraph-server'));
      linkManagedBins(cacheDir, binDir);
      const second = fs.readlinkSync(path.join(binDir, 'codegraph-server'));
      expect(second).toBe(first);
    }
  });
});
