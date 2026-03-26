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
tests/[name].*.spec.ts    # Unit tests (jest)
```

## Active Modules (25+)

`auth`, `bookings`, `branches`, `chatbot`, `clinic`, `coupons`, `email`,
`gift-cards`, `health`, `intake-forms`, `integrations`, `invoices`,
`notifications`, `patients`, `payments`, `permissions`, `practitioners`,
`problem-reports`, `ratings`, `reports`, `roles`, `services`,
`specialties`, `tasks`, `users`, `whitelabel`, `zatca`

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

## Prisma Rules

- Schema split by domain: `prisma/schema/[domain].prisma`
- `base.prisma` = datasource + generator only — never add models here
- **Migrations are immutable** — `prisma migrate dev` creates new, never amends
- Use `PrismaService` (singleton) — never instantiate PrismaClient directly
- pgvector enabled for AI embeddings (`ai/` module)

## DTO Rules

- Every input DTO uses `class-validator` decorators
- Every DTO decorated with `@ApiProperty` for Swagger
- Response DTOs extend from Swagger-serializable classes
- No raw `any` — use typed generics or discriminated unions

## Testing

- `jest` with `ts-jest`, rootDir = `src/`
- Test files: `src/modules/[name]/tests/*.spec.ts`
- Mock pattern: `createTestingModule` from `@nestjs/testing`
- Coverage thresholds: 40% branch, 50% fn/line/statement
- Always run `npm run test` before committing

## Security Tiers

- **Owner-only changes**: `auth/`, `payments/`, `zatca/`, `prisma/schema/`, `prisma/migrations/`
- Sensitive modules require explicit `@tariq` review before merge

## Key Environment Variables

See `.env.example` at repo root. Required:
`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`,
`MINIO_*`, `FIREBASE_*` (FCM), `SENTRY_DSN`
