# CareKit Backend — Architecture Design Spec

**Date:** 2026-04-11  
**Status:** Approved  
**Scope:** Full backend rebuild (NestJS 11, Prisma 7, PostgreSQL + pgvector, BullMQ, Redis, MinIO)  
**Decision:** Rebuild from scratch — project not yet in production

---

## 1. Context & Motivation

The current backend has 36+ modules with three confirmed circular dependencies:

- `bookings ↔ payments ↔ invoices` (triangle via forwardRef)
- `tasks ↔ bookings` (scheduler imports business logic)
- `messaging ↔ notifications` (implicit coupling)

`forwardRef()` hides these — it does not solve them. The existing structure is not scalable for AI-assisted development because agents cannot reason about features in isolation when every module imports from every other.

**Chosen architecture:** Bounded Contexts (DDD) externally + Vertical Slices (CQRS) internally + BullMQ Event Bus between contexts.

---

## 2. Deployment Model — White-label Licensed Software

CareKit is **not SaaS**. Each client gets a complete, independent instance (database, backend, frontend) installed on their own infrastructure or a dedicated server.

### License Server (separate project)

A small standalone service that:
- Issues license keys tied to: `clientId`, `features[]`, `tier`, `expiresAt`
- Validates license keys on backend startup and periodically
- Never touches client data

### Feature Gating

```typescript
@RequiresFeature('AI_CHATBOT')
@Get('chat')
async chat() { ... }
```

Feature tiers:
| Tier | Included Features |
|------|-------------------|
| Basic | Bookings, Patients, Practitioners, Payments, Invoices, Notifications |
| Pro | + Groups, Waitlist, Intake Forms, Ratings, Reports, Gift Cards |
| Enterprise | + AI Chatbot, ZATCA, Custom Roles, Integrations, Activity Log |

The `platform/` Bounded Context owns license validation and feature-flag enforcement.

### Entity Ownership (canonical sources of truth)

| Entity | Owner Context |
|--------|--------------|
| User (staff) | `identity/` |
| Patient | `people/` |
| Practitioner | `people/` |
| Booking | `bookings/` |
| Invoice | `finance/` |
| Payment | `finance/` |
| Service (clinic service) | `clinic/` |
| Branch | `clinic/` |
| Message / Notification | `comms/` |

No context reads another context's database table directly. Cross-context data flows through: (1) explicit service calls for synchronous reads, (2) domain events for asynchronous reactions.

---

## 3. Folder Structure

```
apps/backend/src/
├── common/                  # Cross-cutting (guards, interceptors, filters, decorators, pipes)
├── infrastructure/          # Adapters: Prisma, Redis, BullMQ, MinIO, SMTP, FCM
├── api/
│   ├── dashboard/           # Presentation layer — rich responses for dashboard UI
│   └── mobile/
│       ├── patient/         # Presentation layer — lightweight responses for patient app
│       ├── practitioner/    # Presentation layer — lightweight responses for practitioner app
│       └── patient-portal/  # Composite aggregator (combines data from multiple BCs)
└── modules/
    ├── identity/            # auth + roles + permissions + users (cross-cutting identity)
    ├── people/              # patients + practitioners (domain entities)
    ├── bookings/            # bookings + waitlist + groups (scheduling domain)
    ├── finance/             # payments + invoices + pricing + coupons + gift-cards + zatca
    ├── clinic/              # settings + branches + departments + services + whitelabel
    ├── comms/               # messaging + notifications + email + email-templates
    ├── ai/                  # chatbot + knowledge-base + ai-tools (pgvector)
    ├── ops/                 # tasks (BullMQ cron) + activity-log + reports + health
    └── platform/            # license + feature-flags + problem-reports + integrations
```

### Why `identity/` is separate from `people/`

`identity/` contains cross-cutting concerns that every module depends on: JWT auth, CASL RBAC, roles, permissions, staff users. These are not domain entities — they are infrastructure for authorization. `people/` contains the actual healthcare domain: patients (who receive care) and practitioners (who deliver care). Mixing them created the previous coupling where patient management code pulled in auth logic.

---

## 4. Layered Architecture (per Bounded Context)

Every BC follows a strict 4-layer stack:

```
API Layer          ← Controllers, DTOs, route definitions
Application Layer  ← Commands, Queries, Events, Handlers (CQRS)
Domain Layer       ← Entities, Value Objects, Domain Services, Domain Events
Infrastructure     ← Prisma repositories, external adapters
```

Rules:
- API Layer only calls Application Layer (never Domain or Infrastructure directly)
- Application Layer orchestrates Domain + Infrastructure
- Domain Layer has zero NestJS imports (pure TypeScript)
- Infrastructure Layer implements interfaces defined in Domain Layer

---

## 5. Vertical Slices (inside each BC)

Each feature is a self-contained folder:

