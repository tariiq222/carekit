# CareKit Dashboard — Next.js Admin

## Tech

Next.js 15 (App Router), React 19, TanStack Query v5, shadcn/ui, Tailwind 4, next-intl (AR/EN), Zod, React Hook Form.

## Layer Rules (strict — no exceptions)

```
app/(dashboard)/[feature]/page.tsx     ≤120 lines — orchestration only
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

`bookings/`, `patients/`, `practitioners/`, `payments/`, `reports/`,
`services/`, `branches/`, `coupons/`, `gift-cards/`, `chatbot/`,
`intake-forms/`, `invoices/`, `ratings/`, `notifications/`,
`activity-log/`, `problem-reports/`, `users/`, `settings/`,
`white-label/`, `zatca/`

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
| Page (app/) | 120 |
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
npm run dev          # :5001
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run build        # Production build
```
