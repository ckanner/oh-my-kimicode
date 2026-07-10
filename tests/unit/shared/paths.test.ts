import { describe, it, expect } from 'vitest';
import { resolveKimiEnv, pluginCacheDir } from '../../../src/shared/paths.js';

describe('paths', () => {
  it('respects KIMI_CODE_HOME', () => {
    const env = resolveKimiEnv({ kimiCodeHome: '/tmp/kimi' });
    expect(env.kimiCodeHome).toBe('/tmp/kimi');
    expect(env.binDir).toBe('/tmp/kimi/bin');
  });

  it('computes default cache dir', () => {
    expect(pluginCacheDir('/tmp/kimi', '0.1.0')).toBe('/tmp/kimi/plugins/cache/oh-my-kimicode/0.1.0');
  });
});