```
modules/bookings/
├── create-booking/
│   ├── create-booking.command.ts
│   ├── create-booking.handler.ts
│   ├── create-booking.dto.ts
│   └── create-booking.handler.spec.ts
├── cancel-booking/
│   ├── cancel-booking.command.ts
│   ├── cancel-booking.handler.ts
│   ├── cancel-booking.dto.ts
│   └── cancel-booking.handler.spec.ts
├── get-booking/
│   ├── get-booking.query.ts
│   ├── get-booking.handler.ts
│   └── get-booking.handler.spec.ts
├── events/
│   ├── booking-confirmed.event.ts
│   └── booking-cancelled.event.ts
└── bookings.module.ts
```

**Why this matters for AI-assisted development:** An agent given `create-booking/` has everything it needs in one folder. It doesn't need to understand the full module. Each slice can be generated, tested, and reviewed independently.

### CQRS Classification Rules

| Type | When to use | Naming |
|------|-------------|--------|
| Command | Mutates state (create, update, cancel, confirm) | `VerbNounCommand` |
| Query | Read-only, no side effects | `GetNounQuery` / `ListNounsQuery` |
| Event | Something happened, triggers reactions | `NounVerbedEvent` |
| CRUD handler | Simple entities with no business logic | Standard service, no CQRS needed |

### Event Contracts (mandatory format)

Every domain event must include:

```typescript
export class BookingConfirmedEvent {
  readonly source = 'bookings';           // originating BC
  readonly version = 1;                   // schema version
  readonly occurredAt: Date;
  readonly payload: {
    bookingId: string;
    patientId: string;
    practitionerId: string;
    scheduledAt: Date;
  };
}
```

---

## 6. BullMQ Event Bus (inter-context communication)

Circular dependencies are broken by making contexts communicate through events, not imports.

**Pattern:**

```
BookingsContext                    FinanceContext
     │                                  │
     │  emit: BookingConfirmedEvent      │
     │ ─────────────────────────────►   │
     │                           handle: create invoice
     │                                  │
     │  emit: PaymentCompletedEvent      │
     │ ◄─────────────────────────────   │
     │  handle: update booking status   │
```

**Implementation:**
- Each BC has an `EventPublisher` (wraps BullMQ producer)
- Each BC registers `EventHandlers` for events it cares about
- Events are persisted in Redis queue — survive process restarts
- No direct imports between BCs at the module level

**Events broken by this pattern:**
- `BookingConfirmedEvent` → Finance creates invoice
- `PaymentCompletedEvent` → Bookings updates status
- `BookingCancelledEvent` → Finance triggers refund, Comms sends notification
- `TaskDueEvent` → Bookings checks for auto-complete, no-show, expiry
- `AppointmentReminderDueEvent` → Comms sends SMS/push

---

## 7. Bounded Contexts — Module Map

### `identity/` — Cross-cutting Identity
| Slice | Type | Complexity |
|-------|------|-----------|
| login | Command | MEDIUM |
| refresh-token | Command | MEDIUM |
| logout | Command | CRUD |
| get-current-user | Query | CRUD |
| create-role | Command | MEDIUM |
| assign-permissions | Command | COMPLEX |
| casl-ability-factory | Domain Service | COMPLEX |
| users CRUD | Command/Query | CRUD |

### `people/` — Healthcare Domain Entities
| Slice | Type | Complexity |
|-------|------|-----------|
| create-patient | Command | MEDIUM |
| update-patient | Command | CRUD |
| list-patients | Query | MEDIUM |
| create-practitioner | Command | COMPLEX |
| update-availability | Command | COMPLEX |
| practitioner-onboarding | Command | COMPLEX |
| list-practitioners | Query | MEDIUM |

### `bookings/` — Scheduling Domain
| Slice | Type | Complexity |
|-------|------|-----------|
| create-booking | Command | COMPLEX |
| reschedule-booking | Command | COMPLEX |
| cancel-booking | Command | COMPLEX |
| confirm-booking | Command | MEDIUM |
| add-to-waitlist | Command | MEDIUM |
| promote-from-waitlist | Command | COMPLEX |
| create-group-session | Command | COMPLEX |
| enroll-in-group | Command | COMPLEX |
| get-booking | Query | CRUD |
| list-bookings | Query | MEDIUM |
| check-availability | Query | COMPLEX |
| booking-confirmed (event out) | Event | — |
| booking-cancelled (event out) | Event | — |
| payment-completed (event in) | EventHandler | MEDIUM |

### `finance/` — Financial Domain
| Slice | Type | Complexity |
|-------|------|-----------|
| create-invoice | Command | COMPLEX |
| process-payment | Command | COMPLEX |
| moyasar-webhook | Command | COMPLEX |
| bank-transfer-upload | Command | MEDIUM |
| apply-coupon | Command | MEDIUM |
| redeem-gift-card | Command | MEDIUM |
| zatca-submit | Command | COMPLEX |
| get-invoice | Query | CRUD |
| list-payments | Query | MEDIUM |
| payment-completed (event out) | Event | — |
| booking-confirmed (event in) | EventHandler | MEDIUM |

### `clinic/` — Clinic Configuration
| Slice | Type | Complexity |
|-------|------|-----------|
| services CRUD | Command/Query | CRUD |
| branches CRUD | Command/Query | CRUD |
| clinic-hours | Command/Query | MEDIUM |
| holidays | Command/Query | CRUD |
| whitelabel-config | Command/Query | MEDIUM |
| intake-forms | Command/Query | MEDIUM |
| ratings | Command/Query | MEDIUM |

