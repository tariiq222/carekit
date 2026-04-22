# CareKit SaaS Transformation — Plan Index

> **Meta-plan.** This document lists every phase of the SaaS transformation. Each phase is a separate plan file with its own task list. Execute in order — each plan depends on the ones before it.

**Goal:** Transform CareKit from a single-organization deployment into a bilingual (AR/EN), multi-vertical, multi-tenant SaaS platform with custom domains and a premium-tier website add-on.

**Strategy:** Strangler pattern. Add new primitives beside existing code. Migrate cluster-by-cluster. Keep the system deployable at every checkpoint.

**Estimated total:** 8.5–10.5 months for 2–3 engineers; 13–15 months solo.

---

## 📊 Current Status — updated 2026-04-22

**Progress:** 11 / 20 phases merged (55%) · 3 phases in-flight (PRs open) · 6 plans written awaiting execution.

```
Phase 01      ✅ MERGED     Multi-tenancy Foundation
Phase 02a     ✅ MERGED     Identity cluster (PR #15)
Phase 02b     ✅ MERGED     People cluster (PR #16)
Phase 02c     ✅ MERGED     Org-config + singletons (PR #17)
Phase 02d     ✅ MERGED     Bookings cluster (PR #18)
Phase 02e     ✅ MERGED     Finance cluster (PR #21) — 7 models + ZatcaConfig + Moyasar tenant resolution
Phase 02f     ✅ MERGED     Comms cluster (PR #24) — 8 models + ChatbotConfig singleton
Phase 02g     ✅ MERGED     AI/media/ops/platform (PR #27+#28) — 9 models + SiteSetting + pgvector
Phase 02g-sms ✅ MERGED     Per-tenant SMS (PR #29) — Unifonic/Taqnyat + AES-GCM + DLR webhook
Phase 02h     🟡 PR OPEN   Strict mode + penetration (PR #35 — owner-review pending) — TENANT_ENFORCEMENT=strict + 4 security e2e suites
Phase 03      ✅ MERGED     Verticals System (PR #25) — 11 seeds × 4 families + terminology
Phase 04      🟡 PR OPEN   Billing & Subscriptions (PR #30 DRAFT) — Tasks 2-6 done (35%); Tasks 7-15 pending
Phase 05a     ✅ MERGED     packages/ui extraction (PR #20) — 33 shadcn primitives
Phase 05b     🟢 WRITTEN    Super-admin app (1510 lines) — impersonation owner-review gate
Phase 06      🟡 PR OPEN   Dashboard terminology + EN i18n (PR #31 DRAFT) — tenant switcher + parity script done (~15%)
Phase 06a     🟢 WRITTEN    Dashboard literal refactor (new plan 2026-04-22) — parallel-safe with 06
Phase 07      🟢 WRITTEN    Marketing site + signup (940 lines) — JWT + Moyasar touches
Phase 08      🟢 WRITTEN    Website multi-tenant + themes (881 lines)
Phase 09      🟢 WRITTEN    Custom domain + infra (785 lines) — Nginx→Caddy migration
Phase 10      🟢 WRITTEN    Hardening + launch (760 lines)
```

**🎯 Next actions (executor):**
1. `/approve saas-02h` on PR #35 → merge (owner-gated; prerequisite for Plan 10 canary)
2. `/approve saas-04` on PR #30 → complete Tasks 7-15 (handlers + crons + webhook + e2e)
3. Merge PR #34 (data-integrity fixes — no owner gate needed)

**🔭 Next action (planner):** 20 plans written. No new authorship needed until 05b/07 pre-execution review.

