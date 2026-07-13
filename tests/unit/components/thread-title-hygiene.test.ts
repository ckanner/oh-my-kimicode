import { describe, it, expect } from 'vitest';
import { runThreadTitleHygiene } from '../../../src/components/thread-title-hygiene/cli.js';

describe('thread-title-hygiene', () => {
  it('writes a hygiene reminder', () => {
    const originalWrite = process.stdout.write;
    let captured = '';
    process.stdout.write = ((chunk: string) => {
      captured += chunk;
      return true;
    }) as typeof process.stdout.write;
    try {
      runThreadTitleHygiene();
    } finally {
      process.stdout.write = originalWrite;
    }
    expect(captured).toContain('descriptive');
    expect(captured).toContain('thread title');
  });
});
