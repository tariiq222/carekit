import * as Sentry from '@sentry/nestjs';

/**
 * Initialize Sentry error tracking.
 * Must be called BEFORE NestFactory.create() — Sentry hooks into Node.js
 * internals that must be patched before the app starts.
 *
 * Does nothing if SENTRY_DSN is not set, so local/dev environments work
 * without any configuration.
 */
export function initSentry(): void {
  const dsn = process.env['SENTRY_DSN'];
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    tracesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.1 : 0,
    enabled: !!dsn,
  });
}
