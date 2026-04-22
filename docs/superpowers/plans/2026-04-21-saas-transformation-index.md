# CareKit SaaS Transformation — Plan Index

> **Meta-plan.** This document lists every phase of the SaaS transformation. Each phase is a separate plan file with its own task list. Execute in order — each plan depends on the ones before it.

**Goal:** Transform CareKit from a single-organization deployment into a bilingual (AR/EN), multi-vertical, multi-tenant SaaS platform with custom domains and a premium-tier website add-on.

**Strategy:** Strangler pattern. Add new primitives beside existing code. Migrate cluster-by-cluster. Keep the system deployable at every checkpoint.

**Estimated total:** 8.5–10.5 months for 2–3 engineers; 13–15 months solo.

---

## 📊 Current Status — updated 2026-04-21

**Progress:** 5 / 18 phases merged (28%) · 3 phases executed awaiting merge · 10 plans written awaiting execution.

```
Phase 01  ✅ MERGED     Multi-tenancy Foundation
Phase 02a ✅ MERGED     Identity cluster (PR #15)
Phase 02b ✅ MERGED     People cluster (PR #16)
Phase 02c ✅ MERGED     Org-config + singletons (PR #17)
Phase 02d ✅ MERGED     Bookings cluster (PR #18)
Phase 02e 🟡 EXEC       Finance cluster — PR #19 (plan) + PR #21 (impl); owner-review required (ZATCA + Moyasar)
Phase 05a 🟡 EXEC       packages/ui extraction — PR #20; needs UI QA before merge
Phase 02f 🟡 EXEC       Comms cluster — PR #24 (impl); 8 models scoped, ChatbotConfig singleton; ready-for-review
Phase 02g 🟢 WRITTEN    AI + media + ops + platform (1027 lines)
Phase 02h 🟢 WRITTEN    Strict mode + penetration (771 lines)
Phase 03  🟡 EXEC       Verticals System — PR #25 (impl); 60 unit + 22 e2e green; ready-for-review
Phase 04  🟢 WRITTEN    Billing & Subscriptions (1291 lines) — owner-review gate at Task 1
Phase 05b 🟢 WRITTEN    Super-admin app (1510 lines) — impersonation owner-review gate
Phase 06  🟢 WRITTEN    Dashboard terminology + EN i18n (1050 lines)
Phase 07  🟢 WRITTEN    Marketing site + signup (940 lines) — JWT + Moyasar touches
Phase 08  🟢 WRITTEN    Website multi-tenant + themes (881 lines)
Phase 09  🟢 WRITTEN    Custom domain + infra (785 lines) — Nginx→Caddy migration
Phase 10  🟢 WRITTEN    Hardening + launch (760 lines)
```

**🎯 Next action (for executor):** review + merge PR #19 (plan) → PR #21 (02e impl); run UI QA on PR #20 (05a) then merge; review PR #24 (02f comms impl). Parallel-safe execution candidates after 02e + 02f land: 02g, 03.

**🔭 Next action (for planner/me):** all 18 plans written. No further plan authorship pending. Monitor execution, propagate lessons, refine plans if divergences surface.

