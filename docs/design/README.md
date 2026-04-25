# CareKit Design Specifications

Surviving design references for CareKit. The visual language (tokens, typography, components) lives in code; this directory documents flows and screen-level specs that are too narrative for inline JSDoc.

## Document Index

| File | Description |
|------|-------------|
| `rtl-guidelines.md` | RTL-first layout rules, bidirectional component patterns |
| `accessibility.md` | WCAG 2.1 AAA target, a11y checklist per component |
| `mobile-screens-patient.md` | Client-app screen specifications (Expo `(client)` route group) |
| `mobile-screens-employee.md` | Employee-app screen specifications (Expo `(employee)` route group) |
| `navigation-flows.md` | User-flow diagrams for mobile + dashboard |

## Where the design system actually lives

- **Design language / brand personality** — root `CLAUDE.md` § "Design Context" is the source of truth (Royal Blue + Lime Green, glassmorphism, IBM Plex Sans Arabic, 8px grid, semantic tokens only).
- **Primitives** — `packages/ui/` (`@carekit/ui`) ships the cross-app primitives consumed by both `apps/dashboard` and `apps/mobile`. shadcn-style components live in `apps/dashboard/components/ui/` for dashboard-only pieces.
- **Tokens / theming** — CSS custom properties driven by the per-clinic `BrandingConfig` (backend `org-experience/branding/`). Never hardcode hex colors; consume `--primary`, `--accent`, etc.
- **Page anatomy** — root `CLAUDE.md` § "Page Anatomy — The Law" defines the dashboard list-page structure (PageHeader → StatsGrid → FilterBar → DataTable).

## Design Principles

1. **RTL-first** — Arabic is primary; designs start in RTL and adapt to LTR.
2. **White-label ready** — every visual element themeable per clinic via `BrandingConfig`.
3. **Accessibility** — WCAG 2.1 AAA target. Semantic markup, keyboard nav, screen-reader support.
4. **Mobile + dashboard parity** — shared primitives, shared semantic tokens.
5. **Bilingual** — every screen works in Arabic and English without layout breaks.

## Platform-Specific Libraries

| Platform | UI Library | Icons | Charts |
|----------|-----------|-------|--------|
| Mobile (Expo) | `@carekit/ui` + React Native core | Lucide React Native | — |
| Dashboard (Next.js) | `@carekit/ui` + shadcn/ui (`components/ui/`) | Lucide React | Recharts |
