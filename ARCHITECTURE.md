# CareKit Architecture

**Version:** 1.0
**Last updated:** 2026-03-26
**Status:** Active — Phase 8 Enterprise Readiness

---

## Overview

CareKit is a white-label smart clinic management platform deployed independently per client. Each deployment is a self-contained Docker stack on the client's infrastructure.

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT DEPLOYMENT                         │
│                                                                  │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Mobile  │  │  Dashboard   │  │     Custom Website        │  │
│  │ (iOS/    │  │  (Next.js)   │  │  (per-client, WebVue)     │  │
│  │ Android) │  │  Port 3001   │  │  Port 80/443              │  │
│  └────┬─────┘  └──────┬───────┘  └──────────────────────────┘  │
│       │               │                                          │
│  ┌────▼───────────────▼──────────────────────────────────┐      │
│  │                    Nginx (Reverse Proxy)                │      │
│  └──────────────────────────┬────────────────────────────┘      │
│                             │                                    │
│  ┌──────────────────────────▼────────────────────────────┐      │
│  │               NestJS Backend (Port 3000)                │      │
│  │   Auth │ Bookings │ Payments │ AI Chatbot │ Reports    │      │
│  └──────┬──────────┬──────────┬────────────┬─────────────┘      │
│         │          │          │            │                     │
│  ┌──────▼──┐ ┌─────▼──┐ ┌────▼───┐ ┌─────▼──┐                 │
│  │PostgreSQL│ │  Redis │ │ MinIO  │ │ BullMQ │                 │
│  │  Port   │ │Port    │ │ (S3)   │ │Queues  │                 │
│  │  5432   │ │6379    │ │Port    │ │        │                 │
│  └─────────┘ └────────┘ │9000    │ └────────┘                 │
│                          └────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Repository Structure

```
carekit/
├── backend/              # NestJS API server
│   ├── prisma/
│   │   ├── schema/       # Split Prisma schemas (one per domain)
│   │   ├── migrations/   # Committed migration files
│   │   └── seed*.ts      # Database seeders
│   └── src/
│       ├── common/       # Guards, filters, interceptors, decorators
│       ├── config/       # App configuration (env vars)
│       ├── database/     # Prisma service
│       └── modules/      # Feature modules (one per domain)
│
├── dashboard/            # Next.js admin dashboard
│   ├── src/
│   │   ├── app/          # App Router pages
│   │   ├── components/   # UI components (ui/ + features/)
│   │   ├── hooks/        # TanStack Query hooks
│   │   └── lib/          # API clients, types, schemas, i18n
│   ├── ARCHITECTURE.md   # Dashboard-specific layer rules
│   ├── DESIGN-SYSTEM.md  # Visual design rules
│   └── CONTRIBUTING.md   # Dashboard-specific onboarding
│
├── mobile/               # React Native (Expo SDK 54)
│   └── src/
│       ├── app/          # Expo Router file-based routes
│       ├── components/   # Shared UI components
│       ├── store/        # Redux Toolkit slices
│       └── services/     # API client (axios)
│
├── shared/               # Types and constants shared across apps
│   ├── types/
│   └── constants/
│
├── docker/               # Docker infrastructure
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   └── nginx/
│
└── docs/                 # All documentation
    ├── core/             # PRD, API spec, system architecture
    ├── features/         # Feature-specific docs (booking flows, ERDs)
    ├── audits/           # Gap analysis, security audit reports
    ├── design/           # DS specs, accessibility, mobile screens
    ├── operations/       # Migration log, runbooks
    └── progress/         # Sprint plan, achievements log
```

---

## Feature Boundaries

The following 20 features represent the official domain boundaries of CareKit. Each feature is isolated: its own module (backend), its own component directory (dashboard), its own hooks and API client.

