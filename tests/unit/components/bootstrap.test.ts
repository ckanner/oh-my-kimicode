import { describe, it, expect } from 'vitest';
import { runSessionStart } from '../../../src/components/bootstrap/session-start.js';

describe('bootstrap', () => {
  it('returns session-start context', () => {
    const out = runSessionStart({ hookEventName: 'SessionStart' });
    expect(out.hookSpecificOutput?.hookEventName).toBe('SessionStart');
    expect(out.hookSpecificOutput?.additionalContext).toContain('Bootstrap');
  });
});
