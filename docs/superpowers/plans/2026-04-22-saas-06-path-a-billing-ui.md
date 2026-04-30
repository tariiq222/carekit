# SaaS-06 Path A — Billing UI Completion (unblocked by Plan 04)

> **Context.** PR #31 (`feat/saas-06-dashboard-i18n`) landed ~15% of Plan 06 — i18n parity gate + tenant switcher. The remaining billing-UI tasks were blocked on Plan 04 artifacts. Plan 04 is now merged on `main` (PR #30). This plan closes the billing-UI scope so PR #31 can exit draft and ship.
>
> **Not in scope:** the 434-literal `t()` refactor (Plan 06a) and DirectionProvider/useTerminology (dropped — see PR #31 description for amendments).

**Branch:** continue `feat/saas-06-dashboard-i18n` (extend PR #31). Rebase onto `main` first to pick up Plan 04 artifacts.

**Estimate:** 1–2 full working days.

---

## Pre-flight — before writing any code

1. `git checkout feat/saas-06-dashboard-i18n && git pull origin main --no-ff` — pull Plan 04 in.
2. Read these so you know what's already wired:
   - [apps/dashboard/hooks/use-current-subscription.ts](apps/dashboard/hooks/use-current-subscription.ts) — TanStack hooks already exist (`useCurrentSubscription`, `usePlans`, `useBillingMutations`).
   - [apps/dashboard/lib/api/billing.ts](apps/dashboard/lib/api/billing.ts) — network functions already exist.
   - [apps/dashboard/lib/types/billing.ts](apps/dashboard/lib/types/billing.ts) — `Plan`, `Subscription`, `SubscriptionInvoice` types defined. `Plan.limits` is `Record<string, number | boolean>`.
   - [apps/dashboard/app/(dashboard)/settings/billing/page.tsx](apps/dashboard/app/(dashboard)/settings/billing/page.tsx) — skeleton page; uses hardcoded AR/EN via `isAr`. Will be replaced.
   - Existing billing components ([current-plan-card.tsx](apps/dashboard/app/(dashboard)/settings/billing/components/current-plan-card.tsx), [usage-bars.tsx](apps/dashboard/app/(dashboard)/settings/billing/components/usage-bars.tsx), [invoices-table.tsx](apps/dashboard/app/(dashboard)/settings/billing/components/invoices-table.tsx)) — **keep; extend with t() + upgrade/cancel actions.**
   - [apps/dashboard/components/sidebar-config.ts](apps/dashboard/components/sidebar-config.ts) — uses `featureFlag?: FeatureFlagKey`. We will NOT repurpose this; the new `FeatureGate` is a *component* wrapper (not a sidebar-config flag).
   - [apps/dashboard/components/locale-provider.tsx](apps/dashboard/components/locale-provider.tsx) — `useLocale()` returns `{ locale, t, ... }`. Plan 06 assumed next-intl — **actual system is this custom provider.** Use `t("key")` via this provider.
3. Read backend Plan 04 billing endpoints (already merged):
   - `GET /api/v1/dashboard/billing/subscription` — returns `Subscription` with optional `invoices[]` and current usage snapshot (see Plan 04 Task 7B).
   - Usage fields live on `Subscription` via the handler's join — confirm by running backend and hitting the endpoint. If usage lives on a separate endpoint, add `billingApi.currentUsage()` in step 2.2.

**Stop if:** the `Subscription` response does NOT include usage counters. In that case:
- Option A — add `GET /api/v1/dashboard/billing/usage` in backend before continuing (small — one handler wrapping `UsageAggregatorService`).
- Option B — inline fetch in `BillingContext` via a second query.
Document whichever you pick in this plan's "Amendments" section.

---

## Scope

### In-scope

1. `BillingContext` + `useCurrentPlan()` hook that exposes `{ plan, limits, usage, status }` to the app tree.
2. `<FeatureGate feature="chatbot">` component + `useFeatureEnabled()` programmatic hook.
3. `<BillingUsageWidget>` in the sidebar — compact progress bar for the primary metric (bookings this month).
4. Full `/settings/billing` page: replace hardcoded literals with `t()`, wire upgrade/downgrade/cancel/resume actions using existing `useBillingMutations()`, surface grace-period banner for `PAST_DUE` / `SUSPENDED`.
5. `ar.billing.ts` / `en.billing.ts` translation files (new).
6. Vitest specs for: `BillingContext`, `FeatureGate`, `useFeatureEnabled`, `BillingUsageWidget`, billing page action flows.
7. QA gate via Chrome DevTools MCP (3 scenarios in §7).
8. PR #31 out of draft.

### Deferred

- Page-by-page `t()` refactor for 65 files (Plan 06a).
- EN parity for non-billing features (Plan 06a).
- i18n snapshot test (Plan 06a).
- Custom-domain billing UI touches (Plan 09).

---

## Task 1 — `BillingContext` + `useCurrentPlan`

**New files:**

```
apps/dashboard/lib/billing/billing-context.tsx     (~90 lines)
apps/dashboard/lib/billing/use-current-plan.ts     (~30 lines)
apps/dashboard/test/unit/lib/billing-context.spec.tsx
```

### 1.1 `billing-context.tsx`

```tsx
"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useCurrentSubscription } from "@/hooks/use-current-subscription"
import type { Subscription, SubscriptionStatus, Plan } from "@/lib/types/billing"

export interface BillingContextValue {
  subscription: Subscription | null
  plan: Plan | null
  limits: Record<string, number | boolean>
  status: SubscriptionStatus | null
  usage: Record<string, number> // empty if backend hasn't surfaced yet
  isLoading: boolean
  isActive: boolean   // ACTIVE | TRIALING
  isPastDue: boolean  // PAST_DUE
  isSuspended: boolean
}

const BillingContext = createContext<BillingContextValue | null>(null)

export function BillingProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useCurrentSubscription()
  const subscription = data ?? null
  const plan = subscription?.plan ?? null

  const value: BillingContextValue = {
    subscription,
    plan,
    limits: plan?.limits ?? {},
    status: subscription?.status ?? null,
    usage: (subscription as unknown as { usage?: Record<string, number> })?.usage ?? {},
    isLoading,
    isActive: subscription?.status === "ACTIVE" || subscription?.status === "TRIALING",
    isPastDue: subscription?.status === "PAST_DUE",
    isSuspended: subscription?.status === "SUSPENDED",
  }

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>
}

export function useBilling(): BillingContextValue {
  const ctx = useContext(BillingContext)
  if (!ctx) throw new Error("useBilling must be used inside BillingProvider")
  return ctx
}
```

### 1.2 `use-current-plan.ts`

```ts
"use client"
import { useBilling } from "@/lib/billing/billing-context"

export function useCurrentPlan() {
  const { plan, limits, status, isLoading } = useBilling()
  return { plan, limits, status, isLoading }
}
```

### 1.3 Wire into layout

Edit `apps/dashboard/app/layout.tsx`:

```tsx
import { BillingProvider } from "@/lib/billing/billing-context"
// inside the provider tree, AFTER QueryProvider:
<BillingProvider>{children}</BillingProvider>
```

Do NOT place it above `QueryProvider` — `useCurrentSubscription()` requires TanStack Query.

### 1.4 Spec

`billing-context.spec.tsx` — 4 tests:
- Renders `isLoading=true` while query is pending.
- Returns `isActive=true` for status=ACTIVE and TRIALING.
- Returns `isPastDue=true`, `isSuspended=true` for respective statuses.
- `limits` falls back to `{}` when no plan.

### 1.5 Acceptance

- [ ] `npm run typecheck` clean.
- [ ] `npm run test` green.

---

## Task 2 — `<FeatureGate>` + `useFeatureEnabled()`

**New files:**

```
apps/dashboard/components/feature-gate.tsx                (~40 lines)
apps/dashboard/hooks/use-feature-enabled.ts               (~20 lines)
apps/dashboard/test/unit/components/feature-gate.spec.tsx
apps/dashboard/test/unit/hooks/use-feature-enabled.spec.tsx
```

### 2.1 Contract

`Plan.limits` from backend is a flat `Record<string, number | boolean>`. A feature is "enabled" when:
- `limits[feature] === true`, OR
- `limits[feature]` is a number > 0, OR
- key is absent AND subscription is ACTIVE/TRIALING (default-on for safety during plan-catalog evolution).

A feature is "blocked" when the org is SUSPENDED (regardless of limit).

### 2.2 `use-feature-enabled.ts`

```ts
"use client"
import { useBilling } from "@/lib/billing/billing-context"

export function useFeatureEnabled(feature: string): boolean {
  const { limits, isSuspended, isActive } = useBilling()
  if (isSuspended) return false
  if (!isActive) return false
  const v = limits[feature]
  if (v === undefined) return true  // default-on if plan catalog hasn't defined it yet
  if (typeof v === "boolean") return v
  if (typeof v === "number") return v > 0
  return false
}
```

### 2.3 `feature-gate.tsx`

```tsx
"use client"
import type { ReactNode } from "react"
import { useFeatureEnabled } from "@/hooks/use-feature-enabled"

export interface FeatureGateProps {
  feature: string
  children: ReactNode
  fallback?: ReactNode
}

export function FeatureGate({ feature, children, fallback = null }: FeatureGateProps) {
  const enabled = useFeatureEnabled(feature)
  return <>{enabled ? children : fallback}</>
}
```

### 2.4 Specs

- `useFeatureEnabled`: 5 tests (absent=true, `true`, `false`, number>0, number=0, SUSPENDED→false).
- `FeatureGate`: 2 tests (renders children when enabled; renders fallback when disabled).

### 2.5 Don't gate the sidebar yet

Sidebar uses legacy `featureFlag: FeatureFlagKey` (feature-flag module, unrelated to subscription). Keep that as-is. `FeatureGate` is for *page-level* gating (chatbot page, reports page) — we will NOT wire any page in this plan. Downstream PRs add gates as needed.

### 2.6 Acceptance

- [ ] All 7 new tests green.

---

## Task 3 — `<BillingUsageWidget>` (sidebar)

**New files:**

```
apps/dashboard/components/billing-usage-widget.tsx          (~90 lines)
apps/dashboard/test/unit/components/billing-usage-widget.spec.tsx
```

### 3.1 Data contract

Reads `useBilling()`. Primary metric: `usage.BOOKINGS` (count this month) vs `limits.maxBookingsPerMonth`. If either is missing, render nothing (avoid guessing).

### 3.2 Component shape

- ≤ 90 lines.
- Shows: plan name (`nameAr`/`nameEn`), progress bar (0–100%), `current / max` label, upgrade link if ≥ 80%.
- Collapsed on mobile via `md:block hidden` so sidebar doesn't overflow.
- Uses existing Progress UI primitive from `@deqah/ui` or shadcn `Progress`.
- `bg-warning/10 text-warning` tone when 80–99%; `bg-error/10 text-error` at 100%+.

### 3.3 Translation keys (add to `ar.billing.ts` / `en.billing.ts`)

```
billing.usage.title        — "الاستخدام" / "Usage"
billing.usage.bookings     — "حجوزات هذا الشهر" / "Bookings this month"
billing.usage.upgradeCta   — "ترقية الخطة" / "Upgrade plan"
billing.plan.label         — "خطتك الحالية" / "Your plan"
```

### 3.4 Mount

Edit `apps/dashboard/components/app-sidebar.tsx`: add `<BillingUsageWidget />` at the footer of the sidebar (below the last nav group), inside the existing glass shell.

### 3.5 Spec

- Renders nothing when data missing.
- Renders 42% bar for `{ usage: { BOOKINGS: 420 }, limits: { maxBookingsPerMonth: 1000 } }`.
- Shows upgrade CTA at ≥ 80%.
- Uses AR when locale=ar; EN when locale=en.

### 3.6 Acceptance

- [ ] File ≤ 90 lines.
- [ ] 4 tests green.
- [ ] Visual spot-check in both locales.

---

## Task 4 — Billing translations (`ar.billing.ts` / `en.billing.ts`)

**New files:**

```
apps/dashboard/lib/translations/ar.billing.ts
apps/dashboard/lib/translations/en.billing.ts
```

Both ≤ 150 lines. Keys are the single source of truth for Tasks 3, 5. At minimum, both must expose:

```ts
export const billingAr = {
  title: "الفوترة والاشتراك",
  description: "إدارة خطة اشتراكك وفواتيرك.",
  plan: {
    label: "خطتك الحالية",
    basic: "الأساسية",
    pro: "المحترفة",
    enterprise: "المؤسسات",
    trial: "تجربة",
    active: "نشطة",
    pastDue: "متأخر السداد",
    suspended: "موقوفة",
    canceled: "ملغاة",
    monthly: "شهري",
    annual: "سنوي",
    changePlan: "تغيير الخطة",
    cancelPlan: "إلغاء الاشتراك",
    resumePlan: "استئناف الاشتراك",
  },
  usage: {
    title: "الاستخدام",
    bookings: "حجوزات هذا الشهر",
    employees: "الموظفون",
    branches: "الفروع",
    clients: "العملاء",
    upgradeCta: "ترقية الخطة",
    limit: "الحد",
  },
  invoices: {
    title: "الفواتير",
    empty: "لا توجد فواتير بعد.",
    status: {
      DRAFT: "مسودة",
      DUE: "مستحقة",
      PAID: "مدفوعة",
      FAILED: "فشلت",
      VOID: "ملغاة",
    },
    amount: "المبلغ",
    date: "التاريخ",
    download: "تحميل",
  },
  banners: {
    pastDue: "اشتراكك متأخر السداد — الرجاء تحديث طريقة الدفع.",
    suspended: "تم إيقاف الاشتراك. بعض الميزات غير متاحة.",
    trialEnding: "تنتهي التجربة خلال {days} أيام.",
  },
  dialogs: {
    upgradeTitle: "ترقية الخطة",
    downgradeTitle: "تخفيض الخطة",
    cancelTitle: "إلغاء الاشتراك",
    confirm: "تأكيد",
    cancel: "إلغاء",
    reasonLabel: "السبب (اختياري)",
  },
} as const

export type BillingTranslations = typeof billingAr
```

`en.billing.ts` mirrors with English values and **must parse through `npm run i18n:verify` cleanly**.

Acceptance:

- [ ] Parity script returns 0 drift.
- [ ] Both files ≤ 150 lines.

---

## Task 5 — `/settings/billing` full page

Replace hardcoded AR/EN in [page.tsx](apps/dashboard/app/(dashboard)/settings/billing/page.tsx). Keep page ≤ 150 lines (Dashboard CLAUDE.md rule).

### 5.1 New feature components

Move the existing components from `app/(dashboard)/settings/billing/components/` → `components/features/billing/`:

```
components/features/billing/current-plan-card.tsx
components/features/billing/usage-table.tsx       (renamed from usage-bars.tsx; full usage table not just bars)
components/features/billing/invoices-table.tsx
components/features/billing/status-banner.tsx     (NEW — shows past-due/suspended/trial-ending)
components/features/billing/upgrade-dialog.tsx    (NEW — plan picker + cycle toggle + confirm)
components/features/billing/cancel-dialog.tsx     (NEW — reason + confirm)
```

All ≤ 300 lines each (Dashboard CLAUDE.md rule). Move (don't copy) so the old folder disappears. Update imports.

### 5.2 Page rewrite

```tsx
"use client"

import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { useLocale } from "@/components/locale-provider"
import { useBilling } from "@/lib/billing/billing-context"
import { CurrentPlanCard } from "@/components/features/billing/current-plan-card"
import { UsageTable } from "@/components/features/billing/usage-table"
import { InvoicesTable } from "@/components/features/billing/invoices-table"
import { StatusBanner } from "@/components/features/billing/status-banner"

export default function BillingPage() {
  const { t } = useLocale()
  const { subscription, isLoading } = useBilling()

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title={t("billing.title")}
        description={t("billing.description")}
      />
      <StatusBanner />

      <div className="space-y-4">
        <CurrentPlanCard subscription={subscription} isLoading={isLoading} />
        <UsageTable subscription={subscription} isLoading={isLoading} />
        <InvoicesTable invoices={subscription?.invoices} isLoading={isLoading} />
      </div>
    </ListPageShell>
  )
}
```

### 5.3 `CurrentPlanCard` responsibilities

- Shows plan name via `t("billing.plan." + plan.slug.toLowerCase())`.
- Shows billing cycle.
- Two buttons: `{t("billing.plan.changePlan")}` (opens `UpgradeDialog`) + `{t("billing.plan.cancelPlan")}` (opens `CancelDialog`).
- If SUSPENDED or CANCELED: single `{t("billing.plan.resumePlan")}` button instead.
- Calls into `useBillingMutations()` on confirm.

### 5.4 `StatusBanner`

- Consumes `useBilling()`.
- Renders `banners.pastDue` in `bg-warning/10 text-warning` box when `isPastDue`.
- Renders `banners.suspended` in `bg-error/10 text-error` box when `isSuspended`.
- Renders `banners.trialEnding` with days remaining when status=TRIALING and `trialEndsAt - now <= 3 days`.
- Otherwise renders nothing.

### 5.5 `UpgradeDialog`

- Lists plans from `usePlans()`.
- Radio group for plan + toggle for MONTHLY/ANNUAL.
- Confirm button calls `upgradeMut.mutateAsync({ planId, billingCycle })` and shows success toast.
- Dialog closes on success; errors bubble via toast.

### 5.6 `CancelDialog`

- Textarea for `reason` (optional).
- Confirm calls `cancelMut.mutateAsync(reason || undefined)`.
- Danger-tone action button.

### 5.7 Specs

Min 4 integration-style specs at `apps/dashboard/test/unit/features/billing/`:
- Page renders AR title when locale=ar.
- `StatusBanner` renders past-due copy for PAST_DUE state.
- `UpgradeDialog` disables confirm until plan selected.
- `CancelDialog` sends reason on confirm.

### 5.8 Acceptance

- [ ] Page ≤ 150 lines.
- [ ] No component > 300 lines.
- [ ] No hardcoded AR/EN strings (everything via `t()`).
- [ ] `npm run typecheck && npm run test && npm run lint` clean.
- [ ] `npm run i18n:verify` clean.

---

## Task 6 — Rebase & squash PR #31

After Tasks 1–5:

```bash
git fetch origin
git rebase origin/main
git push --force-with-lease
```

Update PR #31 description:
- Move Task 5+8 items from "What's explicitly out" to "What's in".
- Keep Task 9 (434-literal refactor) listed as deferred to Plan 06a.
- Mark ready-for-review (exit draft).

---

## Task 7 — QA gate

### 7.1 Local boot

```bash
npm run docker:up
npm run dev:backend     # :5100
npm run dev:dashboard   # :5103
```

Seed an org with an active subscription — confirm backend returns data at `GET /api/v1/dashboard/billing/subscription`.

### 7.2 Chrome DevTools MCP scripts

Run 6 scenarios. Screenshot each; save to `docs/superpowers/qa/saas-06-path-a-<date>/`.

| # | Scenario | Expected |
|---|---|---|
| 1 | `/settings/billing` in AR | RTL layout, Arabic labels, plan card shows plan name |
| 2 | `/settings/billing` in EN | LTR layout, English labels |
| 3 | Click "Upgrade plan" | Dialog opens with plan list + cycle toggle |
| 4 | Sidebar widget | Progress bar visible, shows `current/max` |
| 5 | Force `status=PAST_DUE` in dev seed | Red banner visible on billing page |
| 6 | Force `status=SUSPENDED` | Suspended banner + cannot upgrade (button disabled) |

### 7.3 Kiwi sync

Author `data/kiwi/dashboard-billing-<date>.json`:

```json
{
  "domain": "dashboard-billing",
  "version": "main",
  "build": "saas-06-path-a-<date>",
  "planName": "Deqah / Dashboard-Billing / Manual QA",
  "planSummary": "Plan 06 Path A — billing UI manual QA",
  "runSummary": "Covers subscription list, upgrade dialog, cancel dialog, usage widget, status banners across AR/EN",
  "cases": [
    { "summary": "Billing page renders in AR",  "text": "Open /settings/billing with locale=ar. Verify RTL and Arabic labels.", "result": "PASS" },
    { "summary": "Billing page renders in EN",  "text": "Open /settings/billing with locale=en. Verify LTR and English labels.", "result": "PASS" },
    { "summary": "Upgrade dialog flow",         "text": "Click Change plan, pick PRO, confirm. Toast shown; subscription refetches.", "result": "PASS" },
    { "summary": "Sidebar usage widget",        "text": "Verify progress bar matches backend usage/limit ratio.", "result": "PASS" },
    { "summary": "Past-due banner visible",     "text": "Seed PAST_DUE state. Banner visible and button tone warning.", "result": "PASS" },
    { "summary": "Suspended state locks upgrade", "text": "Seed SUSPENDED. Banner visible; upgrade button disabled.", "result": "PASS" }
  ]
}
```

Run:

```bash
npm run kiwi:sync-manual data/kiwi/dashboard-billing-<date>.json
```

Link returned Kiwi URLs into the QA report.

### 7.4 QA report

Write `docs/superpowers/qa/saas-06-path-a-<date>.md`:
- Screenshots per scenario.
- Kiwi plan/run URLs.
- Any findings (file issues; do not block PR for non-regressions).

---

## Task 8 — Final verification + PR

### 8.1 Verification matrix

```bash
cd apps/dashboard
npm run typecheck              # 0 errors
npm run lint                   # 0 errors
npm run i18n:verify            # 0 drift
npm run test                   # all green
```

Dashboard file-size sweep:

```bash
find app components hooks lib -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -exec awk 'END { if (NR > 350) print FILENAME ": " NR " lines" }' {} \;
```

Should print nothing.

### 8.2 Update `apps/dashboard/CLAUDE.md`

Append a "Billing UI (SaaS-06)" section:

```
## Billing UI (SaaS-06)

- Subscription state available via `useBilling()` from `lib/billing/billing-context.tsx`.
- Feature gating: `<FeatureGate feature="chatbot">...</FeatureGate>` OR `useFeatureEnabled(feature)`.
- Sidebar widget: `components/billing-usage-widget.tsx`.
- All billing copy in `lib/translations/ar.billing.ts` + `lib/translations/en.billing.ts` — i18n-verify enforced.
- Status banners (`PAST_DUE`, `SUSPENDED`, trial-ending) live in `components/features/billing/status-banner.tsx`.
```

### 8.3 Update transformation index

Edit [2026-04-21-saas-transformation-index.md](docs/superpowers/plans/2026-04-21-saas-transformation-index.md):
- Phase 06 row: change status to `🟡 PARTIAL (Path A done; Path B → Plan 06a)`.
- Add log entry under Progress log.

### 8.4 Memory update

Append to memory file [saas06_status.md](~/.claude/projects/-Users-tariq-code-deqah/memory/saas06_status.md): note Path A merged, Path B (literals + EN parity for non-billing) deferred to Plan 06a.

### 8.5 Commit cadence

One commit per task. Conventional format:

```
feat(saas-06): BillingContext + useCurrentPlan
feat(saas-06): FeatureGate + useFeatureEnabled
feat(saas-06): BillingUsageWidget in sidebar
feat(saas-06): billing translations (ar + en)
feat(saas-06): /settings/billing full UI — upgrade/cancel/status
docs(saas-06): QA gate report + Kiwi sync
docs(saas-06): dashboard CLAUDE.md + transformation index updates
```

### 8.6 PR out of draft

```bash
gh pr ready 31
gh pr view 31 --web
```

Merge criteria:
- [ ] CI green (or --admin if billing-blocked as before)
- [ ] Manual QA report linked in description
- [ ] Kiwi URLs in description
- [ ] All task acceptance boxes ticked in this plan file

---

## Acceptance (roll-up)

- [ ] Task 1 — BillingContext + hook + spec
- [ ] Task 2 — FeatureGate + useFeatureEnabled + specs
- [ ] Task 3 — BillingUsageWidget + sidebar mount + spec
- [ ] Task 4 — ar/en.billing.ts + parity clean
- [ ] Task 5 — /settings/billing page + 5 feature components + 4 specs
- [ ] Task 6 — rebase + squash + PR description updated
- [ ] Task 7 — 6 QA scenarios + Kiwi sync + QA report
- [ ] Task 8 — typecheck/lint/i18n/test clean + CLAUDE.md + index + memory + merge

---

## Amendments applied during execution

- 2026-04-22: `GET /api/v1/dashboard/billing/subscription` on `main` does **not** include usage counters yet. The current handler only returns `include: { plan: true }`. For Path A execution we used a dashboard-side compatibility fallback: `Subscription.usage` remains optional, `BillingContext` exposes an empty usage map when absent, and both `UsageBars` / `BillingUsageWidget` render conservatively (no guessed usage). A backend follow-up is still needed to expose real counters (either by joining usage onto `Subscription` or adding `GET /api/v1/dashboard/billing/usage`).
- 2026-04-22: Execution continued inside the existing DEEP-path worktree `/Users/tariq/code/deqah-feat-saas-06-i18n` instead of the main workspace so the branch could be safely rebased onto `origin/main` and kept isolated per `WORKTREES.md`.