### `comms/` — Communications
| Slice | Type | Complexity |
|-------|------|-----------|
| send-push | Command | MEDIUM |
| send-email | Command | MEDIUM |
| send-sms | Command | MEDIUM |
| create-chat-message | Command | MEDIUM |
| list-conversations | Query | MEDIUM |
| email-templates CRUD | Command/Query | CRUD |
| appointment-reminder-due (event in) | EventHandler | MEDIUM |
| booking-cancelled (event in) | EventHandler | MEDIUM |

### `ai/` — AI & Knowledge Base
| Slice | Type | Complexity |
|-------|------|-----------|
| chat-completion | Command | COMPLEX |
| embed-document | Command | COMPLEX |
| semantic-search | Query | COMPLEX |
| manage-knowledge-base | Command | MEDIUM |

### `ops/` — Operational Services
| Slice | Type | Complexity |
|-------|------|-----------|
| booking-autocomplete (cron) | Task | MEDIUM |
| booking-expiry (cron) | Task | MEDIUM |
| booking-noshow (cron) | Task | MEDIUM |
| appointment-reminders (cron) | Task | MEDIUM |
| group-session-automation (cron) | Task | MEDIUM |
| log-activity | Command | MEDIUM |
| generate-report | Query | COMPLEX |
| health-check | Query | CRUD |

### `platform/` — License & Platform
| Slice | Type | Complexity |
|-------|------|-----------|
| validate-license | Command | COMPLEX |
| check-feature | Query | MEDIUM |
| problem-reports | Command/Query | CRUD |
| integrations | Command/Query | MEDIUM |

---

## 8. Presentation Layer (api/ vs modules/)

The `api/` layer sits above all Bounded Contexts. It is the only place allowed to combine data from multiple BCs.

### `api/dashboard/`
- One controller per domain area
- Rich responses: full entity details, computed fields, pagination metadata
- Talks to BC services directly (same process)

### `api/mobile/patient-portal/`
A composite aggregator for the patient app home screen:

```typescript
// Single call replaces 4 separate API calls
GET /mobile/patient/portal/home

// Aggregates from:
// - bookings/ → upcoming appointments
// - finance/  → outstanding invoices
// - comms/    → unread messages count
// - people/   → patient profile
```

This is the Backend for Frontend (BFF) pattern — no GraphQL needed at this stage.

---

## 9. Infrastructure Layer

```
infrastructure/
├── database/
│   ├── prisma.service.ts
│   └── prisma/schema/      # Split schemas (one per domain)
├── cache/
│   └── redis.service.ts
├── queue/
│   ├── bull-mq.service.ts
│   └── event-bus.service.ts
├── storage/
│   └── minio.service.ts
├── push/
│   └── fcm.service.ts
└── email/
    └── smtp.service.ts
```

**Prisma schema split:** Each BC owns its schema file. No cross-schema foreign keys at the Prisma level — referential integrity between contexts is enforced at the application layer via events.

---

## 10. Complexity Summary

| BC | COMPLEX | MEDIUM | CRUD | Notes |
|----|---------|--------|------|-------|
| identity | 2 | 3 | 3 | CASL factory is the hard part |
| people | 3 | 3 | 2 | Practitioner availability is complex |
| bookings | 4 | 5 | 2 | Core domain, highest complexity |
| finance | 4 | 4 | 0 | ZATCA + webhooks + refund logic |
| clinic | 0 | 2 | 6 | Mostly configuration |
| comms | 0 | 6 | 2 | Coordination, not logic |
| ai | 3 | 1 | 0 | All complex (embeddings, RAG) |
| ops | 0 | 7 | 1 | Cron jobs + audit |
| platform | 1 | 2 | 2 | License validation is the hard part |
| **Total** | **17** | **33** | **18** | |

---

## 11. What This Architecture Solves

| Problem | Solution |
|---------|----------|
| `bookings ↔ payments ↔ invoices` circular dep | `finance/` BC owns all financial logic; `BookingConfirmedEvent` triggers invoice creation |
| `tasks ↔ bookings` circular dep | `ops/tasks` emits `TaskDueEvent`; bookings handles it — no import |
| `messaging ↔ notifications` coupling | Both live in `comms/` BC; internal coupling is fine |
| AI chatbot mixed with core business logic | `ai/` BC isolated; other BCs don't import from it |
| No feature gating | `platform/` BC + `@RequiresFeature()` decorator on every premium slice |
| Agent can't reason about features in isolation | Vertical Slices: each feature is one folder with all its files |

---

## 12. Out of Scope

- GraphQL / API Gateway — not needed at this stage; BFF pattern handles mobile aggregation
- Multi-tenancy / SaaS — deliberately excluded; each client is a standalone instance
- Microservices split — monorepo NestJS monolith is the right call for this team size
- CQRS read models / projections — reports BC uses direct DB queries, not event-sourced projections (overkill)
