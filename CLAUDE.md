# CareKit — White-label Clinic Management Platform

## Tech Stack

- **Monorepo**: npm workspaces + Turborepo
- **Backend**: NestJS 11, Prisma 7 (PostgreSQL + pgvector), BullMQ, Redis, MinIO
- **Dashboard**: Next.js 15 (App Router), React 19, TanStack Query, shadcn/ui, Tailwind 4
- **Mobile**: React Native 0.83, Expo SDK 55, Expo Router, Redux Toolkit
- **Shared**: Types, enums, i18n tokens shared across all apps
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

## Commands

```bash
# Root (Turborepo)
npm run dev:backend       # NestJS on :5000
npm run dev:dashboard     # Next.js on :5001
npm run dev:mobile        # Expo on :5002
npm run dev:all           # All apps in parallel
npm run docker:up         # Start PostgreSQL, Redis, MinIO
npm run docker:down       # Stop infrastructure

# Backend (cd backend/)
npm run dev               # Watch mode
npm run test              # Jest unit tests
npm run test:cov          # Coverage (40% branch, 50% fn/line)
npm run prisma:migrate    # Run pending migrations
npm run prisma:seed       # Seed demo data
npm run prisma:studio     # Prisma Studio GUI

# Dashboard (cd dashboard/)
npm run dev               # Next.js dev server
npm run typecheck         # tsc --noEmit
npm run lint              # ESLint

# Mobile (cd mobile/)
npm run dev               # Expo start
npm run ios / android     # Native builds
npm run test              # Jest + jest-expo
```

## Structure

```
carekit/
├── backend/              # NestJS API — all business logic
│   ├── prisma/schema/    # Split schemas (one per domain, immutable migrations)
│   ├── src/common/       # Guards, filters, interceptors, decorators, pipes
│   └── src/modules/      # Feature modules (25+ domains)
├── dashboard/            # Next.js admin dashboard (RTL-first, Frosted Glass DS)
│   ├── app/(dashboard)/  # Route pages (orchestration only, ≤120 lines)
│   ├── components/       # ui/ (shadcn) + features/ (domain components)
│   ├── hooks/            # TanStack Query hooks
│   └── lib/              # api/, types/, schemas/, translations/
├── mobile/               # Expo — Patient + Practitioner apps
│   ├── app/(patient)/    # Patient flows (booking, appointments, chat)
│   ├── app/(practitioner)/ # Practitioner flows
│   ├── services/         # Axios API clients
│   └── stores/           # Redux Toolkit slices
├── shared/               # Cross-app types, enums, i18n
├── docker/               # docker-compose.yml + Nginx config
└── docs/                 # Architecture, audits, feature specs
```

## Module Map

See `backend/CLAUDE.md` for NestJS module conventions.
See `dashboard/CLAUDE.md` for Next.js layer rules.
See `mobile/CLAUDE.md` for Expo Router conventions.

## Key Domains

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
