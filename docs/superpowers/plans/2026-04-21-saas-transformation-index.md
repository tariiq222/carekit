# CareKit SaaS Transformation — Plan Index

> **Meta-plan.** This document lists every phase of the SaaS transformation. Each phase is a separate plan file with its own task list. Execute in order — each plan depends on the ones before it.

**Goal:** Transform CareKit from a single-organization deployment into a bilingual (AR/EN), multi-vertical, multi-tenant SaaS platform with custom domains and a premium-tier website add-on.

**Strategy:** Strangler pattern. Add new primitives beside existing code. Migrate cluster-by-cluster. Keep the system deployable at every checkpoint.

**Estimated total:** 8–10 months for 2–3 engineers; 12–15 months solo.

---

## Phase map

| # | Plan | Scope | Dependencies | Target duration |
|---|---|---|---|---|
| 01 | [Multi-tenancy Foundation](./2026-04-21-saas-01-multi-tenancy-foundation.md) | Organization + Membership models, TenantContext service, resolver middleware (dormant), Prisma scoping extension (dormant), RLS scaffolding, isolation test harness | — | 2 weeks |
| 02 | SaaS-02 Tenant Enforcement Rollout | Add `organizationId` column to every tenant-scoped table. Backfill with default org. Activate middleware + Prisma scoping cluster-by-cluster (identity → people → org-config → org-experience → bookings → finance → comms → ops → ai → media → platform). Convert singletons (BrandingConfig / OrganizationSettings / SiteSetting) to per-org. | 01 | 3 weeks |
| 03 | SaaS-03 Verticals System | `Vertical`, `VerticalSeedService`, `VerticalSeedDepartment` models. Seed 8 vertical templates. Terminology packs infrastructure (`terminology/<pack>.ar.json`, `.en.json`). `useTerminology()` hook. | 02 | 2 weeks |
| 04 | SaaS-04 Billing & Subscriptions | `Plan`, `Subscription` models. Moyasar subscription adapter. Webhook handler. `PlanLimitsGuard`. Usage metering BullMQ job. Trial + grace-period state machine. | 02 | 2 weeks |
| 05 | SaaS-05 Super-admin API & Dashboard | `src/api/platform/*` endpoints. `/admin/*` routes in dashboard. Impersonation tokens. Org suspend/resume. Platform metrics (MRR, churn, DAU). | 04 | 1.5 weeks |
| 06 | SaaS-06 Dashboard Terminology + EN i18n | Full `t()`/`tp()` refactor of dashboard strings. Complete English translation of every user-facing string. RTL/LTR toggle. Feature-gating UI components. Tenant switcher. Billing UI. | 03, 04 | 3 weeks |
| 07 | SaaS-07 Marketing Site + Signup Wizard | New `apps/landing/` Next.js app. `carekit.app` domain. Bilingual landing pages. `/for/<vertical>` pages × 8. Pricing page. 5-step signup wizard with vertical picker, slug availability check, Moyasar payment capture. | 03, 04 | 3 weeks |
| 08 | SaaS-08 Website Multi-tenant + Vertical Themes | `apps/website/themes/` refactor into `visual/` + `vertical/`. 4 vertical templates (medical / consulting / salon / fitness). Conditional routing based on vertical. Multi-tenant host middleware. Bilingual SEO with hreflang. Embed widget for Starter tier. | 06 | 4 weeks |
| 09 | SaaS-09 Custom Domain + Infra | Caddy with on-demand TLS. Wildcard cert `*.carekit.app`. DNS verification BullMQ worker. Domain status state machine. `/settings/domain` UI. Rollout to staging, then prod. | 08 | 1.5 weeks |
| 10 | SaaS-10 Hardening & Launch | Isolation penetration test suite. Per-tenant rate limiting. Per-tenant Sentry tags + Prometheus labels. Performance audit (EXPLAIN on hot queries). Load test at 100 orgs × 10k bookings. Data export per-org. Runbook + oncall docs. | 01–09 | 3 weeks |

---

## Scope Lock (agreed 2026-04-21)

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

## Critical files that every plan must update

- `apps/backend/CLAUDE.md` — currently says "no tenantId". Plan 02 rewrites the relevant sections.
- `CLAUDE.md` (root) — update "Single-organization mode" note when SaaS ships.
- `apps/dashboard/CLAUDE.md` — add terminology usage rules in Plan 06.