| # | Feature | Backend Module | Dashboard Page | Description |
|---|---------|---------------|----------------|-------------|
| 1 | Auth | `auth/` | `login/` | Email + OTP, JWT, refresh tokens |
| 2 | Users | `users/` | `users/` | Staff accounts, invitations |
| 3 | Roles & Permissions | `roles/`, `permissions/` | `users/roles/` | CASL dynamic RBAC |
| 4 | Employees | `employees/` | `employees/` | Profiles, availability, specialties |
| 5 | Services | `services/`, `specialties/` | `services/` | Service catalog, pricing |
| 6 | Clients | `clients/` | `clients/` | Client profiles, walk-in registration |
| 7 | Bookings | `bookings/` | `bookings/` | Scheduling, cancellation, expiry |
| 8 | Payments | `payments/` | `payments/` | Moyasar, bank transfer, webhook |
| 9 | Invoices | `invoices/` | `invoices/` | Invoice generation, PDF export |
| 10 | ZATCA | `zatca/` | `zatca/` | Saudi e-invoice compliance, XML |
| 11 | Coupons | `coupons/` | `coupons/` | Discount codes, usage tracking |
| 12 | Ratings | `ratings/` | `ratings/` | Star ratings, feedback collection |
| 13 | Problem Reports | `problem-reports/` | `problem-reports/` | Client complaints, admin alerts |
| 14 | AI Chatbot | `chatbot/` | `chatbot/` | OpenRouter chatbot, knowledge base |
| 15 | Intake Forms | `intake-forms/` | `intake-forms/` | Pre-visit medical questionnaires |
| 16 | Notifications | `notifications/` | `notifications/` | FCM push, in-app, email |
| 18 | Branches | `branches/` | `branches/` | Multi-location clinic support |
| 19 | White Label | `whitelabel/` | `white-label/` | Branding, config per client |
| 20 | Reports | `reports/` | `reports/` | Analytics, revenue, occupancy |

**Also present (infrastructure):**
- `activity-log/` — Audit trail for all admin actions
- `tasks/` — BullMQ cron jobs and processors
- `email/`, `email-templates/` — Transactional email service
- `integrations/` — Zoom API, MinIO, external services
- `health/` — Liveness and readiness probes

---

## Backend Architecture

### Request Pipeline

```
HTTP Request
    │
    ▼
[Nginx] — Rate limiting, SSL termination
    │
    ▼
[NestJS] GlobalPrefix: /api/v1
    │
    ├─ [CORS Middleware]
    ├─ [Helmet Security Headers]
    ├─ [Request Logger Interceptor]
    ├─ [JWT Auth Guard] — validates token, loads user
    ├─ [CASL Permission Guard] — checks ability for route
    ├─ [Validation Pipe] — class-validator DTOs
    │
    ▼
[Controller] — thin, delegates to service
    │
    ▼
[Service] — all business logic lives here
    │
    ├─ [Prisma Service] — database access
    ├─ [Redis Service] — caching, rate limiting
    ├─ [Queue Service] — async job dispatch
    └─ [External APIs] — Moyasar, Zoom, FCM, OpenRouter
    │
    ▼
[Response Interceptor] — wraps in { success, data, error }
    │
    ▼
HTTP Response
```

### Module Structure (per feature)

```
modules/[feature]/
├── [feature].module.ts          # Module definition
├── [feature].controller.ts      # HTTP routes (≤ 350 lines)
├── [feature].service.ts         # Business logic (≤ 350 lines)
├── [feature]-[sub].service.ts   # Sub-service if split needed
├── dto/
│   ├── create-[feature].dto.ts
│   └── update-[feature].dto.ts
└── tests/
    └── [feature].service.spec.ts
```

### Data Layer

- **PostgreSQL 16** — primary data store
- **Prisma ORM** — schema-first, all changes via migrations
- **Redis 7** — caching (TTL-based), BullMQ job queues, rate limiting state
- **MinIO** — S3-compatible object storage (receipts, avatars, documents, chatbot files)

### Async Processing (BullMQ Queues)

| Queue | Processor | Jobs |
|-------|-----------|------|
| `notifications` | `tasks.processor.ts` | Push notifications, email dispatch |
| `booking-events` | `booking-expiry.service.ts` | Expiry, no-show, cancellation timeout |
| `payments` | `moyasar-webhook.service.ts` | Webhook retry, payment verification |
| `cleanup` | `cleanup.service.ts` | Soft-delete purge, expired session cleanup |

---

## Dashboard Architecture

See `dashboard/ARCHITECTURE.md` for full details. Summary:

### Layer Hierarchy (one-way imports)

```
app/(dashboard)/[feature]/page.tsx
    └── components/features/[feature]/
            └── hooks/use-[feature].ts
                    └── lib/api/[feature].ts
                            └── lib/types/[feature].ts
```

### Design System Governance

