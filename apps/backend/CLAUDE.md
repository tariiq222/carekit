# CareKit Backend — NestJS API

## Tech

NestJS 11, Prisma 7 (split schema), PostgreSQL + pgvector, BullMQ, Redis, MinIO, CASL RBAC, Sentry, Prometheus.

## Module Conventions

Each feature lives in `src/modules/[name]/` with:
```
[name].module.ts          # NestJS module registration
[name].controller.ts      # HTTP endpoints (thin — delegate to service)
[name].service.ts         # Business logic entry point
[name]-*.service.ts       # Sub-services when main > 250 lines
dto/                      # Request/response DTOs (class-validator)
```

## Active Modules (36)

`activity-log`, `ai`, `auth`, `bookings`, `branches`, `chatbot`, `clinic`,
`clinic-integrations`, `clinic-settings`, `coupons`, `departments`, `email`,
`email-templates`, `feature-flags`, `group-sessions`, `health`,
`intake-forms`, `integrations`, `invoices`, `license`, `notifications`,
`patients`, `payments`, `permissions`, `practitioners`, `problem-reports`,
`ratings`, `reports`, `roles`, `services`, `specialties`, `tasks`, `users`,
`whitelabel`, `zatca`

## Similar Modules — Why They Are Separate

### `clinic/` vs `clinic-settings/`

These are **not duplicates**. They serve different data patterns:

- **`clinic/`** — CRUD on schedule tables: `ClinicWorkingHours` (multiple rows per day) and `ClinicHoliday` (list of dates). Routes: `clinic/hours`, `clinic/holidays`. Used by `bookings` only.
- **`clinic-settings/`** — Singleton record: clinic identity (name, VAT, address, timezone, policies, email footer). Route: `clinic-settings`. Used by 8 modules (bookings, practitioners, email, zatca, invoices, tasks ×3).

One manages **schedules** (lists), the other manages **configuration** (single record). Different Prisma models, different access patterns, different consumers.

### `integrations/` vs `clinic-integrations/`

These are **not duplicates**. They operate at different layers:

- **`integrations/`** — SDK wrappers for third-party APIs (Zoom OAuth, meeting creation/deletion). Contains the actual API client logic. No Prisma model — reads credentials from env/config.
- **`clinic-integrations/`** — Singleton CRUD for the clinic's API keys and secrets (Moyasar, Zoom, ZATCA, email provider, OpenRouter, Firebase). Prisma model: `ClinicIntegrations`. Masks sensitive fields on read. Used by `zatca` module.

One is **implementation** (how to call external APIs), the other is **configuration** (which credentials to use). They share no code or Prisma models.

## Common Layer (`src/common/`)

| Dir | Purpose |
|-----|---------|
| `guards/` | Auth, CASL ability, throttle guards |
| `decorators/` | @CurrentUser, @Roles, custom param decorators |
| `filters/` | Global exception filter → Sentry |
| `interceptors/` | Logging, transform response |
| `pipes/` | Validation pipe (class-validator) |
| `middleware/` | Request ID, CORS |
| `metrics/` | Prometheus counters/histograms |
| `queue/` | BullMQ producer helpers + failure handler |
| `ai-service.module.ts` | Global `AiServiceModule` (OpenRouter) |
| `storage.module.ts` | Global `StorageModule` (MinIO) |

## Prisma Rules

- Schema split by domain: `prisma/schema/[domain].prisma`
- `base.prisma` = datasource + generator only — never add models here
- **Migrations are immutable** — `prisma migrate dev` creates new, never amends
- Use `PrismaService` (singleton) — never instantiate PrismaClient directly
- pgvector enabled for AI embeddings (`ai/` module)
- **Pending migration**: `20260321232158_init` — untracked, run `npm run prisma:migrate` before dev

## DTO Rules

- Every input DTO uses `class-validator` decorators
- Every DTO decorated with `@ApiProperty` for Swagger
- Response DTOs extend from Swagger-serializable classes
- No raw `any` — use typed generics or discriminated unions

## Tasks Module (`src/modules/tasks/`)

Scheduled jobs split into focused sub-services:

- `booking-automation.service.ts` — recurring booking creation
- `booking-expiry.service.ts` — expire unpaid bookings
- `booking-noshow.service.ts` — mark no-shows after window
- `booking-cancellation-timeout.service.ts` — timeout pending cancellations
- `booking-autocomplete.service.ts` — auto-complete past appointments
- `reminder.service.ts` — FCM/SMS reminder dispatch
- `cleanup.service.ts` — stale data purge
- `tasks-bootstrap.service.ts` — register cron jobs on app start

## Testing

- `jest` with `ts-jest`, rootDir = `.` (project root)
- Unit tests: `test/unit/[name]/*.spec.ts` — imports resolved to `src/modules/[name]/`
- E2E tests: `test/e2e/[name]/*.e2e-spec.ts` — runs against real DB via `test/jest-e2e.json`
- E2E setup files: `test/e2e/setup/` (global-setup.ts, jest-e2e-setup.ts, setup.ts)
- Mock pattern: `createTestingModule` from `@nestjs/testing`
- Coverage thresholds: 40% branch, 50% fn/line/statement
- Always run `npm run test` before committing; `npm run test:e2e` for integration

## Security Tiers

- **Owner-only changes**: `auth/`, `payments/`, `zatca/`, `prisma/schema/`, `prisma/migrations/`
- Sensitive modules require explicit `@tariq` review before merge

## Key Environment Variables

See `.env.example` at repo root. Required:
`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`,
`MINIO_*`, `FIREBASE_*` (FCM), `SENTRY_DSN`
