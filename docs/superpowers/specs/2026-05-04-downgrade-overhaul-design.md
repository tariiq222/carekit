# Downgrade Overhaul — Design Spec

**Date:** 2026-05-04
**Branch:** `feat/downgrade-overhaul` → `main`
**Status:** Design — pending user approval before plan
**Owner:** Tariq

---

## 1. Problem

Tenant-initiated plan downgrade is broken across multiple layers:

1. **Counter integrity bug** — `UsageCounter` rows are incremented on entity create, but never decremented on deactivate or delete. After a tenant deactivates 7 employees, the counter still reports 12. Downgrade pre-checks read this stale value and reject the operation.
2. **Recompute fallback bug** — `DowngradeSafetyService.recomputeFromSource` and `FeatureGuard.recomputeFromSource` count Employees without filtering `isActive: true`, so even the self-heal path returns the wrong number.
3. **Boolean features have no downgrade safety** — a tenant on a plan with `zatca: true` who created ZATCA-submitted invoices can downgrade to a plan with `zatca: false` and the system will silently accept it. There is no concept of "data retention policy" when a feature is turned off.
4. **No grace periods** — features that affect external integrations (CUSTOM_DOMAIN, API_ACCESS, WEBHOOKS) terminate instantly on downgrade, which would break tenant production traffic without warning.
5. **Background effects bypass FeatureGuard** — recurring-booking cron, coupon application during booking, webhook dispatcher, etc. do not pass through HTTP controllers, so they keep emitting effects from features the tenant no longer pays for.
6. **UI says "you can't downgrade" with no actionable next step** — the dashboard surfaces the raw 422 error message and offers no path forward.

The fix must work end-to-end: counter integrity → safety pre-check → retention policy enforcement → actionable UI. Anything less leaves a hole.

## 2. Goals & Non-Goals

### Goals

- Counters reflect the actual count of *active* (or non-deleted) entities at all times.
- Downgrade safety pre-check covers both quantitative caps (BRANCHES, EMPLOYEES, MONTHLY_BOOKINGS) and boolean features that have associated tenant data.
- A single, consistent **Hybrid Freeze** retention policy governs every boolean feature with three explicit exceptions for legal / DNS / mobile-build reasons.
- Background effects (cron, listeners, dispatchers) honor feature gates the same way controllers do.
- The dashboard `/subscription/plans` page presents a clear, actionable Dialog when downgrade is blocked, listing each violation and linking to the page where the tenant can resolve it.
- Quantitative violations are resolved **manually only** — neither the tenant nor super-admin can force a downgrade past the cap; entities must be deactivated through the existing per-page UI before the system accepts the downgrade.

### Non-Goals

- No auto-deactivation logic of any kind. The system does not pick which employees / branches to deactivate.
- No `?force=true` super-admin escape hatch. Same rules apply to everyone, no exceptions.
- No new dedicated `/settings/storage` page — STORAGE caps are removed from the system entirely (see §4.4).
- No retroactive deletion of historical data when a feature is turned off. Freeze is read-only retention, not data destruction.
- No change to the proration / billing-cycle accounting around downgrade — that surface stays as-is.

## 3. Decisions Captured From Brainstorm

| # | Topic | Decision |
|---|---|---|
| Q1 | Default policy for boolean features at downgrade | **Hybrid** — Freeze by default, with three named exceptions |
| Q2 | What "Freeze" means technically | Block all writes via API + suppress background effects (cron / listeners / workers / dispatchers) |
| Q3a | ZATCA | **Always-on** for every plan — removed from the toggleable feature registry entirely |
| Q3b | CUSTOM_DOMAIN | 30-day grace period after downgrade, with daily warning emails in the last 7 days, then DNS revert |
| Q3c | API_ACCESS / WEBHOOKS | 7-day grace period with an immediate warning email, then 402 Payment Required on every API call / dispatcher skip |
| Q3d | WHITE_LABEL_MOBILE | Continue indefinitely (the published mobile build cannot be unpublished); freeze the ability to publish updates / re-brand |
| Q4 | STORAGE caps | **Removed** — storage is unlimited on every plan |
| Q5 | Quantitative cap violations | Manual only. The tenant deactivates entities through the existing per-page UI before the system accepts the downgrade. |
| Q6 | Super-admin override | None. Super-admin follows the exact same flow via impersonation if needed. |

