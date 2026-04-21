# CareKit — White-label Clinic Management Platform

Single-organization mode: one deployment serves one clinic. No tenant layer — a clinic can still have multiple physical branches.

## Orchestration: Maestro v10

This repo uses **Maestro v10** to orchestrate multi-agent work. For anything touching 2+ files, route through Maestro first. Entry points:

- `MAESTRO.md` — activation modes (`/plan`, `/execute`, `/verify`, `/maestro`, `/output-style maestro`)
- `AGENTS.md` — agent roster + flow (Yazid/Fahad/Sultan + Sonnet team + Abdullah/Omar)
- `PATHS.md` — FAST / STANDARD / DEEP budgets, gates, and npm scripts
- `WORKTREES.md` — DEEP path worktree protocol (ports 5110 / 5120 / 5130)
- `QUICK_REFERENCE.md` — cheat sheet
- `.claude/agents/*.md` — per-agent specs (router, maestro, explorer, architect, backend, frontend, tester, type-checker, security, refactor, docs, devops, historian)
- `.claude/commands/*.md` — `/plan`, `/execute`, `/verify`, `/maestro`
- `.claude/output-styles/maestro.md` — persistent Maestro mode

## Tech Stack

- **Monorepo**: npm workspaces + Turborepo
- **Backend**: NestJS 11, Prisma 7 (PostgreSQL + pgvector), BullMQ, Redis, MinIO
- **Dashboard (admin)**: Next.js 15 (App Router) + React 19, TanStack Query, shadcn/ui, Tailwind 4, next-intl (AR/EN)
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
- **Semantic tokens only** — no hex colors, no `text-gray-*`; always use CSS custom properties so the branding system works

## Commands

```bash
# Root (Turborepo — wraps `turbo run <task> --filter=<pkg>`)
npm run dev:backend       # NestJS on :5100
npm run dev:dashboard     # Next.js dashboard on :5103
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
npm run seed              # Seed demo data
npm run prisma:studio     # Prisma Studio GUI

# Dashboard (cd apps/dashboard)
npm run dev               # Next.js dev server on :5103
npm run build             # next build
npm run typecheck         # tsc --noEmit
npm run lint              # ESLint
npm run test              # Vitest
# Dashboard e2e: manual QA via Chrome DevTools MCP (see memory); Playwright removed 2026-04-16

# Kiwi TCMS — single source of truth (Product = "CareKit" ONLY)
# URL https://localhost:6443  ·  admin / CareKit_2026  ·  never create a second product
npm run test:kiwi           # unit tests → Kiwi (via /c/pro/kiwi-tcms/run-and-sync.sh)
npm run test:kiwi:e2e       # E2E → Kiwi
npm run test:kiwi:all       # unit + E2E
npm run kiwi:sync-manual data/kiwi/<domain>-<date>.json   # manual QA run → Kiwi

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
│   ├── dashboard/        # Next.js 15 admin dashboard (App Router)
│   │   ├── app/(dashboard)/  # Feature routes
│   │   ├── components/       # ui/ (shadcn) + features/
│   │   ├── hooks/            # TanStack Query hooks
│   │   └── lib/              # api/, schemas/, types/, utils
│   └── mobile/           # Expo — Client + Employee apps
│       ├── app/(client)/      # Client flows (booking, appointments, chat)
│       ├── app/(employee)/ # Employee flows
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
See `apps/dashboard/CLAUDE.md` for dashboard layer rules and DS spec.
See `apps/mobile/CLAUDE.md` for Expo Router conventions.

## Key Domains

"Dashboard Route" below refers to routes inside **apps/dashboard** (`app/(dashboard)/`).

| Domain | Backend Module | Dashboard Route | Notes |
|--------|---------------|-----------------|-------|
| Auth | `auth/` | — | JWT + refresh tokens, CASL RBAC |
| Bookings | `bookings/` | `bookings/` | Recurring, waitlist, walk-in |
| Clients | `clients/` | `clients/` | Walk-in support |
| Employees | `employees/` | `employees/` | Availability scheduler |
| Services | `services/` | `services/` | Clinic service catalog |
| Specialties | `specialties/` | `specialties/` | Employee specialties |
| Branches | `branches/` | `branches/` | Multi-branch support |
| Payments | `payments/` | `payments/` | Moyasar webhook, owner-only |
| ZATCA | `zatca/` | `zatca/` | Saudi e-invoicing, regulated |
| Invoices | `invoices/` | `invoices/` | Invoice generation + HTML |
| Coupons | `coupons/` | `coupons/` | Discount codes |
| Chatbot | `chatbot/` | `chatbot/` | RAG + streaming AI |
| AI | `ai/` | — | pgvector embeddings, knowledge base |
| Reports | `reports/` | `reports/` | Revenue, activity, exports |
| Notifications | `notifications/` | `notifications/` | FCM push + in-app |
| Ratings | `ratings/` | `ratings/` | Employee ratings |
| Intake Forms | `intake-forms/` | `intake-forms/` | Pre-appointment forms |
| Branding | `org-experience/branding/` | `branding/` | Clinic branding config |
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

## Kiwi TCMS — the single source of truth

All automated + manual QA results land in the local Kiwi TCMS at `https://localhost:6443` (admin / `CareKit_2026`).

