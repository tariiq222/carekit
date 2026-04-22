import * as Joi from 'joi';

/**
 * Boot-time validation for process.env.
 *
 * Rules:
 * - Only variables declared here are trusted. Unknown keys pass through
 *   but are not validated.
 * - NestJS ConfigModule calls this schema once at startup and aborts the
 *   app if any required variable is missing or malformed.
 * - Keep this file flat: one Joi schema, no typed getters. Typed config
 *   namespaces are added per bounded context when that BC is implemented.
 *
 * Spec reference: apps/backend/.env.example
 */
export const envValidationSchema = Joi.object({
  // Runtime
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),
  PORT: Joi.number().port().default(5100),

  // Database (Prisma)
  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),

  // Redis (BullMQ + cache + token blacklist)
  REDIS_HOST: Joi.string().hostname().required(),
  REDIS_PORT: Joi.number().port().required(),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().integer().min(0).max(15).default(0),

  // MinIO (object storage)
  MINIO_ENDPOINT: Joi.string().hostname().required(),
  MINIO_PORT: Joi.number().port().required(),
  MINIO_ACCESS_KEY: Joi.string().required(),
  MINIO_SECRET_KEY: Joi.string().required(),
  MINIO_BUCKET: Joi.string().required(),
  MINIO_USE_SSL: Joi.boolean().default(false),

  // JWT (Identity BC)
  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL: Joi.string().default('30d'),

  // Client JWT — separate namespace for website clients
  JWT_CLIENT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_CLIENT_ACCESS_TTL: Joi.string().default('7d'),

  // License Server (Platform BC) — optional until Phase 3
  LICENSE_SERVER_URL: Joi.string().uri().allow('').optional(),
  LICENSE_KEY: Joi.string().allow('').optional(),

  // FCM (Comms BC) — optional until Phase 9
  FCM_PROJECT_ID: Joi.string().allow('').optional(),
  FCM_CLIENT_EMAIL: Joi.string().email().allow('').optional(),
  FCM_PRIVATE_KEY: Joi.string().allow('').optional(),

  // SMTP (Comms BC) — optional until Phase 9
  SMTP_HOST: Joi.string().hostname().allow('').optional(),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_USER: Joi.string().allow('').optional(),
  SMTP_PASS: Joi.string().allow('').optional(),
  SMTP_FROM: Joi.string().email().allow('').optional(),

  // OpenAI (AI BC — embeddings only) — optional until Phase 11
  OPENAI_API_KEY: Joi.string().allow('').optional(),
  OPENAI_EMBEDDING_MODEL: Joi.string().default('text-embedding-3-small'),

  // OpenRouter (AI BC — chat/completion) — optional until Phase 11
  OPENROUTER_API_KEY: Joi.string().allow('').optional(),
  OPENROUTER_BASE_URL: Joi.string().uri().default('https://openrouter.ai/api/v1'),
  OPENROUTER_CHAT_MODEL: Joi.string().default('anthropic/claude-3.5-haiku'),

  // Moyasar (Finance BC) — optional until Phase 7
  MOYASAR_API_KEY: Joi.string().allow('').optional(),
  MOYASAR_WEBHOOK_SECRET: Joi.string().allow('').optional(),

  // Multi-tenancy — default `strict` as of SaaS-02h.
  //   strict     → platform default. Any scoped query without CLS org throws.
  //   permissive → falls back to DEFAULT_ORGANIZATION_ID. Dev-only.
  //   off        → no scoping. Legacy single-tenant mode. Never in multi-tenant prod.
  TENANT_ENFORCEMENT: Joi.string().valid('off', 'permissive', 'strict').default('strict'),
  DEFAULT_ORGANIZATION_ID: Joi.string().uuid().default('00000000-0000-0000-0000-000000000001'),

  // SMS per-tenant (SaaS-02g-sms) — encryption key is REQUIRED; 32 raw bytes base64-encoded (ASCII length 44).
  // Webhook base URL is the public origin registered with providers for DLR callbacks.
  SMS_PROVIDER_ENCRYPTION_KEY: Joi.string().base64().length(44).required(),
  SMS_WEBHOOK_URL_BASE: Joi.string().uri().allow('').optional(),

  // Billing (SaaS-04) — PLATFORM Moyasar (charges clinics for SaaS subscriptions).
  // Distinct from OrganizationPaymentConfig.moyasar* (tenant Moyasar, Plan 02e).
  // Optional at boot so dev/test environments without billing can still start;
  // billing handlers/crons assert presence at use-time.
  MOYASAR_PLATFORM_SECRET_KEY: Joi.string().min(16).allow('').optional(),
  MOYASAR_PLATFORM_WEBHOOK_SECRET: Joi.string().min(16).allow('').optional(),
  SAAS_TRIAL_DAYS: Joi.number().integer().min(0).max(90).default(14),
  SAAS_GRACE_PERIOD_DAYS: Joi.number().integer().min(0).max(30).default(2),
  BILLING_CRON_ENABLED: Joi.boolean().default(false),
}).unknown(true);
