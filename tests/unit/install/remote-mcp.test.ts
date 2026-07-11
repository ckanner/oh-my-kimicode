import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../..');

describe('remote MCP defaults', () => {
  it('provides a root .mcp.json matching plugin/.mcp.json', () => {
    const rootMcp = path.join(ROOT, '.mcp.json');
    const pluginMcp = path.join(ROOT, 'plugin', '.mcp.json');
    expect(fs.existsSync(rootMcp)).toBe(true);
    const root = JSON.parse(fs.readFileSync(rootMcp, 'utf-8'));
    const plugin = JSON.parse(fs.readFileSync(pluginMcp, 'utf-8'));
    expect(root).toEqual(plugin);
  });

  it('keeps remote MCPs disabled by default', () => {
    const rootMcp = path.join(ROOT, '.mcp.json');
    const root = JSON.parse(fs.readFileSync(rootMcp, 'utf-8'));
    for (const [, cfg] of Object.entries(root)) {
      expect((cfg as { enabled?: boolean }).enabled).toBe(false);
    }
  });

  it('each entry has url and note', () => {
    const rootMcp = path.join(ROOT, '.mcp.json');
    const root = JSON.parse(fs.readFileSync(rootMcp, 'utf-8'));
    for (const [name, cfg] of Object.entries(root)) {
      const c = cfg as { url?: string; note?: string };
      expect(c.url, `${name} missing url`).toBeTruthy();
      expect(c.note, `${name} missing note`).toBeTruthy();
    }
  });
});