**Hard rules (violating these is the #1 way we make a mess):**

- **One Product only: `CareKit`** (id=1). Never create "CareKit Dashboard", "CareKit Mobile", etc. Domains are distinguished by **Category** (Bookings, Clients, Employees, …) and by **Plan type** (Unit, E2E, Manual QA), never by a new Product.
- **Version `main`** is the canonical version. Reuse it for every run unless you're tagging a release.
- **Builds name the session**, not the product: `local-dev`, `manual-qa-2026-04-17`, `bookings-qa-fixes`. Create with `Build.create` on the existing `main` version — never on a new product.
- **One TestPlan per (domain, type)**: e.g. `CareKit / Bookings / Manual QA`, `CareKit / Bookings / Unit`, `CareKit / Bookings / E2E`. Reuse on re-runs.
- **Test cases are idempotent** — lookup `TestCase.filter({ summary, category })` before creating.

**Existing sync scripts (don't write new ones — extend these):**

- Automated: `/c/pro/kiwi-tcms/run-and-sync.sh` + the Python helpers beside it. Triggered via `npm run test:kiwi{,:e2e,:all}`.
- Manual QA: `scripts/kiwi-sync-manual-qa.mjs` — reads a plan JSON from `data/kiwi/<domain>-<date>.json` and writes under `Product="CareKit"`. Triggered via `npm run kiwi:sync-manual data/kiwi/<domain>-<date>.json`.

**Manual QA workflow (authoritative):**

1. Run the QA gate in Chrome DevTools MCP against the feature.
2. Write findings to `docs/superpowers/qa/<feature>-report-<date>.md` (report + screenshots).
3. Author a plan JSON at `data/kiwi/<domain>-<date>.json` with `{ domain, version, build, planName, planSummary, runSummary, cases: [{ summary, text, result }] }`.
4. `npm run kiwi:sync-manual data/kiwi/<domain>-<date>.json` — idempotent, reuses Plan/Run IDs.
5. Link Kiwi URLs (`/plan/<id>/`, `/runs/<id>/`) from the report.

**When in doubt**, inspect the DB with:
```
docker exec kiwi_web bash -c 'cd /Kiwi && python manage.py shell < /tmp/<script>.py'
```
— never spin up a parallel product to "test" the import.

## Design Context

### Users

**Primary**: Receptionists (daily, all-day use) and clinic admins/owners (oversight and configuration). Context: busy clinic environment — phone ringing, clients waiting, multiple tabs open. Speed and clarity are survival requirements.

**Job to be done**: Complete operational tasks fast, without friction. The UI gets out of the way.

### Brand Personality

**Three words**: Modern. Elegant. Efficient.

CareKit should feel like it belongs in a well-designed Apple environment, not a hospital IT department. Clinic owners should feel proud to show it to clients and partners.

**Emotional goals** (priority order):

1. Confidence and control — "I own the situation"
2. Speed and efficiency — "I finish in minimal steps"
3. Elegance and professionalism — "This reflects well on my clinic"
4. Ease and simplicity — "Nothing here stresses me out"

### Aesthetic Direction

**Reference**: Apple Health / iOS apps — clean hierarchy, generous whitespace, glassmorphism with restraint, information that surfaces exactly when needed.

**Branding note**: CareKit's own brand colors are Royal Blue `#354FD8` + Lime Green `#82CC17`. All color tokens are CSS custom properties — each client deployment overrides them via the branding config. Never hardcode CareKit's colors as if they were universal; always use semantic tokens (`--primary`, `--accent`, etc.).

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
6. **Tokens, not colors** — always use CSS custom properties; the branding system depends on it

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
