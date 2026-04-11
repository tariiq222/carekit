# CareKit

**White-label smart clinic management platform** — built by WebVue Technology Solutions.

Includes a mobile app (iOS + Android), admin dashboard, AI chatbot assistant, and ZATCA-compliant invoicing. Each client gets an independent Docker deployment with fully configurable branding.

---

## Quick Start

```bash
npm install
cp .env.example .env     # fill in secrets
cd apps/backend && npx prisma migrate dev && npx prisma db seed && cd ../..
npm run dev:all
```

| Service | URL |
|---------|-----|
| Backend API | <http://localhost:5100> |
| Swagger Docs | <http://localhost:5100/api/docs> |
| Dashboard (admin) | <http://localhost:5103> |
| Mobile (Expo) | <http://localhost:5102> |

> Ports 5000–5999 are reserved exclusively for CareKit environments.

---

## Apps

| App | Tech | Description |
|-----|------|-------------|
| `apps/backend/` | NestJS 11 + Prisma 7 + PostgreSQL | API server, business logic, BullMQ jobs |
| `apps/dashboard/` | Next.js 15 + React 19 + shadcn/ui | Admin dashboard for clinic staff |
| `apps/mobile/` | React Native 0.83 (Expo SDK 55) | Patient + practitioner mobile app |
| `packages/api-client/` | TypeScript | `@carekit/api-client` — typed fetch client shared by UIs |
| `packages/shared/` | TypeScript | `@carekit/shared` — cross-app types, enums, i18n tokens |

---

## Key Features

- **Booking system** — clinic visit, phone & video consultations, double-booking protection
- **Dynamic RBAC** — 5 default roles + custom roles via CASL
- **Payment processing** — Moyasar (Mada, Apple Pay, Visa/MC) + bank transfer with AI receipt verification
- **AI Chatbot** — OpenRouter-powered, books appointments, answers clinic questions in Arabic & English
- **ZATCA compliance** — Saudi e-invoice XML generation and submission
- **White label** — logo, colors, app name, domain, payment keys — all configurable per client
- **RTL-first** — Arabic is the primary UI language, English is fully supported
- **Multi-branch** — single deployment can manage multiple clinic locations

---

## Documentation

Start here depending on your role:

| You are... | Start with |
|-----------|------------|
| New developer | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Reviewing architecture | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Working on Dashboard UI | [`dashboard/DESIGN-SYSTEM.md`](dashboard/DESIGN-SYSTEM.md) |
| Working on Dashboard code | [`dashboard/ARCHITECTURE.md`](dashboard/ARCHITECTURE.md) |
| Designing a new feature | [`docs/core/api-spec.md`](docs/core/api-spec.md) |
| Checking roadmap | [`docs/progress/sprint-plan.md`](docs/progress/sprint-plan.md) |
| Reviewing technical debt | [`docs/refactor-roadmap.md`](docs/refactor-roadmap.md) |
| Checking who owns what | [`CODEOWNERS`](CODEOWNERS) |

---

## Tech Stack

**Backend:** NestJS 11 · Prisma 7 · PostgreSQL 16 (pgvector) · Redis 7 · BullMQ
**Dashboard:** Next.js 15 (App Router) · React 19 · TanStack Query · shadcn/ui · Tailwind CSS v4 · next-intl
**Mobile:** React Native 0.83 · Expo SDK 55 · Expo Router · Redux Toolkit
**AI:** OpenRouter (multi-model) · pgvector
**Payments:** Moyasar
**Storage:** MinIO (S3-compatible, self-hosted)
**Notifications:** Firebase FCM
**Video:** Zoom API
**Deployment:** Docker Compose · Dokploy

---

## Critical Rules

1. **No file exceeds 350 lines** — split by responsibility
2. **All DB changes via Prisma migrations** — never `prisma db push`, never manual SQL
3. **Semantic tokens only** — no hex colors, no `text-gray-*`; the white-label system depends on CSS custom properties
4. **RTL layout** — use `start`/`end`, `ps-`/`pe-` — never `left`/`right` hardcoded
5. **Ports 5000–5999** reserved exclusively for CareKit environments

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full pre-PR checklist.

---

## Project Status

**Phase 8 — Enterprise Readiness** (current)

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1–4 | ✅ Complete | Backend foundation, ZATCA, testing, security |
| Phase 5 | ✅ Complete | Dashboard redesign — frosted glass DS |
| Phase 6 | 🔲 Planned | Client website (custom design per client) |
| Phase 7 | 🔲 Planned | Mobile app polishing + app store deployment |
| Phase 8 | 🔄 Active | Enterprise readiness, production hardening |
| Phase 9 | 🔲 Planned | Testing & delivery |

Full roadmap: [`docs/progress/sprint-plan.md`](docs/progress/sprint-plan.md)

---

*Built with care by [WebVue Technology Solutions](https://webvue.sa)*
