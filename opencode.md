# CareKit — OpenCode Project Memory

> This file is the authoritative project memory for all AI agents working on CareKit.
> Loaded at session start. Updated after every significant decision or delivery.
> Do not make it fluffy. Every line must be operational.

---

## 1. Project Identity

**Name:** CareKit
**Type:** White-label clinic management platform — multi-tenant, per-clinic Docker deployment
**Scale:** Large monorepo — backend (NestJS), dashboard (Next.js), mobile (Expo), shared types
**Ports (CareKit only):** PostgreSQL :5999 | Redis :5380 | MinIO :5200 | Backend :5100 | Dashboard :5101 | Mobile :5102

---

## 2. Architecture Map

```
carekit/
├── backend/src/modules/      # 30+ NestJS feature modules
├── backend/prisma/schema/    # Split per-domain .prisma files — IMMUTABLE migrations
├── dashboard/app/(dashboard)/ # Next.js App Router pages (≤120 lines each)
├── dashboard/components/     # features/ (domain) + ui/ (shadcn)
├── dashboard/hooks/          # TanStack Query hooks
├── dashboard/lib/            # api/, types/, schemas/, translations/
├── mobile/app/(patient)/     # Patient booking flows
├── mobile/app/(practitioner)/ # Practitioner-side screens
├── mobile/stores/            # Redux Toolkit slices
├── shared/                   # Cross-app types, enums, i18n tokens
└── .opencode/                # OpenCode config, pipelines, agents, memory
```

---

## 3. Core Domains

| Domain | Files | Risk Level |
|--------|-------|------------|
| Bookings | `backend/src/modules/bookings/` | **CRITICAL** |
| Appointments (group sessions) | `backend/src/modules/group-sessions/` | **HIGH** |
| Practitioners & Availability | `backend/src/modules/practitioners/` | **HIGH** |
| Patients | `backend/src/modules/patients/` | MEDIUM |
| Payments (Moyasar) | `backend/src/modules/payments/` | **CRITICAL** — owner-only |
| ZATCA e-invoicing | `backend/src/modules/zatca/` | **CRITICAL** — regulated |
| Auth / CASL RBAC | `backend/src/modules/auth/` | **CRITICAL** |
| Services & Categories | `backend/src/modules/services/` | MEDIUM |
| Branches | `backend/src/modules/branches/` | MEDIUM |
| Notifications (FCM) | `backend/src/modules/notifications/` | LOW |
| Activity Log | `backend/src/modules/activity-log/` | LOW |

---

## 4. Appointment Scheduling — Domain Rules (Always Apply)

These rules govern appointment logic across the entire system. Any change that touches booking
must be validated against all of them.

### Booking Creation
- A patient cannot book if they have an active unresolved no-show in the same clinic
- Time slot availability is checked against: practitioner schedule + branch hours + holidays
- Service duration determines slot end-time — never assume 30 min default
- Walk-in bookings bypass time-slot validation but still require practitioner assignment
- Recurring bookings generate child appointments — changes to a series require explicit scope (this / following / all)

### Reschedule Rules
- Rescheduling within 2 hours of appointment start time is blocked unless clinic admin overrides
- Original slot is released immediately on reschedule confirmation
- Notification must fire on reschedule — patient + practitioner
- Reschedule history is logged in activity-log — never delete history

### Cancellation Rules
- Cancellations generate a cancellation record — do not just delete the booking row
- Late cancellations (within window set by clinic config) may apply a cancellation fee
- Cancelled slots are immediately released for rebooking
- Refunds for paid bookings must go through the payments module — never update balance directly

### No-Show Handling
- No-show is set manually by staff or auto-set by cron job post-appointment
- No-show flag is on the booking record, not the patient record
- Repeated no-shows can trigger patient restriction — this is configurable per clinic
- No-show must not trigger payment refund automatically

### Waitlist
- Waitlist is per-service, per-practitioner, per-date
- On slot open, first eligible patient on waitlist gets notified via FCM
- Waitlist entry expires at slot time — auto-purge after

---

## 5. Role-Based Access — Always Verify

| Role | Key Permissions |
|------|----------------|
| Owner | Full access to all modules including payments, ZATCA, user management |
| Admin | Most operations except payments and ZATCA |
| Receptionist | Bookings, patients, walk-ins, schedules — no financial |
| Practitioner | Own schedule, own appointments, own ratings |
| Patient (mobile) | Own bookings, own profile, own chat |

**Rule:** Any endpoint that modifies financial data, ZATCA records, or user roles requires Owner guard.
**Rule:** CASL permission check is mandatory on all non-public endpoints — never skip.
**Rule:** Multi-branch: staff are scoped to their branch unless role allows cross-branch.

---

## 6. Database Rules — Always Enforce

- **Migrations are immutable** — never modify or consolidate existing migration files
- **Additive only** — new columns must have defaults or be nullable when added to existing tables
- **Foreign keys** — always define `onDelete` behavior explicitly
- **Indexes** — add for every column used in `WHERE`, `ORDER BY`, or `JOIN` on large tables (bookings, patients)
- **Soft deletes** — used for bookings, patients, practitioners — check for `deletedAt` in queries
- **Schema location:** `backend/prisma/schema/*.prisma` — one file per domain

### High-Risk Tables
- `Booking` — any schema change requires migration review + rollback plan
- `Patient` — contains PII — no logging of raw patient data in activity-log
- `Payment` — immutable records — no updates to amount/status after capture
- `ZatcaInvoice` — regulated — changes require owner approval

