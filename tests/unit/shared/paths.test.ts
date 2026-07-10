import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { resolveKimiEnv, pluginCacheDir } from '../../../src/shared/paths.js';

describe('paths', () => {
  it('respects KIMI_CODE_HOME', () => {
    const home = path.join('/tmp', 'kimi');
    const env = resolveKimiEnv({ kimiCodeHome: home });
    expect(env.kimiCodeHome).toBe(home);
    expect(env.binDir).toBe(path.join(home, 'bin'));
  });

  it('computes default cache dir', () => {
    const home = path.join('/tmp', 'kimi');
    expect(pluginCacheDir(home, '0.1.0')).toBe(
      path.join(home, 'plugins', 'cache', 'oh-my-kimicode', '0.1.0'),
    );
  });
});
