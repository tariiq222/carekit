# CareKit Backend — Conventions

This file provides guidance to Claude Code when working inside `apps/backend`. Read the root [CLAUDE.md](../../CLAUDE.md) first for stack-wide rules (tenant model, immutable migrations, golden rules).

## Architecture: Domain Clusters + Vertical Slices

The backend is a **Modular Monolith** organized as **domain clusters**, each containing **vertical-slice features**. Controllers are **separated from domain code** and live under `src/api/` by audience.

```
src/
├── api/                      ← HTTP layer (thin controllers, audience-scoped)
│   ├── dashboard/            ← Admin controllers — one per cluster
│   ├── mobile/{client,employee}/
│   └── public/               ← Unauthenticated (webhooks, healthcheck)
├── modules/                  ← Domain code (clusters of vertical slices)
│   ├── bookings/             finance/   identity/   people/
│   ├── comms/                org-config/  org-experience/
│   ├── ops/                  ai/   media/   platform/
├── infrastructure/           ← Shared tech: database, cache, queue, mail, storage, ai, events
├── common/                   ← Guards, filters, interceptors, pipes, tenant, base events
├── config/                   app.module.ts                main.ts
└── prisma/schema/            ← One .prisma file per cluster (immutable migrations)
```

### Domain clusters (authoritative — not the old "one module per domain")

| Cluster | Slices inside |
|---|---|
| `bookings/` | create-/cancel-/reschedule-/confirm-/check-in-/complete-/no-show-/expire-booking, check-availability, recurring, waitlist, zoom |
| `finance/` | payments, invoices, coupons, ZATCA, moyasar-webhook, refund, bank-transfer |
| `identity/` | login, logout, refresh-token, current-user, users, roles, CASL |
| `people/` | clients, employees |
| `comms/` | email, sms, push, notifications, chat, email-templates |
| `org-config/` | branches, business-hours, categories, departments |
| `org-experience/` | branding, intake-forms, ratings, services |
| `ops/` | generate-report, cron-tasks, health-check, log-activity |
| `ai/` | chat-completion, chatbot-config, embed-document, manage-knowledge-base, semantic-search |
| `media/` | files |
| `platform/` | feature-flags, integrations, license, problem-reports |

### Vertical slice anatomy

Each use case is a self-contained folder:

```
modules/bookings/create-booking/
├── create-booking.dto.ts          ← class-validator input shape
├── create-booking.handler.ts      ← @Injectable class with execute(command)
└── create-booking.handler.spec.ts ← colocated unit tests
```

- **Handler, not Service.** The pattern is `XxxHandler` with a single `execute()` method — one slice, one use case.
- **Command type** extends the DTO with `tenantId` and decoded values (e.g., `scheduledAt: Date`). Controllers convert DTO → Command.
- **Cross-slice calls:** handlers may inject other handlers directly (`GetBookingSettingsHandler`, `PriceResolverService`). Cross-**cluster** calls go through published handlers/services from that cluster's module exports.
- **Events live in `<cluster>/events/`** as typed event classes extending `BaseEvent` (see [src/common/events/base-event.ts](src/common/events/base-event.ts)). Handlers emit; cross-cluster reaction handlers (e.g., [payment-completed-handler](src/modules/bookings/payment-completed-handler/)) subscribe.
- **Shared helpers** inside a cluster sit at the cluster root (e.g., [booking-lifecycle.helper.ts](src/modules/bookings/booking-lifecycle.helper.ts)).
- **No generic `*.repository.ts`** — handlers use `PrismaService` directly from [infrastructure/database](src/infrastructure/database/).

### Controllers live in `src/api/`, not inside modules

Controllers are grouped **by audience** (`dashboard/`, `mobile/client/`, `mobile/employee/`, `public/`), one file per cluster (`bookings.controller.ts`, `finance.controller.ts`). They:

1. Apply guards (`JwtGuard`, `CaslGuard`) and extract `@TenantId()` / `@UserId()`.
2. Inject handlers from `src/modules/...` and call `handler.execute({ ...dto, tenantId })`.
3. Do **no business logic** — if you're writing an `if` for domain rules in a controller, it belongs in a handler.

When adding an endpoint: add or extend the slice in `src/modules/<cluster>/<use-case>/`, then wire it in the matching `src/api/<audience>/<cluster>.controller.ts`.

### Infrastructure vs modules

`src/infrastructure/` holds technology adapters (Prisma, BullMQ queues, Redis cache, SMTP/mail, MinIO storage, embeddings). Domain modules depend on infrastructure, never the reverse. Don't put tech concerns (queue definitions, mail transports) inside a cluster.

### Prisma schema is split per cluster

[prisma/schema/](prisma/schema/) has one `.prisma` file per cluster (`bookings.prisma`, `finance.prisma`, etc.) plus `main.prisma` for generator/datasource. Keep model ownership aligned with cluster boundaries.

## Adding work — decision tree

1. **New endpoint on existing use case?** Edit the handler + wire the controller method.
2. **New use case in existing cluster?** Create `modules/<cluster>/<verb-noun>/` with dto + handler + spec, register in `<cluster>.module.ts`, expose through the audience controller.
3. **New domain?** Decide if it fits an existing cluster. Prefer extending a cluster over creating a new one. A new cluster needs: folder under `modules/`, its own `*.module.ts`, a `prisma/schema/<cluster>.prisma` if it owns tables, and at least one controller under `src/api/<audience>/`.
4. **Cross-cluster reaction?** Emit an event from the source cluster; add a handler folder in the consuming cluster (e.g., `payment-completed-handler/`).

## Commands (from `apps/backend/`)

```bash
npm run dev                          # Watch mode, :5100
npm run test                         # Jest unit tests
npm run test:cov                     # Coverage (thresholds: 40% branch, 50% fn/line)
npm run test:e2e                     # E2E (test/jest-e2e.json)
npx jest path/to/file.spec.ts        # Single test file
npx jest -t "partial test name"      # By test name
npm run prisma:migrate               # Apply pending migrations (never `db push`)
npm run prisma:seed                  # Seed demo data
npm run prisma:studio                # GUI
```

## Conventions that catch new contributors

- **Tenant isolation is mandatory.** Every query scopes by `tenantId` extracted via `@TenantId()` ([common/tenant](src/common/tenant/)). A handler missing it is a bug.
- **One handler = one public method (`execute`).** Don't add `executeVariant()`; create a new slice.
- **Tests colocated as `*.handler.spec.ts`** next to the handler, not in a parallel `test/` tree.
- **Payments, ZATCA, auth, and migrations are owner-only** (see root CLAUDE.md "Security Sensitivity Tiers").
- **Migrations are immutable** — never edit or squash existing ones; add a new migration instead.