**🚧 Active risks:**
- Prisma 7 `$extends` via Proxy works (confirmed in 02a–02e) — no further risk.
- **`$transaction` callback form bypasses Proxy** — confirmed in 02d (5 handlers) and 02e (2 handlers: apply-coupon, process-payment). Lesson 11 documented.
- 02e owner-gated (ZATCA + Moyasar) — PR #21 open awaiting owner sign-off on moyasar-webhook 3-stage tenant resolution.
- 04 (Billing) touches Moyasar subscription charging — separate webhook from 02e's booking webhook; owner-review at Task 1. **Owner decisions integrated into plan body 2026-04-22** (see top-of-plan "Owner decisions integrated" section): hybrid overage model (Tasks 8/8B/9C), 2-day grace period (Task 9D), `CLIENTS` metric + `Plan.maxClients`, `NOTIFICATIONS_PER_MONTH` removed (SMS deferred to Plan 02g-sms), two-Moyasar separation, authoritative tier prices (Basic 299 / Pro 799 / Enterprise 1999 SAR monthly).
- 05b (Admin) introduces `$allTenants` escape hatch + impersonation flow — owner-review gate at Task 0. **Security invariants integrated 2026-04-22** into Plan 05b (new "Security invariants — runtime-enforced, not convention" section + Tasks 3/3.5/4/4.5 + §7A shadow-JWT shape): (1) `$allTenants` CLS-gated via `SUPER_ADMIN_CONTEXT_CLS_KEY` (mirrors 02e `SYSTEM_CONTEXT_CLS_KEY`); (2) `AdminHostGuard` rejects non-admin hosts; (3) `JwtAuthGuard` checks `Organization.suspendedAt` with Redis 30-s cache + `ORG_SUSPENDED` error code; (4) impersonation shadow JWT OMITS `isSuperAdmin` and carries `scope: 'impersonation'`. ESLint rule restricts `$allTenantsUnsafe` to `src/common/guards/**`. Owner-review gate at Task 0 still mandatory.
- 02h (Strict mode) — flipping `TENANT_ENFORCEMENT=strict` has blast radius ≈ payments outage. **Promote to owner-gated** with canary + per-module rollback before execution.
- 07 (Marketing + signup) — `organizationSlug` JWT claim needs sub-spec: refresh-flow re-lookup from DB, migration/invalidation path for pre-07 tokens, explicit "display-only, authz uses tenantId" rule. Integrate into Plan 07 Task 0 before executing.
- **Plan 02g-sms (NEW, not yet written)** — per-tenant SMS provider refactor (Unifonic + Taqnyat adapters + `OrganizationSmsConfig` singleton). Required before Plan 04 execution since Plan 04 amendments remove platform SMS billing. Place in dependency chain after 02f (Comms cluster).
- 09 (Custom domain) requires Nginx→Caddy swap — 7-day parallel-run mitigates; owner-approval gate before cutover.
- Pre-existing e2e failures on main (bookings flows, identity login) — triaged separately, not blocking 02e.

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

