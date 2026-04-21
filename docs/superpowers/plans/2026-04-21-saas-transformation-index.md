# CareKit SaaS Transformation — Plan Index

> **Meta-plan.** This document lists every phase of the SaaS transformation. Each phase is a separate plan file with its own task list. Execute in order — each plan depends on the ones before it.

**Goal:** Transform CareKit from a single-organization deployment into a bilingual (AR/EN), multi-vertical, multi-tenant SaaS platform with custom domains and a premium-tier website add-on.

**Strategy:** Strangler pattern. Add new primitives beside existing code. Migrate cluster-by-cluster. Keep the system deployable at every checkpoint.

**Estimated total:** 8.5–10.5 months for 2–3 engineers; 13–15 months solo.

**Frontend app topology (post-transformation):**
```
apps/
├── backend/       ← NestJS API (src/api/dashboard + mobile + public + platform)
├── dashboard/     ← Tenant staff dashboard (existing; {slug}.carekit.app)
├── admin/         ← NEW — CareKit super-admin panel (admin.carekit.app)
├── landing/       ← NEW — marketing + signup (carekit.app)
├── website/       ← Tenant client-facing booking (existing; clinic.com)
└── mobile/        ← Paused

packages/
├── api-client/    ← Existing
├── shared/        ← Existing
└── ui/            ← NEW — shared shadcn primitives (extracted in Plan 05a)
```

---

## Phase map

| # | Plan | Scope | Dependencies | Target duration |
|---|---|---|---|---|
| 01 | [Multi-tenancy Foundation](./2026-04-21-saas-01-multi-tenancy-foundation.md) | Organization + Membership models, TenantContext service, resolver middleware (dormant), Prisma scoping extension (dormant), RLS scaffolding, isolation test harness | — | 2 weeks |
| 02 | **SaaS-02 Tenant Enforcement Rollout** — decomposed into 8 sub-plans, executed in order. Each delivers a PR-ready cluster rollout. | 01 | 3 weeks |
| 02a | [Identity cluster rollout](./2026-04-21-saas-02a-identity-cluster.md) — RefreshToken, ClientRefreshToken, CustomRole, Permission | 01 | 2–3 days |
| 02b | [People cluster rollout](./2026-04-21-saas-02b-people-cluster.md) — Client, ClientRefreshToken, Employee, EmployeeBranch, EmployeeService, EmployeeAvailability, EmployeeAvailabilityException + client auth tenant-awareness | 02a | 3 days |
| 02c | Org-config + org-experience rollout — Branch, Department, ServiceCategory, Service (+ variants), BusinessHour, Holiday, IntakeForm/Field, Rating + convert BrandingConfig & OrganizationSettings singletons | 02b | 4 days |
| 02d | Bookings cluster rollout — Booking, BookingStatusLog, Waitlist, GroupSession et al + convert BookingSettings singleton | 02c | 3 days |
| 02e | Finance cluster rollout — Invoice, Payment, Coupon, RefundRequest, ZatcaSubmission + convert ZatcaConfig singleton | 02d | 3 days |
| 02f | Comms cluster rollout — EmailTemplate, Notification, ChatConversation/Message/Session, CommsChatMessage, ContactMessage + convert ChatbotConfig singleton | 02e | 2 days |
| 02g | AI + media + ops + platform rollout — KnowledgeDocument, DocumentChunk, File, ActivityLog, Report, FeatureFlag, Integration, ProblemReport + convert SiteSetting singleton | 02f | 2 days |
| 02h | Strict mode + penetration tests — flip `TENANT_ENFORCEMENT=strict`; add adversarial cross-tenant test suite | 02g | 2 days |
| 03 | SaaS-03 Verticals System | `Vertical`, `VerticalSeedService`, `VerticalSeedDepartment` models. Seed 8 vertical templates. Terminology packs infrastructure (`terminology/<pack>.ar.json`, `.en.json`). `useTerminology()` hook. | 02 | 2 weeks |
| 04 | SaaS-04 Billing & Subscriptions | `Plan`, `Subscription` models. Moyasar subscription adapter. Webhook handler. `PlanLimitsGuard`. Usage metering BullMQ job. Trial + grace-period state machine. | 02 | 2 weeks |
| 05a | [**SaaS-05a Shared UI Package Extraction**](./2026-04-21-saas-05a-packages-ui-extraction.md) — extract 35 shadcn primitives from `apps/dashboard/components/ui` into new `packages/ui/` workspace. No behavior change — pure move + re-export. Unblocks 05b and 07. Can run in parallel with 02f/02g. | 02a | 3 days |
| 05b | **SaaS-05b Super-admin App** — new `apps/admin/` Next.js app on `admin.carekit.app`. Consumes `packages/ui` + `packages/api-client`. Pages: `/organizations`, `/organizations/[id]`, `/metrics`, `/impersonate`, `/subscriptions`. Auth via same backend login but requires `isSuperAdmin: true` in JWT; UI redirects non-super-admins to marketing site. Uses `src/api/platform/*` backend endpoints (also new). Includes impersonation flow (short-lived scoped JWT + audit log). | 04, 05a | 2 weeks |
| 06 | SaaS-06 Dashboard Terminology + EN i18n | Full `t()`/`tp()` refactor of dashboard strings. Complete English translation of every user-facing string. RTL/LTR toggle. Feature-gating UI components. Tenant switcher. Billing UI. Consumes `packages/ui`. | 03, 04, 05a | 3 weeks |
| 07 | SaaS-07 Marketing Site + Signup Wizard | New `apps/landing/` Next.js app. `carekit.app` domain. Bilingual landing pages. `/for/<vertical>` pages × 8. Pricing page. 5-step signup wizard with vertical picker, slug availability check, Moyasar payment capture. Consumes `packages/ui`. | 03, 04, 05a | 3 weeks |
| 08 | SaaS-08 Website Multi-tenant + Vertical Themes | `apps/website/themes/` refactor into `visual/` + `vertical/`. 4 vertical templates (medical / consulting / salon / fitness). Conditional routing based on vertical. Multi-tenant host middleware. Bilingual SEO with hreflang. Embed widget for Starter tier. | 06 | 4 weeks |
| 09 | SaaS-09 Custom Domain + Infra | Caddy with on-demand TLS. Wildcard cert `*.carekit.app`. DNS verification BullMQ worker. Domain status state machine. `/settings/domain` UI. Rollout to staging, then prod. | 08 | 1.5 weeks |
| 10 | SaaS-10 Hardening & Launch | Isolation penetration test suite. Per-tenant rate limiting. Per-tenant Sentry tags + Prometheus labels. Performance audit (EXPLAIN on hot queries). Load test at 100 orgs × 10k bookings. Data export per-org. Runbook + oncall docs. | 01–09 | 3 weeks |

