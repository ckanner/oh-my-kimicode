import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readBoulder, hasIncompleteWork } from '../../../src/components/start-work-continuation/boulder.js';

describe('start-work-continuation', () => {
  let tmp: string;
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'boulder-')); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('detects incomplete work', () => {
    fs.mkdirSync(path.join(tmp, '.omo'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.omo', 'boulder.json'), JSON.stringify({ active_work_id: 'x', works: { x: { completed: false } } }));
    expect(hasIncompleteWork(readBoulder(tmp))).toBe(true);
  });

  it('passes when work is completed', () => {
    fs.mkdirSync(path.join(tmp, '.omo'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.omo', 'boulder.json'), JSON.stringify({ active_work_id: 'x', works: { x: { completed: true } } }));
    expect(hasIncompleteWork(readBoulder(tmp))).toBe(false);
  });

  it('passes when no active work', () => {
    expect(hasIncompleteWork(readBoulder(tmp))).toBe(false);
  });

  it('passes when file is malformed', () => {
    fs.mkdirSync(path.join(tmp, '.omo'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.omo', 'boulder.json'), 'not json');
    expect(() => readBoulder(tmp)).toThrow();
  });
});
