# CareKit — White-label Clinic Management Platform

## Tech Stack

- **Monorepo**: npm workspaces + Turborepo
- **Backend**: NestJS 11, Prisma 7 (PostgreSQL + pgvector), BullMQ, Redis, MinIO
- **Leaderboard (admin dashboard)**: Vite + React 19, TanStack Router + Query, shadcn/ui, Tailwind 4 — replaces the legacy Next.js dashboard
- **Mobile**: React Native 0.83, Expo SDK 55, Expo Router, Redux Toolkit
- **Shared packages**: `@carekit/api-client` (typed fetch client) + `@carekit/shared` (types, enums, i18n tokens)
- **Infra**: Docker Compose, Nginx, Sentry, Prometheus

## Golden Rules

- **No `any` in TypeScript** — strict mode everywhere
- **350-line max per file** — split immediately when approaching
- **Migrations are immutable** — never modify or consolidate existing ones
- **Commits**: one system only, ≤10 files or ≤500 lines, conventional format
- **Tests must pass** before any commit — fix first, ship after
- **Agent Team** is the default for any task touching 2+ files
- **No audit loops** — code correct on first delivery
- **Ports 5000–5999** reserved exclusively for CareKit tools/environments
- **All DB changes via Prisma migrations** — never `prisma db push`, never manual SQL
- **RTL-first layout** — use logical properties (`start`/`end`, `ps-`/`pe-`, `ms-`/`me-`); never hardcode `left`/`right`
- **Semantic tokens only** — no hex colors, no `text-gray-*`; always use CSS custom properties so the white-label system works

## Commands

```bash
# Root (Turborepo — wraps `turbo run <task> --filter=<pkg>`)
npm run dev:backend       # NestJS on :5100
npm run dev:leaderboard   # Vite dashboard on :5101
npm run dev:mobile        # Expo on :5102
npm run dev:all           # All apps in parallel
npm run build             # turbo run build — respects task graph
npm run lint              # turbo run lint
npm run test              # turbo run test
npm run docker:up         # Start PostgreSQL, Redis, MinIO
npm run docker:down       # Stop infrastructure

# Backend (cd apps/backend)
npm run dev               # Watch mode
npm run test              # Jest unit tests
npm run test:watch        # Jest watch
npm run test:cov          # Coverage (40% branch, 50% fn/line)
npm run test:e2e          # E2E suite (test/jest-e2e.json)
npm run prisma:migrate    # Run pending migrations
npm run prisma:seed       # Seed demo data
npm run prisma:studio     # Prisma Studio GUI

# Leaderboard (cd apps/leaderboard)
npm run dev               # Vite dev server on :5101
npm run build             # tsc -b && vite build
npm run typecheck         # tsc --noEmit
npm run lint              # ESLint

# Mobile (cd apps/mobile)
npm run dev               # Expo start
npm run ios / android     # Native builds
npm run test              # Jest + jest-expo

# Running a single test (backend)
cd apps/backend && npx jest path/to/file.spec.ts
cd apps/backend && npx jest -t "describes partial name"   # by test name
```

## Structure

```
carekit/
├── apps/
│   ├── backend/          # NestJS API — all business logic
│   │   ├── prisma/schema/    # Split schemas (one per domain, immutable migrations)
│   │   ├── src/common/       # Guards, filters, interceptors, decorators, pipes
│   │   └── src/modules/      # Feature modules (25+ domains)
│   ├── leaderboard/        # Vite + React admin dashboard (replaces Next.js dashboard)
│   │   └── src/          # routes/, components/, hooks/, lib/
│   └── mobile/           # Expo — Patient + Practitioner apps
│       ├── app/(patient)/      # Patient flows (booking, appointments, chat)
│       ├── app/(practitioner)/ # Practitioner flows
│       ├── services/           # Axios API clients
│       └── stores/             # Redux Toolkit slices
├── packages/
│   ├── api-client/       # @carekit/api-client — typed fetch client shared by UIs
│   └── shared/           # @carekit/shared — cross-app types, enums, i18n tokens
├── docker/               # docker-compose.yml + Nginx config
└── docs/                 # Architecture, audits, feature specs
```

## Module Map

See `apps/backend/CLAUDE.md` for NestJS module conventions.
See `apps/leaderboard/CLAUDE.md` for leaderboard (dashboard) layer rules (if present).
See `apps/mobile/CLAUDE.md` for Expo Router conventions.

## Key Domains

"Dashboard Route" below refers to routes inside **apps/leaderboard** (the current admin dashboard).

