import { PostHog } from 'posthog-node';

let _client: PostHog | null = null;

export function getPostHogClient(): PostHog | null {
  if (!process.env.POSTHOG_API_KEY) return null;
  if (!_client) {
    _client = new PostHog(process.env.POSTHOG_API_KEY, {
      host: process.env.POSTHOG_HOST ?? 'https://eu.i.posthog.com',
      flushAt: 20,
      flushInterval: 10_000,
    });
  }
  return _client;
}

export function captureException(
  err: unknown,
  properties?: Record<string, unknown>,
): void {
  const client = getPostHogClient();
  if (!client) return;
  const error = err instanceof Error ? err : new Error(String(err));
  client.capture({
    distinctId: 'server',
    event: '$exception',
    properties: {
      $exception_type: error.name,
      $exception_message: error.message,
      $exception_stack_trace_raw: error.stack,
      ...properties,
    },
  });
}
