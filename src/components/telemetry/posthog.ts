export const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';

// Public project API key; safe to ship in client-side code.
// Override via OMO_KIMI_POSTHOG_API_KEY env var.
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
  if (
    process.env.OMO_KIMI_DISABLE_POSTHOG === '1' ||
    process.env.OMO_DISABLE_POSTHOG === '1'
  ) {
    return { ok: false, reason: 'telemetry disabled by OMO_KIMI_DISABLE_POSTHOG' };
  }

  const apiKey = options.apiKey ?? process.env.OMO_KIMI_POSTHOG_API_KEY ?? DEFAULT_POSTHOG_API_KEY;
  const host = (options.host ?? process.env.OMO_KIMI_POSTHOG_HOST ?? DEFAULT_POSTHOG_HOST).replace(/\/$/, '');

  if (apiKey === DEFAULT_POSTHOG_API_KEY) {
    return { ok: false, reason: 'PostHog API key is the placeholder; telemetry skipped' };
  }

  const body: PostHogCaptureBody = {
    api_key: apiKey,
    event,
    distinct_id: distinctId,
    properties: {
      source: 'oh-my-kimicode',
      version: process.env.npm_package_version ?? '0.1.0',
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