**🚧 Active risks:**
- **04 (Billing) Tasks 7-15 pending** — handlers, 4 BullMQ crons, Moyasar subscription webhook, dashboard skeleton, 4 e2e suites. Estimated ~10 more days.
- **04 owner-gate still open** — Task 1 `/approve saas-04` not yet posted. No finance/Moyasar code may merge without @tariq approval.
- **06 incomplete** — PR #31 has tenant switcher + parity script only; full t()/tp() refactor + EN parity + billing UI remain.
- **05b** introduces `$allTenants` CLS-gated escape hatch + impersonation shadow-JWT — owner-review gate at Task 0.
- 07 (Marketing + signup) — `organizationSlug` JWT claim needs sub-spec before executing Task 0.
- 09 (Custom domain) requires Nginx→Caddy swap — owner-approval gate before cutover.
- ~~Prisma 7 `$extends` via Proxy~~ — confirmed working 02a–02g, no further risk.
- ~~`$transaction` callback bypasses Proxy~~ — Lesson 11 documented; all handlers corrected.
- ~~02h strict mode blast radius~~ — resolved: dev-stage flip only; canary deferred to Plan 10.
- ~~02g-sms~~ — DONE (PR #29 merged).

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

Status legend: ✅ merged · 🟡 PR open / in-flight · 🟢 plan ready, not started · ⚪ pending

| # | Plan | Status | PR | Dependencies | Duration |
|---|---|---|---|---|---|
| 01 | [Multi-tenancy Foundation](./2026-04-21-saas-01-multi-tenancy-foundation.md) | ✅ DONE (2026-04-21) | — | — | 2 weeks |
| 02a | [Identity cluster rollout](./2026-04-21-saas-02a-identity-cluster.md) | ✅ DONE (2026-04-21) | [#15](https://github.com/tariiq222/carekit/pull/15) | 01 | 2–3 days |
| 02b | [People cluster rollout](./2026-04-21-saas-02b-people-cluster.md) | ✅ DONE (2026-04-21) | [#16](https://github.com/tariiq222/carekit/pull/16) | 02a | 3 days |
| 02c | [Org-config + singletons rollout](./2026-04-21-saas-02c-org-config-singletons.md) | ✅ DONE (2026-04-21) | [#17](https://github.com/tariiq222/carekit/pull/17) | 02b | 4 days |
| 02d | [Bookings cluster rollout](./2026-04-21-saas-02d-bookings-cluster.md) | ✅ DONE (2026-04-21) | [#18](https://github.com/tariiq222/carekit/pull/18) | 02c | 3 days |
| 02e | [Finance cluster rollout](./2026-04-21-saas-02e-finance-cluster.md) | ✅ DONE (2026-04-21) | [#21](https://github.com/tariiq222/carekit/pull/21) | 02d | 3 days |
| 02f | [Comms cluster rollout](./2026-04-21-saas-02f-comms-cluster.md) | ✅ DONE (2026-04-22) | [#24](https://github.com/tariiq222/carekit/pull/24) | 02e | 2 days |
| 02g | [AI + media + ops + platform rollout](./2026-04-21-saas-02g-ai-media-ops-platform.md) | ✅ DONE (2026-04-22) | [#27](https://github.com/tariiq222/carekit/pull/27) [#28](https://github.com/tariiq222/carekit/pull/28) | 02f | 2 days |
| 02g-sms | [Per-tenant SMS provider refactor](./2026-04-22-saas-02g-sms-per-tenant-provider.md) | ✅ DONE (2026-04-22) | [#29](https://github.com/tariiq222/carekit/pull/29) | 02f | 2 days |
| 02h | [Strict mode + penetration tests](./2026-04-22-saas-02h-strict-mode-penetration.md) ⚠️ owner-review `/approve saas-02h` | 🟡 PR #35 | [#35](https://github.com/tariiq222/carekit/pull/35) | 02g, 02g-sms | 2 days |
| 03 | [Verticals System](./2026-04-21-saas-03-verticals-system.md) | ✅ DONE (2026-04-22) | [#25](https://github.com/tariiq222/carekit/pull/25) | 02e | 2 weeks |
| 04 | [Billing & Subscriptions](./2026-04-21-saas-04-billing-subscriptions.md) ⚠️ owner-review `/approve saas-04` — Tasks 2-6 done; Tasks 7-15 pending | 🟡 PR #30 | [#30](https://github.com/tariiq222/carekit/pull/30) | 02e, 02g-sms | 2 weeks |
| 05a | [Shared UI Package Extraction](./2026-04-21-saas-05a-packages-ui-extraction.md) | ✅ DONE (2026-04-22) | [#20](https://github.com/tariiq222/carekit/pull/20) | 02a | 3 days |
| 05b | [Super-admin App](./2026-04-21-saas-05b-super-admin-app.md) ⚠️ owner-review gate Task 0 | 🟢 WRITTEN | — | 04, 05a | 2 weeks |
| 06 | [Dashboard Terminology + EN i18n](./2026-04-21-saas-06-dashboard-terminology-i18n.md) — tenant switcher done (~15%); full refactor pending | 🟡 PR #31 | [#31](https://github.com/tariiq222/carekit/pull/31) | 03, 04, 05a | 3 weeks |
| 06a | [Dashboard Literal Refactor](./2026-04-22-saas-06a-dashboard-literal-refactor.md) — parallel-safe with 06 | 🟢 WRITTEN | — | 05a | 1 week |
| 07 | [Marketing Site + Signup Wizard](./2026-04-21-saas-07-marketing-landing-signup.md) ⚠️ JWT `organizationSlug` owner-review Task 0 | 🟢 WRITTEN | — | 03, 04, 05a, 02e | 3 weeks |
| 08 | [Website Multi-tenant + Vertical Themes](./2026-04-21-saas-08-website-multi-tenant-themes.md) | 🟢 WRITTEN | — | 02g, 03, 06 | 4 weeks |
| 09 | [Custom Domain + Infra](./2026-04-21-saas-09-custom-domain-infra.md) ⚠️ owner-gated Nginx→Caddy cutover | 🟢 WRITTEN | — | 08 | 1.5 weeks |
| 10 | [Hardening & Launch](./2026-04-21-saas-10-hardening-launch.md) | 🟢 WRITTEN | — | 01–09 | 3 weeks |

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
| 2026-04-21 | 02e — Finance cluster | [#21](https://github.com/tariiq222/carekit/pull/21) | 7 models scoped (Invoice, Payment, Coupon, CouponRedemption, RefundRequest, ZatcaSubmission + ZatcaConfig singleton). Moyasar 3-stage tenant resolution. 964 unit tests. |
| 2026-04-21 | 05a — packages/ui extraction | [#20](https://github.com/tariiq222/carekit/pull/20) | 33 shadcn primitives + 2 hooks moved to `packages/ui`. Manual QA 9/9 PASS. |
| 2026-04-22 | 02f — Comms cluster | [#24](https://github.com/tariiq222/carekit/pull/24) | 8 models scoped + ChatbotConfig singleton + EmailTemplate composite slug unique. 964 unit + 5 new isolation e2e. |
| 2026-04-22 | 03 — Verticals System | [#25](https://github.com/tariiq222/carekit/pull/25) | Vertical primitive + 11 seeds × 4 families + terminology packs + useTerminology() hook. 60 unit + 22 e2e + 5 dashboard tests. |
| 2026-04-22 | 02g — AI/media/ops/platform | [#27](https://github.com/tariiq222/carekit/pull/27) [#28](https://github.com/tariiq222/carekit/pull/28) | 9 models scoped + SiteSetting composite PK + pgvector org predicate. 1025/1025 unit. 6 isolation e2e suites. |
| 2026-04-22 | 02g-sms — Per-tenant SMS | [#29](https://github.com/tariiq222/carekit/pull/29) | OrganizationSmsConfig singleton + SmsDelivery audit + Unifonic/Taqnyat adapters + AES-GCM creds + DLR webhook. 1060 unit + 6 isolation e2e. |

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
