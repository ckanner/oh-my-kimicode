import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

describe('build script', () => {
  it('warns when OMO_KIMI_POSTHOG_API_KEY is missing', () => {
    const env = { ...process.env };
    delete env.OMO_KIMI_POSTHOG_API_KEY;

    const result = spawnSync(
      process.execPath,
      [path.resolve('scripts/build.mjs')],
      { env, encoding: 'utf-8', stdio: 'pipe' },
    );

    const output = `${result.stdout}\n${result.stderr}`;
    expect(output).toContain(
      'Warning: OMO_KIMI_POSTHOG_API_KEY not set. Telemetry will be skipped in this build.',
    );
    expect(result.status).toBe(0);
  }, 120000);
});
