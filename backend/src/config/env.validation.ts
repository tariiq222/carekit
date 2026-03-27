import { plainToInstance } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, MinLength, validateSync } from 'class-validator';
import { Logger } from '@nestjs/common';

interface CriticalKey {
  key: string;
  feature: string;
}

const CRITICAL_OPTIONAL_KEYS: CriticalKey[] = [
  { key: 'OPENROUTER_API_KEY', feature: 'AI Chatbot & Receipt Verification' },
  { key: 'MOYASAR_API_KEY', feature: 'Electronic Payments (Moyasar)' },
  { key: 'MOYASAR_WEBHOOK_SECRET', feature: 'Payment Webhook Verification' },
  { key: 'MINIO_ENDPOINT', feature: 'File Storage (MinIO)' },
  { key: 'MINIO_ACCESS_KEY', feature: 'File Storage (MinIO)' },
  { key: 'MINIO_SECRET_KEY', feature: 'File Storage (MinIO)' },
  { key: 'MAIL_HOST', feature: 'Email Sending' },
  { key: 'MAIL_USER', feature: 'Email Sending' },
  { key: 'MAIL_PASSWORD', feature: 'Email Sending' },
  { key: 'ZOOM_ACCOUNT_ID', feature: 'Video Consultations (Zoom)' },
  { key: 'ZOOM_CLIENT_ID', feature: 'Video Consultations (Zoom)' },
  { key: 'ZOOM_CLIENT_SECRET', feature: 'Video Consultations (Zoom)' },
  { key: 'FIREBASE_PROJECT_ID', feature: 'Push Notifications (FCM)' },
  { key: 'FIREBASE_CLIENT_EMAIL', feature: 'Push Notifications (FCM)' },
  { key: 'FIREBASE_PRIVATE_KEY', feature: 'Push Notifications (FCM)' },
  { key: 'SMS_PROVIDER', feature: 'SMS Notifications' },
  { key: 'SMS_API_KEY', feature: 'SMS Notifications' },
  { key: 'METRICS_TOKEN', feature: 'Prometheus Metrics Endpoint (access will be blocked without it)' },
];

export function logMissingOptionalKeys(
  config: Record<string, unknown>,
): void {
  const missing = CRITICAL_OPTIONAL_KEYS.filter(({ key }) => !config[key]);
  if (missing.length === 0) return;

  const logger = new Logger('EnvValidation');
  logger.warn('=== Missing Optional Environment Variables ===');
  for (const { key, feature } of missing) {
    logger.warn(`  ${key} — required for: ${feature}`);
  }
  logger.warn('These features will fail at runtime until configured.');
  logger.warn('===============================================');

  // In production, if Moyasar payments are enabled but webhook secret is missing,
  // all webhooks will fail silently — block startup to prevent money loss
  if (config['NODE_ENV'] === 'production' && config['MOYASAR_API_KEY'] && !config['MOYASAR_WEBHOOK_SECRET']) {
    throw new Error(
      'FATAL: MOYASAR_API_KEY is set but MOYASAR_WEBHOOK_SECRET is missing. '
      + 'All payment webhooks will be rejected. Set the webhook secret or remove the API key.',
    );
  }

  // In production, missing METRICS_TOKEN means the /metrics endpoint is permanently blocked.
  // Prometheus scraping will silently fail, alerting and monitoring will be dark.
  if (config['NODE_ENV'] === 'production' && !config['METRICS_TOKEN']) {
    throw new Error(
      'FATAL: METRICS_TOKEN is not set in production. '
      + 'The /metrics endpoint will be permanently blocked and Prometheus cannot scrape. '
      + 'Set METRICS_TOKEN to enable observability.',
    );
  }
}

export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  REDIS_URL!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(32)
  JWT_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(32)
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRATION?: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRATION?: string;

  @IsString()
  @IsOptional()
  MINIO_ENDPOINT?: string;

  @IsString()
  @IsOptional()
  MINIO_ACCESS_KEY?: string;

  @IsString()
  @IsOptional()
  MINIO_SECRET_KEY?: string;

  @IsString()
  @IsOptional()
  MINIO_BUCKET?: string;

  @IsString()
  @IsOptional()
  MAIL_HOST?: string;

  @IsString()
  @IsOptional()
  MAIL_PORT?: string;

  @IsString()
  @IsOptional()
  MAIL_USER?: string;

  @IsString()
  @IsOptional()
  MAIL_PASSWORD?: string;

  @IsString()
  @IsOptional()
  MAIL_FROM?: string;

  @IsString()
  @IsOptional()
  OPENROUTER_API_KEY?: string;

  @IsString()
  @IsOptional()
  MOYASAR_API_KEY?: string;

  @IsString()
  @IsOptional()
  MOYASAR_WEBHOOK_SECRET?: string;

  @IsString()
  @IsOptional()
  BACKEND_URL?: string;

  @IsString()
  @IsOptional()
  ALLOWED_ORIGINS?: string;

  @IsString()
  @IsOptional()
  NODE_ENV?: string;

  @IsString()
  @IsOptional()
  MINIO_PORT?: string;

  @IsString()
  @IsOptional()
  MINIO_USE_SSL?: string;

  @IsString()
  @IsOptional()
  FIREBASE_PROJECT_ID?: string;

  @IsString()
  @IsOptional()
  FIREBASE_CLIENT_EMAIL?: string;

  @IsString()
  @IsOptional()
  FIREBASE_PRIVATE_KEY?: string;

  @IsString()
  @IsOptional()
  ZOOM_ACCOUNT_ID?: string;

  @IsString()
  @IsOptional()
  ZOOM_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  ZOOM_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  COOKIE_DOMAIN?: string;

  @IsString()
  @IsOptional()
  SENTRY_DSN?: string;

  @IsString()
  @IsOptional()
  SMS_PROVIDER?: string;

  @IsString()
  @IsOptional()
  SMS_API_KEY?: string;

  @IsString()
  @IsOptional()
  SMS_SENDER_ID?: string;

  @IsString()
  @IsOptional()
  METRICS_TOKEN?: string;
}

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors.map((e) => Object.values(e.constraints ?? {}).join(', ')).join('\n')}`,
    );
  }

  logMissingOptionalKeys(config);

  return validatedConfig;
}
