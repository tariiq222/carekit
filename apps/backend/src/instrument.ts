// Must be imported before any other module in main.ts.
// Sentry initializes OpenTelemetry instrumentation here; importing it after
// NestJS/Express would miss spans and cause incomplete traces.
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  integrations: [nodeProfilingIntegration()],
  // Low sample rate in prod to avoid Sentry quota exhaustion; 100% in dev.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  profilesSampleRate: 1.0,
});
