# CareKit Architecture

**Version**: 2.0 (multi-tenant SaaS)
**Last reauthored**: 2026-04-25 — replaces v1.0 (2026-03-26, pre-SaaS)

CareKit is a multi-tenant SaaS clinic platform. One deployment serves many organizations (tenants), each with isolated data, branding, vertical configuration, and billing. A super-admin control plane (`apps/admin`) operates the platform; per-tenant clinic admins use `apps/dashboard`; clients and employees use `apps/mobile`; the public marketing site is `apps/website`.

---

## Topology

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Public Internet                              │
└──────────┬──────────────┬───────────────┬────────────┬───────────────┘
           │              │               │            │
       Tenant A        Tenant B       Super-admin   Marketing
       Dashboard       Dashboard      (apps/admin)  (apps/website)
       :5103           :5103           :5104          :5105
       Mobile          Mobile
       :5102           :5102
           │              │               │            │
           └──────────────┴───────────────┴────────────┘
                              │
                       Nginx reverse proxy
                              │
                  ┌───────────┴───────────┐
                  │  apps/backend (5100)  │
                  │  NestJS 11 monolith   │
                  └───────────┬───────────┘
                              │
       ┌──────────────────────┼─────────────────────┐
       │                      │                     │
   PostgreSQL           Redis (BullMQ)           MinIO
   + pgvector + RLS     queues + cache           uploads
```

All four web apps and the mobile app talk to a single backend. The backend resolves the tenant per request, applies RLS, and routes to vertical-slice handlers. There is **no per-tenant deployment** — multi-tenancy lives in the data layer.

---

## Repository Structure

```
carekit/
├── apps/
│   ├── backend/         # NestJS 11 — all business logic
│   ├── dashboard/       # Next.js 15 — per-tenant clinic admin
│   ├── admin/           # Next.js 15 — super-admin SaaS control plane
│   ├── website/         # Next.js 15 — public marketing/info site
│   └── mobile/          # Expo SDK 55 — client + employee + auth
├── packages/
│   ├── api-client/      # @carekit/api-client — typed fetch
│   ├── shared/          # @carekit/shared — types/enums/i18n/seeds
│   └── ui/              # @carekit/ui — 33 primitives + 2 hooks
├── docker/              # docker-compose.yml + Nginx
├── data/kiwi/           # Manual-QA plan JSONs synced to Kiwi TCMS
├── scripts/             # build/test helpers + Kiwi sync
└── docs/
    ├── architecture/    # module-ownership.md (live SoT)
    ├── operations/      # rollback runbook
    ├── design/          # rtl-guidelines, accessibility
    ├── features/        # booking enums/erd/flows
    └── superpowers/     # plans, specs, qa, runbooks
```

---

## Backend Architecture (`apps/backend`)

### Request Pipeline

```
HTTP Request
   │
   ▼
GlobalExceptionFilter ─────────────► structured JSON error
   │
   ▼
RequestIdInterceptor               (correlation)
   │
   ▼
TenantResolverMiddleware           common/tenant/tenant-resolver.middleware.ts
   │  resolves organizationId from JWT/host/header
   │  populates AsyncLocalStorage tenant context
   ▼
JwtAuthGuard / RolesGuard / CASL   identity/casl
   │
   ▼
FeatureGuard                       platform/billing — gate by plan/feature-flag
   │
   ▼
ZodValidationPipe                  per-DTO Zod schemas
   │
   ▼