---

## Scope Lock (agreed 2026-04-21)

- **Super-admin dashboard:** separate app (`apps/admin/` on `admin.carekit.app`). Not a sub-route of the tenant dashboard. Tenants never download super-admin JS. Auth is shared: same `POST /api/v1/auth/login`, but super-admin UI requires `isSuperAdmin: true` JWT claim. Decided 2026-04-21.
- **Verticals in MVP:** 8 (dental, cosmetic, dermatology, physiotherapy, family consulting, psychology, nutrition, barbershop, beauty salon, spa, nails). Group into 4 template families for MVP: medical / consulting / salon / fitness.
- **Languages:** Arabic (default) + English, fully localized everywhere (backend data, dashboard, website, marketing site).
- **Website:** premium tier add-on. Starter tier uses embed widget only.
- **Custom domain:** enabled. Per-tenant SSL via Caddy on-demand.
- **sawaa:** project demo; gets refactored into "consulting vertical template" during Plan 08. No existing customer to preserve.
- **Isolation strategy:** Shared DB + `organizationId` column + Prisma middleware + Postgres Row-Level Security as defense-in-depth.
- **Backfill strategy:** one well-known default organization UUID receives all historical data during Plan 02; no data loss.

---

## Red-flag invariants

These MUST remain true through every plan:

1. **System deployable at every task boundary.** No plan leaves the codebase in a non-functional state.
2. **No single big-bang release.** Features roll behind flags; orgs opt in.
3. **Every cross-cluster event payload includes `organizationId`.** Enforced via `BaseEvent` type, compile-time.
4. **Every `$queryRaw` includes an `organization_id` predicate.** Enforced via code review + RLS backstop.
5. **Migrations are immutable** (root CLAUDE.md rule). Add new migrations; never edit old.
6. **Isolation test suite runs in CI** starting from Plan 01. Any cross-tenant read = red build.

---

## Lessons carried forward (from executed plans)

Pre-flight checks that every cluster-rollout plan MUST perform before committing to plan-authored code:

1. **Grep ALL callsites** of any service/handler being modified — controllers, other handlers, tests. Plans' "File Structure" section captures intent but not completeness. Example from 02a: an extra `auth.controller.ts:109` callsite of `TokenService.issueTokenPair` was missed by the plan.
2. **`test/setup.ts` may not exist** — create `test/jest.setup.ts` and wire via `setupFiles` in `jest-e2e.json` / `jest.config.ts`. Don't assume a pre-existing setup file.
3. **`TENANT_ENFORCEMENT=off` must keep working** during rollout. Any handler that calls `tenant.requireOrganizationId()` needs a `tenant.requireOrganizationIdOrDefault()` sibling that falls back to `DEFAULT_ORGANIZATION_ID` when unset. Use the `OrDefault` variant in handlers that can be hit by unauthenticated or system-level callers.
4. **`npx prisma migrate dev` can conflict with pgvector hooks** — if it refuses to generate SQL cleanly, write the migration file manually following Prisma's conventions.
5. **RLS tests need a non-superuser Postgres role** — PG superusers bypass RLS even with `FORCE ROW LEVEL SECURITY`. Isolation e2e specs that exercise policies via raw SQL must connect (or `SET ROLE`) to a non-superuser.
6. **Divergence-before-commit protocol:** if reality disagrees with the plan, STOP, document the divergence, propose amendments, execute only after confirmation. Commits authored on bad assumptions are expensive to unwind.

---

## Critical files that every plan must update

- `apps/backend/CLAUDE.md` — currently says "no tenantId". Plan 02 rewrites the relevant sections.
- `CLAUDE.md` (root) — update "Single-organization mode" note when SaaS ships; add `apps/admin/` + `apps/landing/` + `packages/ui/` to the Structure tree after Plans 05b / 07 land.
- `apps/dashboard/CLAUDE.md` — add terminology usage rules in Plan 06.
- `apps/admin/CLAUDE.md` — NEW, authored in Plan 05b. Documents super-admin conventions (no tenant context; always `isSuperAdmin=true`; audit-log every destructive action).
- `packages/ui/CLAUDE.md` — NEW, authored in Plan 05a. Documents what belongs in shared UI vs app-specific components.