1. **Tokens:** `app/globals.css` — single source of all CSS variables
2. **Components:** `components/ui/` (shadcn primitives, do not modify) + `components/features/` (feature UI)
3. **Icons:** `@hugeicons/react` exclusively — no Lucide, no Material Icons
4. **Visual style:** Frosted Glass — `backdrop-blur` on cards, semi-transparent surfaces
5. **RTL:** All spacing uses `start`/`end` directional utilities

---

## Security Architecture

### Authentication Flow

```
Client Login (Email OTP):
  POST /api/v1/auth/request-otp → sends OTP to email
  POST /api/v1/auth/verify-otp → returns { accessToken, refreshToken }

Staff Login (Password):
  POST /api/v1/auth/login → returns { accessToken, refreshToken }

Token Refresh:
  POST /api/v1/auth/refresh → rotates refresh token (single-use)
```

### Authorization (CASL)

```
User → has many Roles → each Role has many Permissions
Permission { action: 'view'|'create'|'edit'|'delete', subject: 'Booking'|'Payment'|... }

Every controller method:
  @UseGuards(JwtAuthGuard, CaslGuard)
  @RequireAbility('view', 'Booking')
  async getBooking() { ... }
```

### Data Security

- Passwords: `bcrypt` (rounds: 12)
- JWT: RS256 asymmetric signing, 15-min access token, 7-day refresh token
- Secrets: environment variables only — never in code or Docker images
- SQL: Prisma parameterized queries — no raw SQL injection risk
- File uploads: validated mime type + size limit before MinIO storage
- CORS: whitelist of allowed origins per deployment

---

## Infrastructure

### Docker Compose Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `api` | `carekit-backend` | 3000 | NestJS API |
| `dashboard` | `carekit-dashboard` | 3001 | Next.js dashboard |
| `postgres` | `postgres:16` | 5432 | Primary database |
| `redis` | `redis:7-alpine` | 6379 | Cache + queues |
| `minio` | `minio/minio` | 9000/9001 | Object storage |
| `nginx` | `nginx:alpine` | 80/443 | Reverse proxy |

### Environment Variables

All secrets must be in `.env` (never committed). See `.env.example` for required keys:

```
DATABASE_URL
REDIS_URL
JWT_PRIVATE_KEY / JWT_PUBLIC_KEY
OPENROUTER_API_KEY
MOYASAR_API_KEY / MOYASAR_WEBHOOK_SECRET
ZOOM_API_KEY / ZOOM_API_SECRET
FCM_PROJECT_ID / FCM_PRIVATE_KEY
MINIO_ACCESS_KEY / MINIO_SECRET_KEY
RESEND_API_KEY
```

---

## Pre-PR Checklist (13 items)

Before any PR is merged, all 13 items must pass:

- [ ] No file exceeds 350 lines
- [ ] No `any` TypeScript type
- [ ] No hardcoded hex colors
- [ ] No `text-gray-*` Tailwind classes
- [ ] No raw `<input>` / `<select>` / `<textarea>` elements
- [ ] No Lucide icons (use Hugeicons)
- [ ] No cross-feature imports in dashboard
- [ ] No `prisma db push` (use `migrate dev`)
- [ ] RTL layout tested (Arabic `dir="rtl"`)
- [ ] Loading / Error / Empty states implemented
- [ ] Unit tests pass (`npm run test` in backend)
- [ ] TypeScript builds (`npm run build`)
- [ ] Swagger decorators present on new endpoints

---

## Documentation Map

| Need | Document |
|------|----------|
| Getting started | `CONTRIBUTING.md` (this repo root) |
| Architecture overview | `ARCHITECTURE.md` (this file) |
| Dashboard specifics | `dashboard/ARCHITECTURE.md` |
| Design rules | `dashboard/DESIGN-SYSTEM.md` |
| Component policy | `dashboard/components-policy.md` |
| Full API spec | `docs/core/api-spec.md` |
| Product requirements | `docs/core/CareKit-PRD-EN.md` |
| Booking flows | `docs/features/booking-flow-analysis.md` |
| Database ERD | `docs/features/booking-erd.md` |
| Migration history | `docs/operations/migration-log.md` |
| Rollback procedures | `docs/operations/migration-rollback-runbook.md` |
| Security audit | `docs/audits/security-audit-summary.md` |
| Sprint plan | `docs/progress/sprint-plan.md` |
| Completed work | `docs/progress/achievements.md` |
| Technical debt & ADRs | `docs/refactor-roadmap.md` |
| Code ownership | `CODEOWNERS` |
| AI assistant rules | `CLAUDE.md` |
