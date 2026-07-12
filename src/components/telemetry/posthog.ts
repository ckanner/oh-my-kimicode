import { VERSION } from '../../shared/version.js';
import { getEnv, isTelemetryDisabled } from '../../shared/env.js';

export const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';

// Public project API key; safe to ship in client-side code.
// Override via LAZYKIMICODE_POSTHOG_API_KEY env var (OMO_KIMI_POSTHOG_API_KEY fallback).
export const DEFAULT_POSTHOG_API_KEY = 'phc_placeholder_replace_in_build';

export interface CaptureOptions {
  apiKey?: string;
  host?: string;
  fetchImpl?: typeof fetch;
}

export interface PostHogCaptureBody {
  api_key: string;
  event: string;
  distinct_id: string;
  properties: Record<string, unknown>;
}

export type CaptureResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function captureEvent(
  distinctId: string,
  event: string,
  options: CaptureOptions = {},
): Promise<CaptureResult> {
  if (isTelemetryDisabled()) {
    return { ok: false, reason: 'telemetry disabled by LAZYKIMICODE_DISABLE_POSTHOG' };
  }

  const apiKey = options.apiKey ?? getEnv('POSTHOG_API_KEY') ?? DEFAULT_POSTHOG_API_KEY;
  const host = (options.host ?? getEnv('POSTHOG_HOST') ?? DEFAULT_POSTHOG_HOST).replace(/\/$/, '');

  if (apiKey === DEFAULT_POSTHOG_API_KEY) {
    return { ok: false, reason: 'PostHog API key is the placeholder; telemetry skipped' };
  }

  const body: PostHogCaptureBody = {
    api_key: apiKey,
    event,
    distinct_id: distinctId,
    properties: {
      source: 'lazykimicode',
      version: getEnv('VERSION') ?? process.env.npm_package_version ?? VERSION,
    },
  };

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) {
    return { ok: false, reason: 'fetch is not available' };
  }

  try {
    const response = await fetchImpl(`${host}/capture/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return { ok: false, reason: `PostHog capture failed: ${response.status} ${response.statusText}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `PostHog capture error: ${(err as Error).message}` };
  }
}

export async function captureDailyActive(
  distinctId: string,
  options: CaptureOptions = {},
): Promise<CaptureResult> {
  return captureEvent(distinctId, 'daily_active', options);
}
