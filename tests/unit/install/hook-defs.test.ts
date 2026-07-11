import { describe, it, expect } from 'vitest';
import { getHookDefs } from '../../../src/install/hook-defs.js';

describe('getHookDefs', () => {
  it('registers codegraph SessionStart and PostToolUse hooks', () => {
    const hooks = getHookDefs('0.1.3', '/tmp/cache');
    const events = hooks
      .filter((h) => h.command.includes('/codegraph/'))
      .map((h) => h.event);
    expect(events).toContain('SessionStart');
    expect(events).toContain('PostToolUse');
  });

  it('registers hooks for every component that has a hooks.json', () => {
    const hooks = getHookDefs('0.1.3', '/tmp/cache');
    const names = new Set(
      hooks.map((h) => {
        const match = /components\/([^/]+)\/dist\/cli\.mjs/.exec(h.command);
        return match?.[1];
      }).filter(Boolean),
    );
    expect(names).toContain('codegraph');
    expect(names).toContain('bootstrap');
    expect(names).toContain('rules');
    expect(names).toContain('lsp');
  });
});
