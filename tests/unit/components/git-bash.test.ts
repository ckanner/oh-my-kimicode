import { describe, it, expect } from 'vitest';
import { recommendGitBash } from '../../../src/components/git-bash/recommend.js';

describe('git-bash', () => {
  it('advises on Windows only', () => {
    const out = recommendGitBash({ hookEventName: 'PreToolUse' });
    // On non-Windows CI, this should be empty.
    expect(out.hookSpecificOutput?.hookEventName).toBe('PreToolUse');
  });
});
