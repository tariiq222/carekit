# CareKit Dashboard — Next.js Admin

## Tech

Next.js 15 (App Router), React 19, TanStack Query v5, shadcn/ui, Tailwind 4, next-intl (AR/EN), Zod, React Hook Form.

## Layer Rules (strict — no exceptions)

```
app/(dashboard)/[feature]/page.tsx     ≤150 lines — orchestration only
    ↓ imports from
components/features/[feature]/         ≤300 lines per file
components/features/shared/            shared across 3+ features
components/ui/                         shadcn primitives — DO NOT MODIFY
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

`bookings/`, `clients/`, `employees/`, `payments/`, `reports/`,
`services/`, `branches/`, `coupons/`, `chatbot/`,
`intake-forms/`, `invoices/`, `ratings/`, `notifications/`,
`activity-log/`, `users/`, `settings/`,
`branding/`, `zatca/`

## Real-time Updates

- **No WebSockets** — use `refetchInterval` in TanStack Query (30s default for notifications/booking status)
- `socket.io-client` removed 2026-04-12 — revisit only if live queue board or chat dashboard is required
- `@xyflow/react` removed 2026-04-12 — no current use case; re-add when flow diagrams are specced

## i18n

- Provider: `next-intl` with `locale-provider.tsx`
- Translations: `lib/translations/[lang].[feature].ts` (≤300 lines)
- All user-facing strings must be translated (AR + EN)
- RTL layout is the default — LTR is the override

## Component Placement Rules

| Component type | Location |
|---------------|----------|
| shadcn primitive | `components/ui/` — never modify |
| Feature-specific | `components/features/[feature]/` |
| Shared (3+ features) | `components/features/shared/` or `components/features/[name].tsx` |
| Page layout shells | `components/features/shared/` |
| Sidebar config | `components/sidebar-config.ts` |

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
□ npm run typecheck  →  0 errors
□ npm run lint       →  0 errors
□ لا يوجد ملف يتجاوز 350 سطر
□ لا cross-feature imports
□ كل Query في use-[feature].ts
□ كل Mutation في use-[feature]-mutations.ts
□ page.tsx لا يحتوي على business logic
□ لا hex colors أو text-gray-*
□ كل RTL spacing صحيح (ps-/pe-/ms-/me-)
□ كل أيقونة من @hugeicons فقط
□ لا inline styles
□ staleTime مضبوط على أي query جديدة
□ Feature جديدة مضافة في eslint.config.mjs → FEATURES
```

## Development

```bash
npm run dev          # Next.js dev server on :5103 (Turbopack)
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run test        # Vitest
npm run build        # Production build
```

## QA Gate

Dashboard e2e is manual via **Chrome DevTools MCP** — this is the required pre-merge check for any page change. Playwright was removed on 2026-04-16; tagged test reports are not the source of truth for dashboard UI.

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
  dictionaries, different purposes.
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

**Pre-PR checklist additions:**

```
□ npm run i18n:verify        # AR/EN parity
□ Tenant switcher still hides for the common single-org user
```