---

## 7. Testing Policy — Non-Negotiable

### Minimum Coverage Gates
- Branch coverage: 40% minimum
- Function/line coverage: 50% minimum
- These are CI gates — do not lower them

### Per-Change Testing Requirements

| Change Type | Required Tests |
|-------------|---------------|
| Bug fix | 1+ regression test reproducing the bug |
| New feature | Behavior tests + edge cases |
| Booking logic change | Integration test covering slot availability + conflict |
| Auth/permission change | Tests for allowed + denied scenarios |
| Payment flow change | Integration test + failure path |
| DB schema change | Migration validation test |
| Frontend component | Interaction states + form validation + error state |
| API endpoint | Request/response + auth guard + validation failure |

### Test File Locations
- Backend unit tests: `backend/src/modules/<module>/tests/*.spec.ts`
- Backend unit tests (alt): `backend/test/unit/<module>/*.spec.ts`
- Backend E2E: `backend/test/e2e/<module>/*.e2e-spec.ts`
- Dashboard unit: `dashboard/test/unit/**/*.spec.ts`
- Dashboard E2E: `dashboard/test/e2e/**/*.spec.ts` (Playwright)
- Mobile: `mobile/**/__tests__/*.spec.ts`

### Test Commands
```bash
# Backend
cd backend && npm run test                    # all unit tests
cd backend && npm run test -- --testPathPattern="bookings"  # scoped
cd backend && npm run test:cov               # with coverage

# Dashboard
cd dashboard && npm run test                  # vitest
cd dashboard && npm run typecheck            # tsc --noEmit

# E2E
cd backend && npm run test:e2e
```

---

## 8. Frontend Rules — Dashboard

### Page Anatomy (Mandatory)
```
Breadcrumbs
PageHeader: Title + Description | [Export outline] [+ Add primary]
ErrorBanner (if error)
StatsGrid: 4× StatCard
FilterBar (glass): [Search] [Status ▼] [Other ▼] [Reset]
DataTable (no Card wrapper)
Pagination (if totalPages > 1)
Dialogs/Sheets at bottom
```

### Component Rules
- Add/Edit forms: **separate pages**, never dialogs/popups
- Table actions: icon-only buttons (size-9, rounded-sm) + Tooltip
- Dates: `toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" })`
- Status badges: `bg-success/10 text-success border-success/30` (active) / `bg-muted text-muted-foreground` (inactive)
- Design system: Frosted Glass / Tailwind 4 / shadcn/ui — RTL-first, IBM Plex Sans Arabic
- Pages ≤120 lines — extract to components if approaching

### Colors
- Use semantic tokens only: `--primary`, `--accent`, `--success`, `--warning`, `--destructive`
- Never hardcode `#354FD8` (Royal Blue) or `#82CC17` (Lime Green)

---

## 9. API Design Rules — Backend

- All endpoints: `@ApiOperation` + `@ApiProperty` on DTOs
- Pagination: `page` + `limit` query params → `{ data: [], meta: { total, page, limit, totalPages } }`
- DTOs: `class-validator` decorators mandatory — never raw request body
- Response serialization: `@Exclude()` / `@Expose()` — no password/token in response
- Guards: `@UseGuards(JwtAuthGuard, CaslGuard)` — both required on protected routes
- Error handling: throw `HttpException` with structured error — no raw strings

---

## 10. Sensitive Areas — Extra Caution Required

| Area | Why Sensitive |
|------|--------------|
| `payments/` | Real money — Moyasar webhook, refunds, balance |
| `zatca/` | Saudi tax law — e-invoices are legally binding |
| `auth/` | JWT rotation, session invalidation, CASL rules |
| `bookings/` | Core product — any bug affects all clinic operations |
| `migrations/` | Immutable — wrong migration = data loss in production |
| Patient PII | PDPL compliance — no raw logging, no over-exposure |

**Rule:** Any PR touching payments, ZATCA, auth, or migrations requires explicit STOP before execution — raise risk to user before writing code.

---

## 11. Operational Assumptions

- Every clinic runs in an isolated Docker stack — no shared state between clinics
- WhatsApp/FCM notifications are async — never block booking flow on notification failure
- BullMQ jobs are used for: reminders, no-show auto-set, invoice generation, waitlist processing
- MinIO stores: patient documents, intake form attachments, clinic logos
- Sentry is active in production — errors are tracked
- Redis is used for: BullMQ queues, session cache, rate limiting

---

## 12. Memory Categories (Structured)

### 12.1 Active Decisions
> Record architectural decisions here when made. Format: `[DATE] DECISION: ... RATIONALE: ...`

### 12.2 Domain Rules (append-only)
> CareKit-specific business rules discovered during implementation.

### 12.3 Known Bugs & Lessons
> Format: `[DATE] BUG: <what> | ROOT_CAUSE: <why> | FIX: <how> | REGRESSION_TEST: <file>`

### 12.4 Testing Lessons
> Patterns that worked or failed in tests. Anti-patterns to avoid.

### 12.5 API Contracts
> Documented API shapes that other services depend on — do not change without versioning.

---

## 13. Token Control Rules (For All Agents)

- Read only files relevant to the current task — no full project scans
- Pass only diffs between stages — not full file contents
- Use scoped test runs — `--testPathPattern` not full suite unless needed
- Prefer structured outputs (JSON/YAML) in handoffs over prose
- If task touches 1 file → read that file. If it touches a module → read module only.
- Never send the full AGENTS.md or opencode.md to every step — reference sections only
