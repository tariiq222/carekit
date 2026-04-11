# CareKit Refactor Roadmap

This document tracks maintenance cycles, known technical debt, and architectural decision records (ADRs). Updated each sprint.

**Last updated:** 2026-03-26
**Current phase:** Phase 8 — Enterprise Readiness

---

## Maintenance Cycles

### Weekly (Every Sprint)
- [ ] Run `npm run lint` across all workspaces — fix all warnings
- [ ] Review any file approaching 300 lines — refactor before it hits 350
- [ ] Check for duplicate utility functions between modules — DRY violations
- [ ] Review and merge dependency update PRs (Dependabot / Renovate)
- [ ] Verify all new endpoints have Swagger decorators and unit tests

### Monthly
- [ ] Run `npx prisma validate` — catch schema drift
- [ ] Audit unused dependencies: `npx depcheck` in each workspace
- [ ] Review translation files — find missing keys in `ar.*` or `en.*`
- [ ] Check for dead code: unused exports, orphaned components
- [ ] Review Redis key naming conventions — ensure all keys are prefixed by module
- [ ] Update `docs/operations/migration-log.md` with any new migrations

### Quarterly
- [ ] Full security audit: dependency CVEs (`npm audit`), OWASP checklist
- [ ] Database performance review: run EXPLAIN ANALYZE on slow queries
- [ ] Review and update ADRs — mark outdated decisions as superseded
- [ ] Architecture review: assess module boundaries, coupling, cohesion
- [ ] Load testing with realistic data volume (target: 100 concurrent bookings)
- [ ] Review and rotate API keys (OpenRouter, Moyasar, Zoom, FCM)

---

## Known Technical Debt

| ID | Area | Description | Priority | Status |
|----|------|-------------|----------|--------|
| TD-01 | Backend | `tasks.processor.ts` handles too many queue types — split by domain | Medium | Open |
| TD-02 | Dashboard | Some feature pages bypass `PageHeader` component — standardize | Low | Open |
| TD-03 | Backend | `chatbot.helpers.ts` prompt-building logic needs unit tests | High | Open |
| TD-04 | Mobile | Redux store has mixed concerns — split into feature slices | Medium | Open |
| TD-05 | Backend | `booking-cancel-helpers.service.ts` — refund logic tightly coupled to Moyasar | High | Open |
| TD-06 | Dashboard | `dashboard-stats.service.ts` — heavy join queries need caching layer | Medium | Open |
| TD-07 | Backend | Notification templates are hardcoded strings — move to DB or i18n files | Medium | Open |
| TD-08 | Shared | `shared/` types not exported cleanly — barrel files missing for some modules | Low | Open |

---

## Completed Refactors

| Date | Area | What was done |
|------|------|---------------|
| 2026-03-26 | Backend | Split 29 audit findings into security, resilience, and code quality fixes |
| 2026-03-26 | Backend | Consolidated migrations into single clean init migration |
| 2026-03 | Dashboard | Full DS redesign — frosted glass, semantic tokens, shadcn standardization |
| 2025-Q4 | Backend | ZATCA compliance module added with e-invoice XML generation |
| 2025-Q4 | Backend | CASL-based dynamic RBAC replacing hardcoded role checks |
| 2025-Q3 | Backend | BullMQ queues introduced for async notifications and booking tasks |

---

## Architecture Decision Records (ADRs)

### ADR-001: Monorepo with Turborepo
**Date:** 2025-Q2
**Status:** Active

**Context:** CareKit has four distinct apps (backend, dashboard, mobile, shared types). Need a way to share types and run tasks efficiently.

**Decision:** Use Turborepo monorepo. Each app is an independent workspace. Shared types live in `shared/`.

**Consequences:**
- ✅ Single git history, unified CI/CD pipeline
- ✅ Type sharing without publishing to npm
- ⚠️ All developers must install dependencies at root level (`npm install` from root)

---

### ADR-002: Prisma as Single Source of Truth
**Date:** 2025-Q2
**Status:** Active

**Context:** Need a reliable ORM with migration support for PostgreSQL.

**Decision:** All database schema lives in `backend/prisma/schema/`. Every change requires `prisma migrate dev`. `prisma db push` is forbidden.

**Consequences:**
- ✅ Migration history is auditable and reproducible
- ✅ Schema is always in sync with migrations
- ⚠️ Slightly slower than `db push` for rapid prototyping — accepted trade-off

---

### ADR-003: CASL for Authorization
**Date:** 2025-Q3
**Status:** Active

