import { describe, it, expect } from 'vitest';
import { getDistinctId, isTelemetryDisabled } from '../../../src/shared/telemetry.js';

describe('telemetry', () => {
  it('produces a stable distinct id', () => {
    expect(getDistinctId()).toBe(getDistinctId());
    expect(getDistinctId()).toHaveLength(64);
  });

  it('respects disable env var', () => {
    const original = process.env.OMO_KIMI_DISABLE_POSTHOG;
    process.env.OMO_KIMI_DISABLE_POSTHOG = '1';
    expect(isTelemetryDisabled()).toBe(true);
    process.env.OMO_KIMI_DISABLE_POSTHOG = original;
  });
});
