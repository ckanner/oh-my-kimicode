import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  isTelemetryDisabled,
  shouldEmitDailyActive,
  getDistinctId,
  getStateFile,
} from '../../../src/shared/telemetry.js';
import { captureDailyActive } from '../../../src/components/telemetry/posthog.js';

describe('telemetry', () => {
  let tmpDir: string;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'telemetry-test-'));
    process.env.OMO_KIMI_STATE_DIR = tmpDir;
    delete process.env.OMO_KIMI_DISABLE_POSTHOG;
    delete process.env.OMO_KIMI_POSTHOG_API_KEY;
    delete process.env.OMO_KIMI_POSTHOG_HOST;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('shared/telemetry', () => {
    it('returns state file in configured dir', () => {
      expect(getStateFile(tmpDir)).toBe(path.join(tmpDir, 'posthog-activity.json'));
    });

    it('disables telemetry via env var', () => {
      process.env.OMO_KIMI_DISABLE_POSTHOG = '1';
      expect(isTelemetryDisabled()).toBe(true);
      expect(shouldEmitDailyActive(tmpDir)).toBe(false);
    });

    it('emits once per day and writes state', () => {
      expect(shouldEmitDailyActive(tmpDir)).toBe(true);
      expect(fs.existsSync(getStateFile(tmpDir))).toBe(true);
      expect(shouldEmitDailyActive(tmpDir)).toBe(false);
    });

    it('produces stable distinct id', () => {
      const id1 = getDistinctId();
      const id2 = getDistinctId();
      expect(id1).toBe(id2);
      expect(id1).toHaveLength(64);
    });
  });

  describe('posthog capture', () => {
    it('skips when default placeholder key is used', async () => {
      const fetchMock = vi.fn();
      const result = await captureDailyActive('abc123', { fetchImpl: fetchMock as unknown as typeof fetch });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.ok).toBe(false);
      expect(result.ok ? '' : result.reason).toContain('placeholder');
    });

    it('skips when telemetry is disabled', async () => {
      process.env.OMO_KIMI_DISABLE_POSTHOG = '1';
      const fetchMock = vi.fn();
      const result = await captureDailyActive('abc123', {
        apiKey: 'real-key',
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.ok).toBe(false);
      expect(result.ok ? '' : result.reason).toContain('disabled');
    });

    it('sends capture request with configured key', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });
      const result = await captureDailyActive('abc123', {
        apiKey: 'test-key',
        host: 'https://test.posthog.example',
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
      expect(result.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://test.posthog.example/capture/');
      expect(init.method).toBe('POST');
      const body = JSON.parse(init.body as string);
      expect(body.api_key).toBe('test-key');
      expect(body.event).toBe('daily_active');
      expect(body.distinct_id).toBe('abc123');
      expect(body.properties.source).toBe('oh-my-kimicode');
    });

    it('reports failure when PostHog returns non-ok', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' });
      const result = await captureDailyActive('abc123', {
        apiKey: 'bad-key',
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
      expect(result.ok).toBe(false);
      expect(result.ok ? '' : result.reason).toBe('PostHog capture failed: 401 Unauthorized');
    });

    it('reports failure when fetch is unavailable', async () => {
      const originalFetch = globalThis.fetch;
      vi.stubGlobal('fetch', undefined);
      try {
        const result = await captureDailyActive('abc123', {
          apiKey: 'test-key',
        });
        expect(result.ok).toBe(false);
        expect(result.ok ? '' : result.reason).toBe('fetch is not available');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('sends when real API key is provided via env', async () => {
      process.env.OMO_KIMI_POSTHOG_API_KEY = 'env-key';
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });
      const result = await captureDailyActive('abc123', {
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
      expect(result.ok).toBe(true);
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.api_key).toBe('env-key');
    });
  });
});
