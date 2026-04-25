# CareKit Dashboard — Next.js Admin

## Tech

Next.js 15 (App Router), React 19, TanStack Query v5, Tailwind 4, Zod, React Hook Form. UI primitives come from the `@carekit/ui` workspace package (extracted in SaaS-05a). Custom i18n runtime — `next-intl` is installed but not used at runtime.

## Layer Rules (strict — no exceptions)

```
app/(dashboard)/[feature]/page.tsx     ≤150 lines — orchestration only
    ↓ imports from
components/features/[feature]/         ≤300 lines per file
components/features/shared/            shared across 3+ features
@carekit/ui                            shadcn primitives — DO NOT MODIFY
components/ui/                         app-local wrappers only (date-picker, nationality-select)
    ↓ import from
hooks/use-[feature].ts                 TanStack Query — ≤200 lines
    ↓ imports from
lib/api/[feature].ts                   network calls only — ≤200 lines
lib/types/[feature].ts                 type definitions — ≤250 lines
lib/schemas/[feature].schema.ts        zod schemas — ≤150 lines
lib/query-keys.ts                      cache keys
lib/utils.ts                           pure utilities
```

**Banned imports:**
- `features/A → features/B` (cross-feature)
- `lib/ → components/` or `lib/ → hooks/`
- `components/ → app/` (reversed layer)

## Design System — Frosted Glass

- iOS-inspired glassmorphism: `backdrop-filter: blur(24px)`, semi-transparent surfaces
- Font: IBM Plex Sans Arabic (RTL-first)
- Spacing grid: 8px
- Tokens: `--primary`, `--surface`, `--border`, `--success`, `--warning`, `--error`
- Dark mode: separate token values via CSS custom properties
- Classes: `.glass`, `.glass-solid`, `.glass-strong` (defined in `globals.css`)
- Full DS spec: `dashboard/DESIGN-SYSTEM.md`

## Dashboard Routes (app/(dashboard)/)

`activity-log/`, `bookings/`, `branches/`, `branding/`, `categories/`,
`chatbot/`, `clients/`, `contact-messages/`, `content/`, `coupons/`,
`departments/`, `employees/`, `intake-forms/`, `invoices/`,
`notifications/`, `payments/`, `ratings/`, `reports/`, `services/`,
`settings/` (with `billing/` and `sms/` sub-routes), `users/`, `zatca/`

Top-level layout/error/loading: `layout.tsx`, `error.tsx`, `loading.tsx`, `page.tsx`.

## UI Primitive Sourcing

- **Source of truth:** `@carekit/ui` (`packages/ui/src/primitives/*` + `packages/ui/src/hooks/*`).
  Import as `import { Button } from "@carekit/ui"`.
- **Never modify primitives in place.** Bug-fix or extend them inside the workspace package.
- **`apps/dashboard/components/ui/`** holds only app-local wrappers
  (currently `date-picker.tsx` and `nationality-select.tsx`). Do NOT
  add new primitives here — they belong in `@carekit/ui` so mobile/admin
  can share them.
- Two carve-outs intentionally remain (sidebar primitives + a couple of
  app-only components); see `packages/ui/CLAUDE.md` for the list.

## Real-time Updates

- **No WebSockets** — use `refetchInterval` in TanStack Query (30s default for notifications/booking status)
- `socket.io-client` removed 2026-04-12 — revisit only if live queue board or chat dashboard is required
- `@xyflow/react` removed 2026-04-12 — no current use case; re-add when flow diagrams are specced

## i18n + terminology + tenant switcher (SaaS-06)

- **i18n runtime is custom, not next-intl.** The source of truth is
  `components/locale-provider.tsx` (`LocaleProvider` → `useLocale()` →
  `t(key)` backed by a flat `translations[locale][key]` map assembled in
  `lib/translations.ts` from `lib/translations/{ar,en}.*.ts` modules).
  `next-intl` is installed but unused at runtime; do NOT migrate partial
  pages to `useTranslations('<namespace>')` without a deliberate plan —
  it would fork the system.
- **Every user-facing string goes through `t('<key>')`** from `useLocale()`.
  Keys are flat dot-namespaced strings (e.g. `"nav.bookings"`,
  `"bookings.confirmStatus"`). Plurals are currently handled with
  per-case keys (there is no ICU plural helper yet).
- **AR/EN parity is gated** by `npm run i18n:verify` (runs
  `scripts/verify-translation-parity.mjs`). It compares the key set of
  each `ar.*.ts` module against its `en.*.ts` sibling and exits non-zero
  on drift. Run it before every PR that touches translations.
- **Vertical-aware terminology** goes through the shipped
  `useTerminology(verticalSlug)` hook (`hooks/use-terminology.ts`,
  backed by `GET /public/verticals/:slug/terminology`). Use its own
  `t(key)` return value, distinct from `useLocale().t` — different
  dictionaries, different purposes. Vertical labels (Patient/Client/
  Customer/Member, Appointment/Booking/Session/Class) come from this
  hook so the same screens read correctly across all 4 vertical families.
