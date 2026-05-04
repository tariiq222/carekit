import * as Sentry from '@sentry/node';

// Initialise Sentry / GlitchTip error tracking.
// Must be imported as the very first module in main.ts (before NestFactory).
// If SENTRY_DSN is unset the call is a no-op so local dev works without config.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
    release: process.env.SENTRY_RELEASE,
  });
}