**Context:** Five default roles aren't sufficient — clients need custom roles with granular permissions per module.

**Decision:** Use CASL library with a database-driven permission system. Permissions are stored in the `Permission` table, roles are stored in `Role`, and assigned via `UserRole`.

**Consequences:**
- ✅ Fully dynamic — admin can create roles from dashboard without code changes
- ✅ Granular: view/create/edit/delete per module
- ⚠️ Permission checks must be explicit in every controller — cannot be forgotten

---

### ADR-004: OpenRouter for AI (Multi-Model)
**Date:** 2025-Q3
**Status:** Active

**Context:** Chatbot needs to work with different LLM models (cost vs quality trade-off). Locking into one provider limits flexibility.

**Decision:** Use OpenRouter as the AI gateway. Model selection is configurable per client in White Label settings.

**Consequences:**
- ✅ Can switch models (GPT-4, Claude, Gemini) without code changes
- ✅ Single API key for all models
- ⚠️ Adds one network hop — acceptable latency for chatbot use case

---

### ADR-005: Moyasar as Primary Payment Gateway
**Date:** 2025-Q3
**Status:** Active

**Context:** Platform targets Saudi Arabia market. Must support Mada, Apple Pay, local bank transfers.

**Decision:** Moyasar for card payments (Mada, Visa, MC, Apple Pay). Bank transfer with AI receipt verification as secondary method.

**Consequences:**
- ✅ Full Saudi payment coverage
- ✅ No international payment complexity
- ⚠️ Bank transfer verification requires manual admin approval — adds latency

---

### ADR-006: No SMS — Email OTP Only
**Date:** 2025-Q2
**Status:** Active

**Context:** SMS costs are high and add vendor dependency. Target market (Saudi clinics) has reliable email access.

**Decision:** Client auth uses email OTP only. No SMS for any flow.

**Consequences:**
- ✅ Zero SMS costs
- ✅ No Twilio/SMS vendor dependency
- ⚠️ Clients without email access cannot use the platform — accepted trade-off for B2B clinic context

---

### ADR-007: RTL-First Design
**Date:** 2025-Q2
**Status:** Active

**Context:** Primary market is Saudi Arabia (Arabic). Arabic UI is not an afterthought — it's the primary experience.

**Decision:** All UI components are designed RTL-first using Tailwind `start`/`end` directional utilities. English (LTR) is a secondary layout that must also work.

**Consequences:**
- ✅ Native Arabic UX from day one
- ✅ Enforces use of `ps-`/`pe-` instead of `pl-`/`pr-` — no directional bugs
- ⚠️ Requires testing every component in both directions

---

### ADR-008: White Label via Docker Per Client
**Date:** 2025-Q2
**Status:** Active

**Context:** Each clinic client needs independent branding, data isolation, and deployment control.

**Decision:** Each client gets an independent Docker deployment on their server. All branding (logo, colors, name, domain) is configurable from the White Label settings panel without code changes.

**Consequences:**
- ✅ Complete data isolation per client
- ✅ Independent scaling per client
- ⚠️ Updates must be deployed to each client separately — requires automation tooling (Dokploy)

---

### ADR-009: Frosted Glass Design System
**Date:** 2026-Q1
**Status:** Active

**Context:** Dashboard needed a distinct, modern visual identity that differentiates the product while remaining professional for clinic staff.

**Decision:** iOS-inspired frosted glass aesthetic. Semi-transparent cards with `backdrop-blur`, semantic color tokens in `globals.css`, Hugeicons React icon library only.

**Consequences:**
- ✅ Distinctive visual identity for the dashboard
- ✅ Consistent via strict token enforcement — no ad-hoc colors allowed
- ⚠️ `backdrop-filter` has performance cost on low-end hardware — mitigated by limiting blur to card surfaces only

---

### ADR-010: BullMQ for Async Tasks
**Date:** 2025-Q3
**Status:** Active

**Context:** Booking expiry, cancellation timeouts, no-show detection, and notification sending are time-sensitive background tasks that must survive server restarts.

**Decision:** BullMQ (Redis-backed) for all async task queues. Four queues: `notifications`, `booking-events`, `payments`, `cleanup`.

**Consequences:**
- ✅ Jobs survive server restarts (Redis-persistent)
- ✅ Retry logic built-in
- ✅ Job monitoring via Bull Board UI
- ⚠️ Redis becomes a critical dependency — must be in HA mode for production
