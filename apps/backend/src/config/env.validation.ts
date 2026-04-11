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

  // OpenAI (AI BC) — optional until Phase 11
  OPENAI_API_KEY: Joi.string().allow('').optional(),
  OPENAI_EMBEDDING_MODEL: Joi.string().default('text-embedding-3-small'),
  OPENAI_CHAT_MODEL: Joi.string().default('gpt-4o-mini'),

  // Moyasar (Finance BC) — optional until Phase 7
  MOYASAR_API_KEY: Joi.string().allow('').optional(),
  MOYASAR_WEBHOOK_SECRET: Joi.string().allow('').optional(),
}).unknown(true);
