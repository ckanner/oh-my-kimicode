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

export async function captureEvent(
  distinctId: string,
  event: string,
  options: CaptureOptions = {},
): Promise<void> {
  const apiKey = options.apiKey ?? process.env.OMO_KIMI_POSTHOG_API_KEY ?? DEFAULT_POSTHOG_API_KEY;
  const host = (options.host ?? process.env.OMO_KIMI_POSTHOG_HOST ?? DEFAULT_POSTHOG_HOST).replace(/\/$/, '');

  if (apiKey === DEFAULT_POSTHOG_API_KEY) {
    // No real key configured: silently no-op. Telemetry is opt-out and disabled by default.
    return;
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
    throw new Error('fetch is not available');
  }

  const response = await fetchImpl(`${host}/capture/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`PostHog capture failed: ${response.status} ${response.statusText}`);
  }
}

export async function captureDailyActive(
  distinctId: string,
  options: CaptureOptions = {},
): Promise<void> {
  return captureEvent(distinctId, 'daily_active', options);
}
