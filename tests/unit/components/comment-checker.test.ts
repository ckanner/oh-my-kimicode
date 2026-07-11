import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { checkFile, findStaleMarkers } from '../../../src/components/comment-checker/check.js';

describe('comment-checker', () => {
  let tmp: string;
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-')); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('detects TODO in source', () => {
    const p = path.join(tmp, 'a.ts');
    fs.writeFileSync(p, '// TODO: fix this\nconst x = 1;\n');
    const r = checkFile(p);
    expect(r.hasIssue).toBe(true);
    expect(r.matches).toHaveLength(1);
  });

  it('detects FIXME, HACK, XXX, BUG in block comments and hash comments', () => {
    const p = path.join(tmp, 'b.py');
    fs.writeFileSync(p, `# FIXME: now\n/* HACK */\n// XXX\n# BUG here\n`);
    const r = checkFile(p);
    expect(r.hasIssue).toBe(true);
    expect(r.matches.length).toBeGreaterThanOrEqual(3);
  });

  it('passes clean files', () => {
    const p = path.join(tmp, 'c.ts');
    fs.writeFileSync(p, 'const x = 1;\n');
    const r = checkFile(p);
    expect(r.hasIssue).toBe(false);
    expect(r.matches).toHaveLength(0);
  });

  it('ignores TODO inside string literals', () => {
    const p = path.join(tmp, 'd.ts');
    fs.writeFileSync(p, 'const msg = "TODO: not a marker";\n');
    const r = checkFile(p);
    expect(r.hasIssue).toBe(false);
  });

  it('ignores markers inside URLs', () => {
    const p = path.join(tmp, 'url.ts');
    fs.writeFileSync(p, 'const url = "https://example.com/TODO#FIXME";\n');
    const r = checkFile(p);
    expect(r.hasIssue).toBe(false);
  });

  it('still detects TODO after a real line comment', () => {
    const p = path.join(tmp, 'real-comment.ts');
    fs.writeFileSync(p, 'const x = 1; // TODO: real marker\n');
    const r = checkFile(p);
    expect(r.hasIssue).toBe(true);
    expect(r.matches).toContain('TODO');
  });

  it('returns empty result for missing file', () => {
    const r = checkFile(path.join(tmp, 'missing.ts'));
    expect(r.hasIssue).toBe(false);
    expect(r.matches).toHaveLength(0);
  });

  it('detects TODO in block comments', () => {
    const content = 'function foo() {\n  /* TODO: fix this */\n}';
    const markers = findStaleMarkers(content);
    expect(markers).toHaveLength(1);
    expect(markers[0].marker).toBe('TODO');
  });

  it('detects FIXME in HTML-style comments', () => {
    const content = '<!-- FIXME: broken -->';
    const markers = findStaleMarkers(content);
    expect(markers).toHaveLength(1);
    expect(markers[0].marker).toBe('FIXME');
  });

  it('ignores block comment markers inside string literals', () => {
    const content = 'const s = "/* TODO */";';
    const markers = findStaleMarkers(content);
    expect(markers).toHaveLength(0);
  });

  it('ignores block comment markers inside single-quoted strings', () => {
    const content = "const s = '/* FIXME */';";
    const markers = findStaleMarkers(content);
    expect(markers).toHaveLength(0);
  });

  it('does not double-report the same marker on the same line', () => {
    const content = '// TODO /* TODO */';
    const markers = findStaleMarkers(content);
    expect(markers.filter((m) => m.marker === 'TODO')).toHaveLength(1);
  });
});