Controller (api/{admin,dashboard,mobile,public}/*.controller.ts)
   │
   ▼
Vertical-slice handler             modules/<cluster>/<action>/handler.ts
   │
   ▼
Prisma (with TenantScopingExtension) — applies RLS + organizationId where
   │
   ▼
PostgreSQL (RLS policies) + Redis (BullMQ) + MinIO
```

### Module Convention — Vertical Slices

Every backend feature is a **vertical slice** — a folder containing one action:

```
apps/backend/src/modules/bookings/create-booking/
├── create-booking.controller.ts        (or registered in api/<surface>/)
├── create-booking.handler.ts           (business logic)
├── create-booking.dto.ts               (Zod schema + types)
├── create-booking.spec.ts              (unit tests)
└── create-booking.e2e.spec.ts          (integration tests)
```

Never use `<feature>.controller.ts + <feature>.service.ts + repository` pattern. One folder per intent.

### Cluster Tree (14 clusters)

Source of truth for owned models: `docs/architecture/module-ownership.md`.

| Cluster | Purpose | Notable Slices |
|---------|---------|----------------|
| `identity/` | auth, users, multi-org | client-auth, otp, casl, roles, switch-organization, list-memberships |
| `people/` | humans the clinic interacts with | clients, employees, specialties |
| `bookings/` | appointment lifecycle | create, cancel, confirm, check-in, reschedule, recurring, waitlist, walk-in, create-zoom-meeting, retry-zoom-meeting |
| `finance/` | money | payments, moyasar-api, moyasar-webhook, refunds, coupons, zatca-config, zatca-submit, bank-transfer-upload |
| `comms/` | outbound channels | notifications, fcm-tokens, email-templates, send-email, send-sms, org-sms-config, sms-dlr, contact-messages |
| `ai/` | retrieval/generation | chatbot RAG (streaming), knowledge-base, pgvector embeddings |
| `media/` | files | uploads, MinIO presigned URLs |
| `ops/` | operational glue | health-check, cron-tasks, generate-report, log-activity |
| `content/` | static-ish content | site-settings |
| `org-config/` | structural config | branches, categories, departments, business-hours |
| `org-experience/` | client-facing surface | branding, intake-forms, ratings, services, org-settings |
| `integrations/` | third-party | zoom (encrypted creds), public branding |
| `platform/` | SaaS control plane | **admin**, **billing**, **verticals**, **feature-flags**, problem-reports |
| `dashboard/` | tenant home | get-dashboard-stats |

### Multi-Tenancy

- **`organizationId`** column on every tenant-scoped model (12 schemas, 147 occurrences). Singletons (`BrandingConfig`, `OrganizationSettings`, `ChatbotConfig`, `ZatcaConfig`, `OrganizationSmsConfig`) use `organizationId` as a unique key.
- **`TENANT_ENFORCEMENT='strict'`** is the default and the only mode allowed in production (validated at boot in `common/tenant/tenant.module.ts`).
- **Postgres RLS**: 9 SaaS-phase migrations install row-level policies per cluster. Bypass via the dedicated `carekit_rls_probe` role only in admin/cron contexts.
- **Tenant context** is propagated via `AsyncLocalStorage` (`common/tenant/tenant-context.service.ts`) and applied to Prisma via `TenantScopingExtension`.
- **API surfaces** (`src/api/`):
  - `admin/*` — super-admin only, requires `SUPER_ADMIN` role; can act on any org
  - `dashboard/*` — per-tenant admin, scoped to caller's `organizationId`
  - `mobile/{client,employee}/*` — scoped to caller's org via JWT
  - `public/*` — anonymous endpoints (e.g., `public/branding/:orgSlug`, `public/billing-webhook`)

### Data Layer

- **Prisma split schemas** at `apps/backend/prisma/schema/` (12 files): `ai`, `bookings`, `comms`, `content`, `finance`, `identity`, `main`, `media`, `ops`, `organization`, `people`, `platform`. Combined at build by Prisma 7's multi-file feature.
- **Migrations** are immutable. Never modify or consolidate.
- **pgvector** powers chatbot embeddings (`ai.prisma`).
- **MinIO** holds uploads; signed URLs flow through `media/`.

### Background Jobs

BullMQ queues backed by Redis. Cron-style jobs live under `ops/cron-tasks/`. Notable:
- `charge-due-subscriptions` — billing
- `email-template-render` — outbound email
- `chatbot-embed-document` — RAG ingest
- `sms-dlr-update` — SMS delivery receipts

### Auth

JWT access + refresh (separate `RefreshToken` and `ClientRefreshToken` per identity type), CASL ability per role, OTP via Authentica for client signup. Super-admin uses a separate JWT scope and host allowlist (`ADMIN_HOSTS`).

---

## Frontend Architecture

### `apps/dashboard` — per-tenant clinic admin

- Next.js 15 App Router, React 19, Tailwind 4, next-intl (AR/EN)
- 22 features under `app/(dashboard)/`: bookings, clients, employees, services, branches, categories, departments, intake-forms, branding, chatbot, content, contact-messages, coupons, invoices, payments, ratings, notifications, reports, activity-log, users, zatca, settings
- TanStack Query hooks in `hooks/queries/<feature>/`
- UI: `@carekit/ui` primitives (do not modify in place); compose them in `components/features/`
- Terminology: `useTerminology()` reads vertical-driven labels (Plan 03)
- Billing UI: `useCurrentSubscription()`, `useFeatureEnabled()`, `<FeatureGate />` (Plan 04)

### `apps/admin` — super-admin SaaS control plane

- Next.js 15, separate auth scope, host-restricted to `ADMIN_HOSTS`
- Routes under `app/(admin)/`: organizations, plans, verticals, billing, audit-log, impersonation-sessions, metrics, users
- Talks only to `src/api/admin/*` controllers
- Billing oversight: read state, waive, grant credit, change plan, refund (Moyasar live)

### `apps/website` — public marketing/info site

- Next.js 15, public routes only (login, register, support-groups, therapists, contact, sitemap, robots)
- No tenant context — talks to `public/*` controllers

### `apps/mobile` — Expo client + employee

- Expo SDK 55, Expo Router, Redux Toolkit (auth slice only) + TanStack Query
- Route groups: `(auth)`, `(client)`, `(employee)` with tab navigators under `(tabs)/`
- Theme reads `PublicBranding` from backend (per-tenant)
- Terminology: mirrors dashboard's `useTerminology()` (`hooks/useTerminology.ts`)
- FCM push: `services/push.ts` + deep links
- Zoom: `JoinVideoCallButton` + `video-call.tsx` screens for client and employee

---

## Cross-Cutting Concerns

### Verticals + Terminology (Plan 03)

A `Vertical` defines a clinic type (e.g., dental, mental-health). Each ships terminology overrides (e.g., "patient" → "client"). On org creation, `seed-organization-from-vertical` provisions default departments/categories and a terminology pack. `useTerminology()` reads the active org's pack at runtime.

### Billing + Subscriptions (Plan 04)

`platform/billing/` runs the subscription lifecycle:
- Plans CRUD (admin-only)
- Subscription state machine (TRIALING / ACTIVE / PAST_DUE / SUSPENDED / CANCELLED)
- `enforce-limits.guard.ts` and `feature.guard.ts` gate per-feature access
- `charge-due-subscriptions.task.ts` runs nightly via BullMQ
- Hybrid Moyasar — platform Moyasar bills tenants; per-tenant Moyasar bills the tenant's clients

### Per-tenant SMS (Plan 02g-sms)

`OrganizationSmsConfig` (singleton) holds AES-GCM-encrypted Unifonic/Taqnyat credentials (orgId as AAD). `send-sms.handler.ts` picks the adapter by config; DLR webhook updates `SmsDelivery`. Platform never sends SMS on the tenant's behalf.

### Branding (Plan 02c → 04-15 rename)

`BrandingConfig` (singleton) per org. Public read-only via `GET /public/branding/:orgSlug` → consumed by dashboard, mobile (theme slice), and website. Tokens map to CSS custom properties (dashboard) or React Native theme (mobile).

### Zoom

`integrations/zoom` stores encrypted account creds per org. Booking creation triggers `create-zoom-meeting` (with retry); the mobile app shows `JoinVideoCallButton` within the appointment window.

---

## Development Environment

### Ports (5000–5999 reserved)

| Service | Port |
|---------|------|
| Backend | 5100 |
| Mobile (Expo) | 5102 |
| Dashboard | 5103 |
| Admin | 5104 |
| Website | 5105 |
| PostgreSQL | 5430 |
| Redis | 5440 |
| MinIO | 5450 |
| Kiwi TCMS | 6443 |

### Required env

- `DATABASE_URL` — Postgres
- `REDIS_URL` — Redis
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `MINIO_*` — uploads
- `MOYASAR_PLATFORM_*`, `MOYASAR_TENANT_DEFAULT_*` — billing + tenant payments
- `ZOOM_ENCRYPTION_KEY` — credential encryption
- `SMS_ENCRYPTION_KEY` — per-tenant SMS creds
- `AUTHENTICA_API_KEY` — OTP
- `TENANT_ENFORCEMENT=strict` — required in prod
- `ADMIN_HOSTS` — comma-separated hosts permitted to serve super-admin

---

## Pre-PR Checklist (architectural)

- [ ] No `any` in TypeScript (strict)
- [ ] New scoped models include `organizationId` + RLS policy in the migration
- [ ] Tenant-isolation e2e test added for any new tenant-scoped feature
- [ ] User-facing strings have AR + EN entries (parity)
- [ ] Feature gated through `FeatureGuard` if plan-tier-restricted
- [ ] Vertical-slice convention respected (no service/repository sprawl)
- [ ] 350-line max per file
- [ ] Tests pass (unit + e2e)
- [ ] Migrations are additive (no edit/squash)