## 4. Architecture

### 4.1 Counter integrity — the foundation

Every quantitative counter must monotonically reflect the actual active entity count. Today, the counter only goes up.

**Fix:**

- Add a new listener `decrement-on-lifecycle.listener.ts` (sibling of `increment-usage.listener.ts`) that subscribes to:
  - `org-config.branch.deactivated`
  - `people.employee.deactivated`
  - `org-experience.service.deactivated`
- Each handler decrements the corresponding `UsageCounter` for the EPOCH period by 1.
- Re-activation events (e.g. `branch.reactivated`) **also** publish, and the listener increments back. This must be symmetric.
- All five domain handlers that mutate `isActive` (`update-branch`, `update-employee`, `update-service`, plus any direct `deactivate-*` slice if it exists) emit the lifecycle event in the same transaction as the DB update. The pattern matches existing `org-config.branch.created` etc.

**Storage decrement** is N/A — storage is removed entirely (see §4.4).

**Booking cancel** already has `decrement-on-refund.listener.ts`. Verify it covers the BookingStatus → CANCELLED transition (not just refunds), and extend if it doesn't.

**Recompute fallback fix:**

Patch both `feature.guard.ts:206` and `downgrade-safety.service.ts:122-125` to add `where: { organizationId, isActive: true }` for Employee. This ensures the self-heal recompute returns the correct number when the cached counter is missing or stale.

**Backfill migration:**

A one-shot script `scripts/billing/recompute-all-counters.ts` that:
- Iterates every organization
- Recomputes BRANCHES / EMPLOYEES / SERVICES / MONTHLY_BOOKINGS from source tables
- Upserts the correct value into `UsageCounter`
- Logs before/after diff per org

Run this once after Phase 1 deploys to correct any drift accumulated since launch.

### 4.2 Boolean downgrade safety

`DowngradeSafetyService` currently inspects 4 quantitative dimensions. Extend it to also check booleans:

For each `FeatureKey` with `kind: "boolean"` in `FEATURE_CATALOG` that is **enabled** in the current plan and **disabled** in the target plan, check whether the org has *active in-flight data* for that feature. If yes, that's a violation.

| Feature | "Active in-flight data" check |
|---|---|
| `RECURRING_BOOKINGS` | `RecurringBookingTemplate.count({ organizationId, isActive: true })` > 0 |
| `WAITLIST` | `WaitlistEntry.count({ organizationId, status: 'WAITING' })` > 0 |
| `GROUP_SESSIONS` | future bookings with `groupSessionId IS NOT NULL` > 0 |
| `AI_CHATBOT` | `KnowledgeBaseArticle.count({ organizationId })` > 0 OR active chatbot conversations |
| `EMAIL_TEMPLATES` | `EmailTemplate.count({ organizationId, isActive: true })` > 0 |
| `COUPONS` | `Coupon.count({ organizationId, isActive: true, validUntil: { gte: now } })` > 0 |
| `INTAKE_FORMS` | `IntakeForm.count({ organizationId, isActive: true })` > 0 |
| `CUSTOM_ROLES` | `CustomRole.count({ organizationId })` > 0 |
| `ACTIVITY_LOG` | always allow (read-only by design, no in-flight state) |
| `ZOOM_INTEGRATION` | `ZoomCredential.findFirst({ organizationId })` is non-null OR future bookings with zoom meetings > 0 |
| `WALK_IN_BOOKINGS` | always allow (the data point is per-booking; deactivating just stops new ones) |
| `BANK_TRANSFER_PAYMENTS` | pending bank transfer uploads > 0 |
| `MULTI_BRANCH` | this is implicit — a tenant with > 1 active branch already trips the BRANCHES cap |
| `DEPARTMENTS` | `Department.count({ organizationId })` > 0 |
| `CLIENT_RATINGS` | always allow (historical ratings are kept under data retention) |
| `DATA_EXPORT` | always allow |
| `ADVANCED_REPORTS` | always allow |
| `SMS_PROVIDER_PER_TENANT` | `OrganizationSmsConfig.findFirst({ organizationId })` is non-null |
| `WHITE_LABEL_MOBILE` | exception — see §4.3.4 |
| `CUSTOM_DOMAIN` | exception — see §4.3.2 |
| `API_ACCESS` | exception — see §4.3.3 |
| `WEBHOOKS` | exception — see §4.3.3 |
| `PRIORITY_SUPPORT` | always allow (operational, no data) |
| `AUDIT_EXPORT` | always allow |
| `MULTI_CURRENCY` | open invoices in non-default currency > 0 |
| `EMAIL_FALLBACK_MONTHLY` / `SMS_FALLBACK_MONTHLY` | quantitative monthly quotas — covered by the counter logic, not a boolean check |