- **RTL/LTR direction** is already wired: `LocaleProvider` flips
  `document.documentElement.dir` *and* wraps children in
  `@radix-ui/react-direction`'s `DirectionProvider`. Never hardcode
  `left`/`right`; always use logical Tailwind classes (`ps-`/`pe-`/
  `ms-`/`me-`).
- **Tenant switcher** (`components/tenant-switcher.tsx`) reads
  `useMemberships()` (`GET /auth/memberships`) and hides itself when
  the user has ≤1 active membership. On selection it calls
  `useSwitchOrganization()` (`POST /auth/switch-org`) → fresh
  access+refresh token pair → `queryClient.clear()` → `router.refresh()`.
  Mounted in `components/header.tsx` between the sidebar trigger and
  the theme toggle.

## Billing + Feature Gating (SaaS-04 / 06 Path A)

- **Subscription state** is exposed through `useBilling()` from
  `lib/billing/billing-context.tsx`; use `useCurrentPlan()` when a
  component only needs `{ plan, limits, status, isLoading }`.
  `hooks/use-current-subscription.ts` is the underlying TanStack Query
  hook for the raw subscription record.
- **Subscription-aware page gating** is done with
  `<FeatureGate feature="chatbot">...</FeatureGate>`
  (`components/feature-gate.tsx`) or the `useFeatureEnabled(feature)`
  hook (`hooks/use-feature-enabled.ts`). This is separate from the legacy
  sidebar `featureFlag` config.
- **Quantitative limits** (e.g. employees, bookings/month) check via
  `useQuantitativeLimit()` (`hooks/use-quantitative-limit.ts`).
- **Sidebar billing summary** lives in `components/billing-usage-widget.tsx`
  and intentionally renders nothing when usage counters are absent
  instead of guessing.
- **Billing copy** belongs in `lib/translations/ar.billing.ts` and
  `lib/translations/en.billing.ts`.
- **`/settings/billing`** is the canonical billing screen for clinic
  owners (plan + invoices + usage). Keep
  `app/(dashboard)/settings/billing/page.tsx` orchestration-only and
  push view logic into the billing components folder.
- **`/settings/sms`** owns per-tenant SMS provider config
  (Unifonic/Taqnyat) — see `hooks/use-sms-config.ts`.

## Component Placement Rules

| Component type | Location |
|---------------|----------|
| shadcn primitive | `@carekit/ui` (workspace package) — never modify in place |
| App-local primitive wrapper | `components/ui/` (date-picker, nationality-select only) |
| Feature-specific | `components/features/[feature]/` |
| Shared (3+ features) | `components/features/shared/` or `components/features/[name].tsx` |
| Page layout shells | `components/features/shared/` |
| Sidebar config | `components/sidebar-config.ts` |
| Tenant/billing shells | `components/tenant-switcher.tsx`, `components/billing-usage-widget.tsx`, `components/feature-gate.tsx` |

## File Size Limits

| Type | Max lines |
|------|-----------|
| Page (app/) | 150 (add `// EXCEPTION: <reason>, approved <date>` comment if exceeded) |
| Feature component | 300 |
| Hook | 200 |
| API function | 200 |
| Type file | 250 |
| Zod schema | 150 |
| Translation | 300 |
| Any file (absolute) | 350 |

## Pre-PR Checklist

```
□ npm run typecheck          → 0 errors
□ npm run lint               → 0 errors
□ npm run i18n:verify        → AR/EN parity
□ لا يوجد ملف يتجاوز 350 سطر
□ لا cross-feature imports
□ Primitives imported from @carekit/ui (not components/ui/)
□ كل Query في use-[feature].ts
□ كل Mutation في use-[feature]-mutations.ts
□ page.tsx لا يحتوي على business logic
□ لا hex colors أو text-gray-*
□ كل RTL spacing صحيح (ps-/pe-/ms-/me-)
□ كل أيقونة من @hugeicons فقط
□ لا inline styles
□ staleTime مضبوط على أي query جديدة
□ Feature جديدة مضافة في eslint.config.mjs → FEATURES
□ Tenant switcher still hides for the common single-org user
□ Vertical-sensitive labels go through useTerminology(), not hardcoded
□ Subscription-gated features wrapped in <FeatureGate /> or useFeatureEnabled()
```

## Development

```bash
npm run dev          # Next.js dev server on :5103 (Turbopack)
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run test         # Vitest
npm run build        # Production build
npm run i18n:verify  # AR/EN parity gate
```

## QA Gate

Dashboard e2e is manual via **Chrome DevTools MCP** — this is the required pre-merge check for any page change. Playwright was removed on 2026-04-16; tagged test reports are not the source of truth for dashboard UI.
