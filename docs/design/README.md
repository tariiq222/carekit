# CareKit Design System & Specifications

This directory contains all UI/UX specifications, design guidelines, and component specs for CareKit.

## Document Index

| File | Description |
|------|-------------|
| `design-system.md` | Design tokens, typography, colors, spacing, White Label theming |
| `rtl-guidelines.md` | RTL-first layout rules, bidirectional component patterns |
| `accessibility.md` | WCAG AA compliance, a11y checklist per component |
| `mobile-screens-client.md` | 24 client screen specifications (mobile) |
| `mobile-screens-doctor.md` | 8 doctor screen specifications (mobile) |
| `dashboard-pages.md` | 16 admin dashboard page specifications |
| `component-specs.md` | Shared component specifications for all platforms |
| `white-label-theming.md` | White Label configuration and branding guide |
| `navigation-flows.md` | User flow diagrams and navigation architecture |

## Design Principles

1. **RTL-First** — Arabic is the primary language. Design starts in RTL, then adapts to LTR.
2. **White Label Ready** — Every visual element must be themeable per client.
3. **Accessibility** — WCAG AA minimum. Semantic HTML, keyboard nav, screen reader support.
4. **Mobile-First** — Mobile app is the primary client touchpoint.
5. **Consistency** — Shared design tokens across mobile, dashboard, and website.
6. **Bilingual** — Every screen must work in Arabic and English without layout breaks.

## Platform-Specific Libraries

| Platform | UI Library | Icons | Charts |
|----------|-----------|-------|--------|
| Mobile (Expo) | Custom components + React Native core | Lucide React Native | - |
| Dashboard (Next.js) | shadcn/ui | Lucide React | Recharts |
| Website | Custom per client | Per client | - |
