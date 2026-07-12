import { describe, it, expect } from 'vitest';
import { detectUltrawork } from '../../../src/components/ultrawork/detect.js';

describe('ultrawork', () => {
  it('injects context on "ulw" keyword', () => {
    const out = detectUltrawork({ hookEventName: 'UserPromptSubmit', prompt: 'ulw add auth' });
    expect(out.message).toContain('ULTRAWORK');
  });

  it('injects context on "ultrawork" keyword case-insensitively', () => {
    const out = detectUltrawork({ hookEventName: 'UserPromptSubmit', prompt: 'Please ULTRAWORK this refactor' });
    expect(out.message).toContain('ULTRAWORK');
  });

  it('is silent otherwise', () => {
    const out = detectUltrawork({ hookEventName: 'UserPromptSubmit', prompt: 'hello' });
    expect(out.message).toBeUndefined();
  });

  it('handles empty prompt', () => {
    const out = detectUltrawork({ hookEventName: 'UserPromptSubmit' });
    expect(out.message).toBeUndefined();
  });
});
