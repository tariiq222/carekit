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
| Payments | `payments/` | `payments/` | Moyasar webhook, owner-only |
| ZATCA | `zatca/` | `zatca/` | Saudi e-invoicing, regulated |
| Chatbot | `chatbot/` | `chatbot/` | RAG + streaming AI |
| Reports | `reports/` | `reports/` | Revenue, activity, exports |

## Security Sensitivity Tiers

- **Owner-only** (`@tariq`): payments, ZATCA, auth, migrations, schema, CODEOWNERS
- **Standard review**: all other modules