When a violation exists, the response body extends the existing `DowngradePrecheckExceptionBody`:

```ts
interface DowngradeViolation {
  kind: 'QUANTITATIVE' | 'BOOLEAN';
  featureKey: FeatureKey;
  current?: number;        // QUANTITATIVE only
  targetMax?: number;      // QUANTITATIVE only
  blockingResources?: {    // BOOLEAN only
    count: number;
    sampleIds?: string[];  // up to 3, for "you have e.g. 12 active coupons"
    deepLink: string;      // dashboard URL where the tenant resolves it
  };
}
```

### 4.3 Data retention policy enforcement

The Hybrid policy means: when a downgrade lands, the system must enforce the new feature set everywhere — not just at the controllers.

#### 4.3.1 Default Freeze (applies to all booleans except the four named exceptions)

Two layers of enforcement:

**Layer A — API:** The existing `FeatureGuard` already rejects writes on feature-gated endpoints. Audit and ensure every write endpoint for these features carries `@RequireFeature`. Reads stay open (the tenant should still be able to view their frozen data).

**Layer B — Background:** Each cron / listener / dispatcher that emits domain effects from a feature must check the feature gate before acting. New helper:

```ts
@Injectable()
class FeatureCheckService {
  isEnabled(organizationId: string, key: FeatureKey): Promise<boolean>
}
```

This wraps `SubscriptionCacheService.get(orgId)` → `limits[FEATURE_KEY_MAP[key]]`. Cached the same way `FeatureGuard` caches.

Sites that must adopt it:

| Site | Feature | Action when disabled |
|---|---|---|
| `RecurringBookingCron` | `RECURRING_BOOKINGS` | Skip generating the next occurrence; log `feature_disabled_skip` |
| `apply-coupon` slice (called from `create-booking`) | `COUPONS` | Reject coupon application; the booking proceeds without discount |
| `WebhookDispatcher` | `WEBHOOKS` | Skip dispatch for that org (after grace period — see §4.3.3) |
| `SendEmailHandler` (custom template path) | `EMAIL_TEMPLATES` | Fall back to default platform template |
| `IntakeFormSubmissionHandler` | `INTAKE_FORMS` | Reject submission; booking proceeds without intake |
| `WaitlistAutoPromoteCron` | `WAITLIST` | Skip auto-promotion |
| `ZoomMeetingCreatedListener` | `ZOOM_INTEGRATION` | Skip Zoom call creation; booking saved without meeting link |
| `BankTransferUploadHandler` | `BANK_TRANSFER_PAYMENTS` | Reject upload at API |
| `RatingRequestCron` | `CLIENT_RATINGS` | Skip sending rating request |
| `AdvancedReportGenerator` | `ADVANCED_REPORTS` | Endpoint already rejected by `FeatureGuard` — verify no scheduled report cron exists |

Each site gets a unit test that verifies the skip-when-disabled behavior.

#### 4.3.2 Exception 1 — CUSTOM_DOMAIN (30-day grace)

When a downgrade lands and the new plan disables `custom_domain`:

1. Set `OrganizationSettings.customDomainGraceUntil = now + 30 days` (new column).
2. Domain continues to resolve to the dashboard until that date.
3. New cron `CustomDomainGraceWatcherCron` runs daily:
   - 7 days before expiry → daily warning email to owner ("Your custom domain {domain} will be removed in N days")
   - At expiry → revert DNS, clear `OrganizationSettings.customDomain`, send final email
4. If the tenant re-upgrades during the grace, the column clears and the watcher exits.

#### 4.3.3 Exception 2 — API_ACCESS / WEBHOOKS (7-day grace)

When a downgrade lands and the new plan disables `api_access` and/or `webhooks`:

1. Set `Subscription.apiAccessGraceUntil = now + 7 days` and/or `Subscription.webhooksGraceUntil = now + 7 days` (two new columns).
2. Immediate email to owner: "Your API integrations will stop working in 7 days. Affected: {list}".
3. The existing `ApiKeyGuard` / `WebhookDispatcher` checks the grace column:
   - Within grace: continue working.
   - After grace: API returns `402 Payment Required` with body `{ code: 'FEATURE_UNAVAILABLE', feature: 'api_access', upgradeUrl: ... }`. Webhook dispatcher skips with structured log.
4. Re-upgrade clears the grace columns.

#### 4.3.4 Exception 3 — WHITE_LABEL_MOBILE (continue + freeze updates)

When a downgrade lands and the new plan disables `white_label_mobile`:

1. The published mobile build keeps working — the platform takes no action against it.
2. The dashboard endpoints that *modify* white-label config (`PATCH /branding/mobile-app-config`, `POST /branding/mobile-icon`) become rejected by `FeatureGuard`.
3. The tenant cannot publish a new build under their own bundle ID. (This is enforced at the build pipeline level, which is outside this spec — for now a documentation note suffices.)

#### 4.3.5 Exception 4 (already-decided) — ZATCA

ZATCA is **removed from the toggleable feature registry**. Concretely:

1. Remove `ZATCA` from `FeatureKey` const in `packages/shared/constants/feature-keys.ts`.
2. Remove `zatca: z.boolean()` from `planLimitsSchema` (`apps/backend/src/modules/platform/billing/plan-limits.zod.ts` + admin mirror).
3. Remove `zatca: false` from `DEFAULT_PLAN_LIMITS`.
4. Remove `@RequireFeature(FeatureKey.ZATCA)` from every endpoint in `apps/backend/src/api/dashboard/zatca.controller.ts` (and any other controller).
5. Remove the ZATCA toggle from the admin plan editor UI.
6. Remove the ZATCA row from `FEATURE_CATALOG` in `packages/shared/constants/feature-catalog.ts`.
7. Migration: `UPDATE Plan SET limits = jsonb_set(limits, '{zatca}', 'true')` for safety, then a follow-up migration drops the key from `limits` JSON (deferred — leaving the key as `true` in JSON is harmless).

ZATCA endpoints stay protected by tenant + permission guards as today; they just don't gate on a feature flag anymore.

### 4.4 STORAGE removal

Same pattern as ZATCA. Concretely:

1. Remove `STORAGE` from `FeatureKey`.
2. Remove `maxStorageMB` and `overageRateStorageGB` from `planLimitsSchema` + `DEFAULT_PLAN_LIMITS`.
3. Remove `STORAGE` from `HARD_CAP_DIMENSIONS` in `downgrade-safety.service.ts`.
4. Remove the STORAGE branch from `FeatureGuard.recomputeFromSource`.
5. Remove the `media.file.uploaded` listener branch in `increment-usage.listener.ts` (counter no longer needed).
6. Remove the STORAGE row from `FEATURE_CATALOG`.
7. Remove the STORAGE row from the admin plan editor + comparison matrix UIs.
8. Existing `UsageCounter` rows for STORAGE can stay in DB (harmless) or be cleaned by a one-shot delete (preferred — cleaner).
9. The dashboard `/settings/billing` usage widget drops the storage row.

### 4.5 Manual-only quantitative resolution

The Dialog UI is the contract:

