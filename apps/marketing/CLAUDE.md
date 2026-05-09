# apps/marketing — Deqah Marketing Site

Next.js 15 (App Router) + React 19 + Tailwind 4 + next-intl. Deqah's own
public marketing/landing site. Dev: `pnpm dev:marketing` on port 5106.

## Purpose

The Deqah-brand marketing presence (NOT a tenant site). Showcases the SaaS
product to prospective clinics. Tenant-facing public sites live under
`apps/bespoke/<tenant>/website/` (e.g. `apps/bespoke/sawa/website`).

## Hard rules

1. **Deqah brand colors only.** Royal Blue `#354FD8` + Lime Green `#82CC17`.
   This site does NOT load `BrandingConfig` and does NOT use the per-tenant
   token system — it speaks for Deqah, not for any clinic.
2. **No backend tenant context.** No `X-Organization-Id`, no JWT, no
   authenticated routes. If a flow needs a logged-in user it belongs in
   `apps/dashboard` or `apps/admin`.
3. **Bilingual (AR/EN) via next-intl.** Locale-prefixed routes under
   `app/[locale]/`. Arabic is RTL — use logical properties (`ps-`/`pe-`,
   `ms-`/`me-`), never hardcoded `left`/`right`.
4. **Reuse `@deqah/ui` primitives.** Do not fork Button/Card/Dialog locally.
   Marketing-specific compositions go under `components/sections/`.
5. **Static-first.** Prefer static rendering and ISR. No client-side data
   fetching unless the section genuinely needs it.

## Structure

```
app/[locale]/      # Locale-prefixed pages
components/
├── nav.tsx        # Top navigation
└── sections/      # Page-level marketing sections
i18n/              # next-intl config
messages/          # ar.json + en.json
```

## Commands

```bash
pnpm dev:marketing      # from repo root, port 5106
pnpm --filter @deqah/marketing build
pnpm --filter @deqah/marketing typecheck
pnpm --filter @deqah/marketing lint
```