Status legend: ✅ done · 🟢 plan ready · 🟡 plan being written · ⚪ pending (I'll write when upstream lands)

| # | Plan | Status | PR | Dependencies | Duration |
|---|---|---|---|---|---|
| 01 | [Multi-tenancy Foundation](./2026-04-21-saas-01-multi-tenancy-foundation.md) | ✅ DONE (2026-04-21) | — | — | 2 weeks |
| 02a | [Identity cluster rollout](./2026-04-21-saas-02a-identity-cluster.md) | ✅ DONE (2026-04-21) | [#15](https://github.com/tariiq222/carekit/pull/15) | 01 | 2–3 days |
| 02b | [People cluster rollout](./2026-04-21-saas-02b-people-cluster.md) | ✅ DONE (2026-04-21) | [#16](https://github.com/tariiq222/carekit/pull/16) | 02a | 3 days |
| 02c | [Org-config + singletons rollout](./2026-04-21-saas-02c-org-config-singletons.md) | ✅ DONE (2026-04-21) | [#17](https://github.com/tariiq222/carekit/pull/17) | 02b | 4 days |
| 02d | [Bookings cluster rollout](./2026-04-21-saas-02d-bookings-cluster.md) | ✅ DONE (2026-04-21) | [#18](https://github.com/tariiq222/carekit/pull/18) | 02c | 3 days |
| 02e | [Finance cluster rollout](./2026-04-21-saas-02e-finance-cluster.md) (Invoice, Payment, Coupon, RefundRequest, ZatcaSubmission + ZatcaConfig singleton) ⚠️ owner-review required | 🟡 EXEC | [#21](https://github.com/tariiq222/carekit/pull/21) | 02d | 3 days |
| 02f | [Comms cluster rollout](./2026-04-21-saas-02f-comms-cluster.md) (EmailTemplate, Notification, ChatConversation/Message/Session + ChatbotConfig singleton) | 🟢 WRITTEN | — | 02e | 2 days |
| 02g | [AI + media + ops + platform rollout](./2026-04-21-saas-02g-ai-media-ops-platform.md) (KnowledgeDocument, DocumentChunk, File, ActivityLog, Report, FeatureFlag, Integration, ProblemReport + SiteSetting singleton) | 🟢 WRITTEN | — | 02f | 2 days |
| 02g-sms | [Per-tenant SMS provider refactor](./2026-04-22-saas-02g-sms-per-tenant-provider.md) (Unifonic + Taqnyat adapters + `OrganizationSmsConfig` singleton) — required before Plan 04 | 🟢 WRITTEN | — | 02f | 2 days |
| 02h | [Strict mode + penetration tests](./2026-04-21-saas-02h-strict-mode-penetration.md) (flip `TENANT_ENFORCEMENT=strict`; adversarial cross-tenant suite) ⚠️ owner-gated (blast radius = payments outage; canary + per-module rollback) | 🟢 WRITTEN | — | 02g, 02g-sms | 2 days |
| 03 | [Verticals System](./2026-04-21-saas-03-verticals-system.md) (`Vertical`, `VerticalSeedDepartment`, `VerticalSeedServiceCategory`, `VerticalTerminologyOverride` + 11 seeds across 4 families + terminology packs + `useTerminology()` hook) | 🟡 EXEC | [#25](https://github.com/tariiq222/carekit/pull/25) | 02e | 2 weeks |
| 04 | [Billing & Subscriptions](./2026-04-21-saas-04-billing-subscriptions.md) (`Plan`, `Subscription` + platform Moyasar adapter + webhook + hybrid `PlanLimitsGuard`/`@TrackUsage` + metered overage + 2-day grace) ⚠️ owner-review gate Task 1 | 🟢 WRITTEN | — | 02e, 02g-sms | 2 weeks |
| 05a | [Shared UI Package Extraction](./2026-04-21-saas-05a-packages-ui-extraction.md) — extract 33 shadcn primitives into `packages/ui/`. Parallel-safe with 02f/02g. | 🟡 EXEC | [#20](https://github.com/tariiq222/carekit/pull/20) | 02a | 3 days |
| 05b | [Super-admin App](./2026-04-21-saas-05b-super-admin-app.md) (`apps/admin/` on `admin.carekit.app` + impersonation shadow-JWT + `$allTenants` CLS-gated escape hatch + suspend + metrics) ⚠️ Task 0 owner-review gate | 🟢 WRITTEN | — | 04, 05a | 2 weeks |
| 06 | [Dashboard Terminology + EN i18n](./2026-04-21-saas-06-dashboard-terminology-i18n.md) (full `t()`/`tp()` refactor + EN parity + RTL/LTR toggle + feature gating + tenant switcher + billing UI) | 🟢 WRITTEN | — | 03, 04, 05a | 3 weeks |
| 07 | [Marketing Site + Signup Wizard](./2026-04-21-saas-07-marketing-landing-signup.md) (`apps/landing/` on `carekit.app` + 8 vertical landings + 5-step signup + Moyasar checkout) ⚠️ JWT `organizationSlug` claim Task 0 owner-review | 🟢 WRITTEN | — | 03, 04, 05a, 02e | 3 weeks |
| 08 | [Website Multi-tenant + Vertical Themes](./2026-04-21-saas-08-website-multi-tenant-themes.md) (refactor `apps/website/themes/` → `visual/` × `vertical/` × 4 families, conditional routing, multi-tenant host middleware, bilingual SEO, embed widget) | 🟢 WRITTEN | — | 02g, 03, 06 | 4 weeks |
| 09 | [Custom Domain + Infra](./2026-04-21-saas-09-custom-domain-infra.md) (Caddy on-demand TLS, wildcard `*.carekit.app`, DNS verification worker, `/settings/domain` UI) ⚠️ owner-gated Nginx→Caddy cutover | 🟢 WRITTEN | — | 08 | 1.5 weeks |
| 10 | [Hardening & Launch](./2026-04-21-saas-10-hardening-launch.md) (isolation penetration extension, per-tenant rate limiting, Sentry tags + Prometheus labels, performance audit, load test 100 orgs × 10k bookings, data export per-org, runbook) | 🟢 WRITTEN | — | 01–09 | 3 weeks |

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
7. **Dropping a single-field `@unique` to replace with `@@unique([orgId, field])` breaks `findUnique` callsites** — when the uniqueness key changes, audit every `findUnique` that used the old constraint name and switch to `findFirst` with the composite where clause. Example from 02b: `employee.email @unique` → `@@unique([organizationId, email], name: "employee_org_email")` broke two callers.
8. **Prisma extension covers `where` (reads) not `data` (writes)** — the Proxy-based extension auto-injects `organizationId` into WHERE clauses for scoped models, but NOT into `data` objects. Every `create()` and any explicit `update()` that sets organizationId must specify it manually.
9. **`runAs` / CLS callbacks must be `async () => {}`** — sync callbacks returning a Promise lose AsyncLocalStorage context before the Prisma extension fires. Always use `async () => { ... }` not `() => somePromise`.
10. **Singleton conversion (upsert-on-read) pattern established in 02c** — for models that are one-per-org (BrandingConfig, OrganizationSettings): `id @default(uuid())` + `organizationId @unique`. Get handler uses `prisma.model.upsert({ where: { organizationId }, update: {}, create: { organizationId, ...defaults } })`. Update handler uses `prisma.model.update({ where: { organizationId }, data: { ...fields } })`.
11. **`$transaction` callback form bypasses the Proxy** — inside `this.prisma.$transaction(async (tx) => { ... })`, `tx` is a raw Prisma transaction client that does NOT go through the NestJS DI Proxy. Explicit `organizationId` is required in EVERY `tx.*.create()` AND `tx.*.findFirst()` / `tx.*.findUnique()` call within the callback. Array-form transactions `this.prisma.$transaction([op1, op2])` are fine because the operations are pre-built through the Proxy.

---

## Progress log

Chronological record of completed plans. Updated by the planner (me) after each merge.

| Date | Phase | PR | Notes |
|---|---|---|---|
| 2026-04-21 | 01 — Multi-tenancy Foundation | — | Organization + Membership + TenantContext + dormant scoping. 923/923 tests. Flag off → runtime unchanged. |
| 2026-04-21 | 02a — Identity cluster | [#15](https://github.com/tariiq222/carekit/pull/15) | 3 models scoped + Proxy-based Prisma 7 $extends confirmed working + 5 divergences resolved pre-commit + playbook authored in `docs/saas-tenancy.md`. 934/934 tests. |
| 2026-04-21 | 02b — People cluster | [#16](https://github.com/tariiq222/carekit/pull/16) | 7 models scoped (Client + ClientRefreshToken + Employee + 4 child tables). Client auth tenant-aware. 3 divergences: findUnique→findFirst on composite keys, extension covers where not data, CLS async callback requirement. 941/941 tests, 18/18 isolation e2e. |
| 2026-04-21 | 02c — Org-config + singletons | [#17](https://github.com/tariiq222/carekit/pull/17) | 14 models scoped (Branch, Dept, ServiceCategory, Service + 5 sub-models, BusinessHour, Holiday, IntakeForm/Field, Rating) + BrandingConfig + OrganizationSettings singleton conversion (upsert-on-read pattern). 953/953 tests, 14 isolation e2e. No divergences reported. |
| 2026-04-21 | 02d — Bookings cluster | [#18](https://github.com/tariiq222/carekit/pull/18) | 7 models scoped: Booking, BookingStatusLog, WaitlistEntry, GroupSession, GroupEnrollment, GroupSessionWaitlist, BookingSettings. 2 amendments: group-session-min-reached creates BookingStatusLog (plan missed); 5 callback-form $transaction handlers found (plan predicted 2). BookingSettings hierarchical singleton via findFirst. 953/953 unit + 6 new + 32 prior isolation e2e. Typecheck clean. |

---

## PM operating rules (how I track this project)

These apply whenever the user invokes the planner (me) for SaaS work.

1. **After every executor-reported completion:** update the Status column in the phase map, append a Progress log entry, check whether any lesson should land in the "Lessons carried forward" section, and update the "Next action" in the dashboard.
2. **Before writing a plan:** read the `saas0<N>_status.md` memory of the previous plan to pull lessons forward. Include a "Lessons carried forward from prior plans" block if any apply.
3. **Divergence handling:** when the executor reports a divergence, update the plan's own file with an `## Amendments applied during execution` section AND propagate the root cause as a generalized lesson into this index's "Lessons carried forward".
4. **Plan authorship cadence:** keep ≥1 plan ahead of execution at all times. If user merges a phase and no next plan exists, my immediate priority is writing it before anything else.
5. **Risk updates:** when a plan surfaces a new risk (failed assumption, owner-review gate, external dependency), add it to the "Active risks" list in the status dashboard. Clear risks the moment they're resolved.
6. **Parallelism:** actively identify parallel-safe plans (like 05a) so the executor can load-balance.
7. **Scope lock integrity:** if any plan discovers a reason to break a scope-lock item (e.g., "we actually do need a second DB"), STOP and flag it to the user — do not silently widen scope.

---

## Critical files that every plan must update

- `apps/backend/CLAUDE.md` — currently says "no tenantId". Plan 02 rewrites the relevant sections.
- `CLAUDE.md` (root) — update "Single-organization mode" note when SaaS ships; add `apps/admin/` + `apps/landing/` + `packages/ui/` to the Structure tree after Plans 05b / 07 land.
- `apps/dashboard/CLAUDE.md` — add terminology usage rules in Plan 06.
- `apps/admin/CLAUDE.md` — NEW, authored in Plan 05b. Documents super-admin conventions (no tenant context; always `isSuperAdmin=true`; audit-log every destructive action).
- `packages/ui/CLAUDE.md` — NEW, authored in Plan 05a. Documents what belongs in shared UI vs app-specific components.