```
┌─ Cannot downgrade to {targetPlan.nameAr} ───────┐
│                                                  │
│ Your current usage exceeds the target plan      │
│ limits. Resolve each item below before retrying:│
│                                                  │
│ ▸ Employees: 12 / 5 allowed                     │
│   Deactivate 7 employees. Their historical      │
│   records (bookings, invoices, ratings) are     │
│   preserved.                                     │
│   [Manage employees →]                          │
│                                                  │
│ ▸ Branches: 2 / 1 allowed                       │
│   Deactivate 1 branch. Branch history is kept.  │
│   [Manage branches →]                           │
│                                                  │
│ ▸ This month's bookings: 450 / 200 allowed      │
│   Cannot reduce — historical. Resets on June 1  │
│   (12 days). Try downgrading then.              │
│                                                  │
│ ▸ Active recurring booking templates: 4         │
│   Deactivate them on the bookings page.         │
│   [Manage recurring →]                          │
│                                                  │
│ ▸ Active coupons: 8                             │
│   Deactivate or let them expire.                │
│   [Manage coupons →]                            │
│                                                  │
│ [Close]   [Choose a higher plan]                │
└──────────────────────────────────────────────────┘
```

Behaviors:

- Each row shows the violation with bilingual text (AR primary in dashboard).
- "Manage" buttons open the corresponding `/employees?status=active`, `/branches?status=active`, `/bookings/recurring`, `/coupons` page in the same tab. The user navigates back via the breadcrumb / back button.
- The Dialog re-fetches the violations when reopened — so after the tenant deactivates 7 employees and re-clicks Downgrade, they see the updated list.
- The "Choose a higher plan" button scrolls to the plan grid above (the Dialog stays mounted on the plans page).
- For MONTHLY_BOOKINGS-only violations, no link is offered — only the reset date.

The deactivate buttons live on the per-feature pages, not in the Dialog itself. **The Dialog never modifies data.** This guarantees the principle that every deactivation is an explicit, reviewed user action on the page that owns that entity.

#### 4.5.1 Verification: do all the "Manage X" pages have a deactivate button?

| Page | Required action button | Exists today? |
|---|---|---|
| `/employees` | Per-row "Deactivate" → `PATCH /employees/:id { isActive: false }` | **Verify in Phase 4** — `isActive` field exists on the model and form, but a per-row deactivate button in the list table needs confirmation. Add if missing. |
| `/branches` | Per-row "Deactivate" toggle | **Likely exists** — `branch-columns.tsx:137` references a Cancel icon. Verify in Phase 4. |
| `/bookings/recurring` | Per-row "Deactivate template" | **Verify in Phase 4.** Add if missing. |
| `/coupons` | Per-row "Deactivate" or "End now" | **Verify in Phase 4.** Add if missing. |
| `/intake-forms`, `/email-templates`, etc. | Per-row deactivate | Verify per page in Phase 4. |

Each missing button is a small fix scoped under Phase 4.

## 5. Migrations

| # | Migration | Purpose |
|---|---|---|
| M1 | `add_grace_columns` | `Subscription.apiAccessGraceUntil`, `Subscription.webhooksGraceUntil`, `OrganizationSettings.customDomainGraceUntil` |
| M2 | `seed_zatca_true_in_existing_plans` | `UPDATE Plan SET limits = jsonb_set(limits, '{zatca}', 'true', true)` |
| M3 | `remove_storage_counters` | `DELETE FROM UsageCounter WHERE feature_key = 'storage'` |

All migrations follow the immutable-migration rule (CLAUDE.md). No edits to existing migrations.

## 6. Testing strategy

Per user instruction: **all suites — unit + e2e + Kiwi**.

### 6.1 Unit (Jest, colocated `*.spec.ts`)

- Counter listeners: increment on create, decrement on deactivate, increment back on reactivate, decrement on delete (where applicable). For each of: branches, employees, services, bookings.
- `DowngradeSafetyService` boolean checks: one spec per boolean feature × (data present → violation) × (data absent → ok).
- Recompute fallback: returns count of `isActive: true` only.
- Each background-effect site: unit-tests the `FeatureCheckService` skip path.
- Grace-period crons: dry-run tests for day-N warning + final-day revert.
- Schedule-downgrade & immediate-downgrade handlers: full violation-set assertion.
- ZATCA endpoints: confirm they no longer throw `FeatureNotEnabledException` regardless of plan.

