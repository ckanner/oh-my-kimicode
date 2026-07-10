import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseFile, inferLanguageId } from '../../../src/components/codegraph/symbols.js';
import { buildIndex, loadIndex, saveIndex, indexPath, listProjectFiles } from '../../../src/components/codegraph/indexer.js';
import { search, relate } from '../../../src/components/codegraph/search.js';
import { runBootstrap } from '../../../src/components/codegraph/bootstrap.js';

describe('codegraph', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('symbols', () => {
    it('infers language id from file extension', () => {
      expect(inferLanguageId('foo.ts')).toBe('.ts');
      expect(inferLanguageId('bar/baz.py')).toBe('.py');
    });

    it('parses TypeScript symbols', () => {
      const content = `
export async function fetchData() { return 1; }
class UserService { }
export const PI = 3.14;
export interface Config { }
export type ID = string;
`;
      const symbols = parseFile('sample.ts', content);
      const names = symbols.map((s) => `${s.name}:${s.kind}`);
      expect(names).toContain('fetchData:function');
      expect(names).toContain('UserService:class');
      expect(names).toContain('PI:variable');
      expect(names).toContain('Config:type');
      expect(names).toContain('ID:type');
      expect(symbols.find((s) => s.name === 'fetchData')?.line).toBeGreaterThan(0);
    });

    it('parses Python symbols', () => {
      const content = `
def helper(): pass
class MyClass:
    def method(self): pass
`;
      const symbols = parseFile('sample.py', content);
      expect(symbols.map((s) => s.name)).toContain('helper');
      expect(symbols.map((s) => s.name)).toContain('MyClass');
    });

    it('parses Go symbols', () => {
      const content = `
func Add(a, b int) int { return a + b }
type Item struct { Name string }
`;
      const symbols = parseFile('sample.go', content);
      expect(symbols.map((s) => s.name)).toContain('Add');
      expect(symbols.map((s) => s.name)).toContain('Item');
    });

    it('parses Rust symbols', () => {
      const content = `
fn run() {}
struct Point { x: i32 }
impl Point {}
`;
      const symbols = parseFile('sample.rs', content);
      expect(symbols.map((s) => s.name)).toContain('run');
      expect(symbols.map((s) => s.name)).toContain('Point');
    });

    it('returns empty array for unsupported language', () => {
      expect(parseFile('file.rb', 'def foo; end')).toEqual([]);
    });
  });

  describe('indexer', () => {
    it('lists supported project files and skips ignored dirs', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, 'node_modules'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'src', 'a.ts'), 'function a() {}');
      fs.writeFileSync(path.join(tmpDir, 'node_modules', 'b.ts'), 'function b() {}');
      const files = listProjectFiles(tmpDir);
      expect(files).toContain(path.join('src', 'a.ts'));
      expect(files).not.toContain(path.join('node_modules', 'b.ts'));
    });

    it('builds index from project files', () => {
      fs.writeFileSync(path.join(tmpDir, 'math.ts'), 'export function add(a: number, b: number) { return a + b; }');
      fs.writeFileSync(path.join(tmpDir, 'main.py'), 'def main(): pass');
      const index = buildIndex(tmpDir);
      expect(index.version).toBe('1');
      expect(index.symbols.map((s) => s.name)).toContain('add');
      expect(index.symbols.map((s) => s.name)).toContain('main');
      expect(index.byFile['math.ts']).toHaveLength(1);
      expect(index.byFile['main.py']).toHaveLength(1);
    });

    it('saves and loads index', () => {
      const index = buildIndex(tmpDir);
      saveIndex(tmpDir, index);
      expect(fs.existsSync(indexPath(tmpDir))).toBe(true);
      const loaded = loadIndex(tmpDir);
      expect(loaded).toEqual(index);
    });
  });

  describe('search', () => {
    it('searches by query, kind and file', () => {
      const index = {
        version: '1',
        symbols: [
          { name: 'fetchUser', kind: 'function' as const, file: 'api.ts', line: 1, column: 1 },
          { name: 'User', kind: 'class' as const, file: 'models.ts', line: 1, column: 1 },
          { name: 'fetchOrder', kind: 'function' as const, file: 'api.ts', line: 5, column: 1 },
        ],
        byFile: {},
      };
      expect(search(index, { query: 'fetch' }).map((s) => s.name)).toEqual(['fetchUser', 'fetchOrder']);
      expect(search(index, { query: 'fetch', kind: 'function', file: 'api.ts' }).map((s) => s.name)).toEqual(['fetchUser', 'fetchOrder']);
      expect(search(index, { kind: 'class' }).map((s) => s.name)).toEqual(['User']);
    });

    it('relates symbols by shared file', () => {
      const index = {
        version: '1',
        symbols: [
          { name: 'alpha', kind: 'function' as const, file: 'a.ts', line: 1, column: 1 },
          { name: 'beta', kind: 'function' as const, file: 'a.ts', line: 2, column: 1 },
          { name: 'gamma', kind: 'function' as const, file: 'b.ts', line: 1, column: 1 },
        ],
        byFile: {},
      };
      const related = relate(index, 'alpha');
      expect(related.map((s) => s.name).sort()).toEqual(['alpha', 'beta']);
    });

    it('returns empty relate when symbol not found', () => {
      const index = { version: '1', symbols: [], byFile: {} };
      expect(relate(index, 'missing')).toEqual([]);
    });
  });

  describe('bootstrap', () => {
    it('returns bootstrap context', () => {
      const out = runBootstrap({ hookEventName: 'SessionStart' });
      expect(out.hookSpecificOutput?.hookEventName).toBe('SessionStart');
      expect(out.hookSpecificOutput?.additionalContext).toContain('CodeGraph');
    });

    it('builds and saves index when none exists', () => {
      fs.writeFileSync(path.join(tmpDir, 'calc.ts'), 'export function sum(a: number, b: number) { return a + b; }');
      const originalCwd = process.cwd();
      process.chdir(tmpDir);
      try {
        runBootstrap({ hookEventName: 'SessionStart' });
        expect(fs.existsSync(indexPath(tmpDir))).toBe(true);
        const loaded = loadIndex(tmpDir);
        expect(loaded?.symbols.map((s) => s.name)).toContain('sum');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});