| Domain | Backend Module | Dashboard Route | Notes |
|--------|---------------|-----------------|-------|
| Auth | `auth/` | — | JWT + refresh tokens, CASL RBAC |
| Bookings | `bookings/` | `bookings/` | Recurring, waitlist, walk-in |
| Patients | `patients/` | `patients/` | Walk-in support |
| Practitioners | `practitioners/` | `practitioners/` | Availability scheduler |
| Services | `services/` | `services/` | Clinic service catalog |
| Specialties | `specialties/` | `specialties/` | Practitioner specialties |
| Branches | `branches/` | `branches/` | Multi-branch support |
| Payments | `payments/` | `payments/` | Moyasar webhook, owner-only |
| ZATCA | `zatca/` | `zatca/` | Saudi e-invoicing, regulated |
| Invoices | `invoices/` | `invoices/` | Invoice generation + HTML |
| Coupons | `coupons/` | `coupons/` | Discount codes |
| Gift Cards | `gift-cards/` | `gift-cards/` | Gift card system |
| Chatbot | `chatbot/` | `chatbot/` | RAG + streaming AI |
| AI | `ai/` | — | pgvector embeddings, knowledge base |
| Reports | `reports/` | `reports/` | Revenue, activity, exports |
| Notifications | `notifications/` | `notifications/` | FCM push + in-app |
| Ratings | `ratings/` | `ratings/` | Practitioner ratings |
| Intake Forms | `intake-forms/` | `intake-forms/` | Pre-appointment forms |
| Whitelabel | `whitelabel/` | `settings/` | Clinic branding config |
| Roles | `roles/` | `settings/` | Custom roles |
| Permissions | `permissions/` | `settings/` | CASL permission sets |
| Clinic | `clinic/` | `settings/` | Hours, holidays |
| Email | `email/` | — | Transactional email (SMTP) |
| Email Templates | `email-templates/` | `settings/` | Editable email templates |
| Integrations | `integrations/` | `settings/` | Third-party integrations |
| Activity Log | `activity-log/` | `activity/` | Audit trail |
| Problem Reports | `problem-reports/` | — | User-submitted bug reports |
| Tasks | `tasks/` | — | Scheduled jobs (BullMQ cron) |
| Users | `users/` | `users/` | Staff user management |
| Health | `health/` | — | Healthcheck endpoint |

## Security Sensitivity Tiers

- **Owner-only** (`@tariq`): payments, ZATCA, auth, migrations, schema, CODEOWNERS
- **Standard review**: all other modules

## Design Context

### Users

**Primary**: Receptionists (daily, all-day use) and clinic admins/owners (oversight and configuration). Context: busy clinic environment — phone ringing, patients waiting, multiple tabs open. Speed and clarity are survival requirements.

**Job to be done**: Complete operational tasks fast, without friction. The UI gets out of the way.

### Brand Personality

**Three words**: Modern. Elegant. Efficient.

CareKit should feel like it belongs in a well-designed Apple environment, not a hospital IT department. Clinic owners should feel proud to show it to patients and partners.

**Emotional goals** (priority order):

1. Confidence and control — "I own the situation"
2. Speed and efficiency — "I finish in minimal steps"
3. Elegance and professionalism — "This reflects well on my clinic"
4. Ease and simplicity — "Nothing here stresses me out"

### Aesthetic Direction

**Reference**: Apple Health / iOS apps — clean hierarchy, generous whitespace, glassmorphism with restraint, information that surfaces exactly when needed.

**White-label note**: CareKit's own brand colors are Royal Blue `#354FD8` + Lime Green `#82CC17`. All color tokens are CSS custom properties — each client deployment overrides them via the white-label config. Never hardcode CareKit's colors as if they were universal; always use semantic tokens (`--primary`, `--accent`, etc.).

**Visual signature**: Frosted glass surfaces, animated gradient blobs, IBM Plex Sans Arabic, 8px grid, iOS-grade border radii, whisper-soft shadows.

**Anti-references** (never look like):

- Legacy clinic/HIS software (cluttered, gray, dated)
- ERP / SAP (complex, soul-crushing)
- Generic Bootstrap (unstyled, impersonal)
- Rigid Material Design (wrong cultural register for Arabic healthcare)

### Design Principles

1. **Surface the signal, hide the noise** — show exactly what the user needs now; secondary actions in menus
2. **Arabic-first** — RTL is not an afterthought; spatial logic and typography serve the Arabic speaker first
3. **Glass, not plastic** — semi-transparent layered surfaces; never flat white or opaque gray
4. **Speed is a feature** — optimistic updates, skeletons not spinners, instant-feeling interactions
5. **Accessible by default** — WCAG 2.1 AAA target; contrast, focus states, keyboard nav, reduced motion are correctness not polish
6. **Tokens, not colors** — always use CSS custom properties; the white-label system depends on it

### Page Anatomy — The Law (Dashboard List Pages)

Every list page follows this exact structure. No exceptions.

```text
Breadcrumbs
PageHeader: Title + Description | [Export outline] [+ Add primary]
ErrorBanner (only if error)
StatsGrid: 4× StatCard (Total/primary · Active/success · Inactive/warning · New/accent)
FilterBar (glass): [Search] [Status ▼] [Other filters ▼] [Reset]
DataTable (no Card wrapper, no background)
Pagination (only if meta.totalPages > 1)
Dialogs / Sheets (at bottom)
```

**Key rules:**

- Search input lives in **FilterBar**, not PageHeader
- Export button → `variant="outline"` in PageHeader, left of Add button
- DataTable has **no Card wrapper** — sits bare in the page flow
- Table action buttons → **icon-only** (size-9, rounded-sm) + Tooltip, no text labels
- No sub-header rows between FilterBar and DataTable
- Skeleton loading: 4× `h-[100px]` for StatsGrid, 5× `h-12` for table rows
- Dates → `toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" })`
- Status badges → `bg-success/10 text-success border-success/30` (active) / `bg-muted text-muted-foreground` (inactive)