### 6.2 E2E (NestJS test/jest-e2e.json)

- Full downgrade flow: create org with overflowing usage → POST schedule-downgrade → expect 422 with violations array → deactivate via real endpoints → retry → expect 200.
- Boolean downgrade flow: same shape, with active recurring templates / coupons / etc.
- Grace-period flows: trigger downgrade with API_ACCESS+WEBHOOKS → API key works on day 6, returns 402 on day 8.
- CUSTOM_DOMAIN grace: downgrade → cron run on day 23 sends warning → day 30 reverts.
- Multi-tenant isolation: violation in one org never leaks to another.

### 6.3 Kiwi TCMS (manual QA)

After Phase 5 lands, a manual QA pass with screenshots in `docs/superpowers/qa/downgrade-overhaul-2026-05-XX.md` and synced to Kiwi via `npm run kiwi:sync-manual data/kiwi/billing-downgrade-2026-05-XX.json`. Build name `manual-qa-downgrade-overhaul-2026-05-XX`. Reuse Product=Deqah, Version=main per the existing rule.

## 7. Phasing

The implementation breaks into 5 phases, each its own PR, each merged green to `feat/downgrade-overhaul` before the next starts. Final PR `feat/downgrade-overhaul` → `main`.

| Phase | Scope | Files touched (rough) | Owner-only? |
|---|---|---|---|
| **1** | Counter integrity: decrement listeners, recompute Employee fix, backfill script, ZATCA always-on, STORAGE removal, migration M1 + M2 + M3 | ~25 backend files | Yes (touches schema, billing, identity-adjacent) |
| **2** | Boolean downgrade safety: extend `DowngradeSafetyService`, extend `DowngradeViolation` shape, update both downgrade handlers + cron, exception body schema | ~15 backend files | Yes |
| **3** | Data retention enforcement: `FeatureCheckService`, retrofit ~10 background sites, grace columns + crons + emails | ~25 backend files + 3 email templates | Yes |
| **4** | Dashboard Dialog UI + deactivate buttons audit/add, billing copy AR+EN, plan-comparison page updates (drop ZATCA + STORAGE) | ~15 dashboard files + admin plan editor + ui copy | Standard |
| **5** | E2E suites (5 flows), Kiwi sync, screenshots, final integration test | test files + QA artifacts | Standard |

Each phase ends with: typecheck green + lint green + unit tests green + (where applicable) e2e green + commit + push + PR + auto-merge.

## 8. Open Risks

- **Existing tests assume the buggy counter behavior.** Phase 1 will have to update specs that asserted "counter only goes up." Audit `apps/backend/src/modules/platform/billing/usage-counter/*.spec.ts` early.
- **Removing ZATCA from FeatureKey is a wide change** — every reference in tests, types, admin UI must be removed. Plan for ~50 grep hits.
- **Removing STORAGE same shape.**
- **`event-bus subscribe` pattern** is BullMQ-based — verify the new lifecycle events have publishers (e.g. `org-config.branch.deactivated` may not exist; we need to add it).
- **Backfill script** must run inside `RlsHelper.bypass` since it crosses tenants. Standard cron pattern.
- **Dashboard re-fetch on Dialog reopen** must invalidate the right TanStack Query keys (`['billing','proration-preview']` and a new `['billing','downgrade-violations']`).

## 9. Success Criteria

- Tenant on Pro plan with 12 employees can downgrade to Basic by deactivating 7 employees through `/employees`, then clicking Downgrade. Total clicks: 8.
- Tenant on Enterprise with active recurring templates and coupons sees both as separate Dialog rows with deep links.
- Tenant who downgrades from Enterprise to Basic with active webhooks still receives webhooks for 7 days, then receives 402 + skips.
- ZATCA endpoints return 200 for every plan tier (Basic included).
- Usage widget on `/settings/billing` matches the actual count of active employees within 30 seconds of a deactivation.
- All five e2e flows pass; all unit specs pass; Kiwi run shows ≥ 95% pass on manual cases.
