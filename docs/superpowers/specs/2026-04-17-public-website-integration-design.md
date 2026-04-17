# Public Website Integration — Design Spec

**Date:** 2026-04-17
**Status:** Approved for planning
**Author:** Tariq + brainstorming session

## 1. Context

CareKit is a white-label clinic management platform (backend + dashboard + mobile). A standalone Arabic/RTL marketing website (`sawaa-website`) was designed externally as a Next.js 14 app with static data and no backend. It must be integrated into CareKit so that:

- Each clinic deployment includes a public-facing website.
- Website content is controlled from the dashboard (no code changes per clinic).
- Visitors can browse therapists/specialties, take the burnout test, contact the clinic, **and eventually book and pay online**.
- The work doubles as a test-bed for the backend APIs and shared business logic that the mobile app will later consume, significantly reducing mobile build time.

Single-organization mode holds: one deployment = one clinic. The website is part of that deployment, not a separate multi-tenant service.

## 2. Goals

- Deliver a conversion-driving public site per clinic (not just marketing).
- Re-use existing CareKit backend modules (bookings, payments, branding, employees, specialties) via new `/api/public/*` endpoints.
- Enable clinic owners to control visible content, theme, and branding from the dashboard.
- Establish a shared layer (`@carekit/api-client`, `@carekit/shared`) rich enough for the mobile app to consume directly later.
- Ship progressively in four phases — each phase production-releasable on its own.

## 3. Non-Goals

- Marketplace / multi-clinic directory. Each website serves exactly one clinic.
- Visual page builder or drag-and-drop editor.
- Unlimited custom themes. Exactly two themes for now: `sawaa` (current) and `premium` (new, premium/dark aesthetic).
- Full user-generated content (blog CMS, comments, reviews) — out of scope.
- Replacing the mobile app. Mobile remains the richest experience; website is the web equivalent.

## 4. Architecture

### 4.1 Monorepo placement

```
carekit/
├── apps/
│   ├── backend/
│   ├── dashboard/
│   ├── mobile/
│   └── website/      ← new
├── packages/
│   ├── api-client/   (extended)
│   └── shared/       (extended)
```

- Port: **5104** (reserved CareKit range 5000–5999).
- Stack: Next.js 15 App Router, React 19, Tailwind 4, shadcn/ui, next-intl, framer-motion.
- Deployed as a docker-compose service; Nginx routes the clinic's domain → website.

### 4.1.1 Vertical-slice structure (mirrors the backend)

The frontend follows the same vertical-slice discipline as `apps/backend`: each feature owns its full stack (UI, hooks, API calls, zod schemas, types, tests) in a single folder. There is no shared "services" or "hooks" bucket that every feature dips into.

```
apps/website/
├── app/                         # Next.js routes — thin; pick theme, delegate
│   └── <route>/page.tsx
├── features/                    # Vertical slices (one folder per feature)
│   ├── branding/
│   │   ├── branding-provider.tsx
│   │   ├── use-branding.ts
│   │   ├── branding.api.ts
│   │   ├── branding.types.ts
│   │   └── branding.test.ts
│   ├── therapists/
│   │   ├── therapists-list.tsx
│   │   ├── therapist-detail.tsx
│   │   ├── therapist-card.tsx
│   │   ├── use-therapists.ts
│   │   ├── therapists.api.ts
│   │   ├── therapists.schema.ts
│   │   ├── therapists.types.ts
│   │   └── therapists.test.ts
│   ├── specialties/
│   ├── contact/
│   ├── burnout-test/
│   ├── support-groups/
│   ├── booking/                 # phase 2
│   ├── otp/                     # phase 2
│   ├── payment/                 # phase 2
│   └── auth/                    # phase 3
├── themes/                      # Presentation-only; consumes features
│   ├── registry.ts
│   ├── types.ts
│   ├── sawaa/{pages,layout}/
│   └── premium/{pages,layout}/
├── components/ui/               # shadcn primitives only
├── lib/                         # tiny — api-client instance, i18n config, cn()
└── messages/{ar,en}.json
```

**Rules (enforced in code review):**

1. A feature is self-contained: components, hooks, API, schemas, types, and tests all live inside its folder.
2. Themes contain zero data fetching, validation, or business logic. A theme page calls a feature hook (e.g. `useTherapists()`) and renders the result.
3. `app/<route>/page.tsx` is a thin shell: it resolves the active theme from `branding` and renders the theme's page component. It does not know about APIs.
4. Cross-feature imports go through a feature's explicit `public.ts` export or through the API layer. No reaching into another feature's internals.
5. Logic that becomes useful to the mobile app (state machines, zod schemas, enums) is promoted to `@carekit/shared` the moment it has a second consumer.
6. 350-line cap per file (existing CareKit rule); split within the same feature, never by creating a sibling "utils" bucket.

### 4.2 Branding flow (dynamic, per clinic)

- `org-experience/branding` model holds `primaryColor`, `accentColor`, `backgroundColor`, `foregroundColor`, `logoUrl`, `brandName`, and a new field `activeWebsiteTheme: "sawaa" | "premium"`.
- Website root layout performs SSR fetch of `/public/branding` and injects values into `:root` as CSS custom properties (`--primary`, `--accent`, etc.).
- All components use semantic tokens only (no hex literals, no hardcoded Tailwind color utilities). This matches the existing CLAUDE.md rule.
- `next-themes` (light/dark) is **removed**. Dark variants, if needed later, will be handled through branding tokens, not a generic theme switcher.

### 4.3 Theme variants (layout/structure)

Two themes share the same data and logic but differ in visual structure.

- `themes/sawaa/` — current Sawaa design, warm/emotional, glass + gradients.
- `themes/premium/` — new dark/luxury spa-like design with full-bleed imagery, parallax, restrained micro-copy.
- A `Theme` TypeScript interface enforces completeness: every theme must export components for every page.
- Theme selection is read from `branding.activeWebsiteTheme` at SSR time. The dashboard exposes a dropdown for the clinic owner.
- Forms and stateful widgets (`BookingForm`, `ContactForm`, `BurnoutQuiz`) live inside their respective feature slices under `features/`, not under themes. shadcn primitives live under `components/ui/`. Themes compose these. Rule: **logic belongs to its feature, presentation belongs to the theme.**

### 4.4 Shared layer (critical for mobile reuse)

To make the website a true test-bed for mobile:

- **`@carekit/api-client`** — framework-agnostic fetch client. No React hooks, no Next-specific features. Extended to cover all `/public/*` endpoints, auth/OTP flows, and payment init.
- **`@carekit/shared`** — zod schemas (booking, contact, client registration), booking state machine, pricing rules, availability calendar logic, enums, types derived from Prisma.
- Both packages are consumed by `apps/website` immediately and by `apps/mobile` later without rewrites.

### 4.5 Public API surface

All under `/api/public/*`, throttled, CORS-restricted, no admin auth required.

| Endpoint | Phase |
|---|---|
| `GET /public/branding` | 1 |
| `GET /public/specialties` + `/:slug` | 1 |
| `GET /public/employees` + `/:slug` | 1 |
| `GET /public/support-groups` | 1 |
| `POST /public/contact-messages` | 1 |
| `POST /public/otp/request` (channel: email; SMS added later) | 2 |
| `POST /public/otp/verify` → session JWT | 2 |
| `GET /public/employees/:id/availability` | 2 |
| `POST /public/bookings` (guest, requires OTP session) | 2 |
| `POST /public/payments/init` + Moyasar webhook | 2 |
| `POST /public/auth/register|login|refresh|logout` | 3 |
| `GET /public/me/bookings` | 3 |
| `PATCH /public/bookings/:id/cancel|reschedule` | 3 |
| Subscriptions, support-group bookings, ZATCA QR, refunds | 4 |

### 4.6 Security

- `@nestjs/throttler` per-endpoint limits: 10/min browse, 3/min OTP request, 1/min booking create.
- hCaptcha on contact form and OTP request (phase 1+).
- OTP → short-lived session JWT (30 min) used only for guest booking + payment init.
- Moyasar webhook handler (existing in `payments/` module) extended to reconcile guest-bookings.
- CORS allowlist restricted to the clinic's configured website domain.
- No PII returned from public endpoints beyond what the clinic explicitly marked as public (`employee.isPublic`, `employee.publicBio`, etc.).

## 5. Prisma Schema Changes

- `Branding.activeWebsiteTheme` (enum: `sawaa | premium`) — phase 1.
- `Branding.websiteDomain` (string, unique) — phase 1. The clinic-owned domain hosting the public site; drives CORS, canonical URLs, sitemap, and email link generation.
- `Employee`: `slug` (unique), `isPublic` (bool), `publicBio` (text), `publicImage` (string) — phase 1.
- `Specialty`: `slug` (unique), `isPublic`, `publicDescription`, `publicImage` — phase 1.
- `ContactMessage` model: id, orgId, name, phone, email, subject, body, createdAt, status — phase 1.
- `Client.phoneVerified`, `Client.emailVerified` — phase 2.
- `OtpCode` model: `channel` (enum: `email | sms`), `identifier` (email or phone), `codeHash`, `purpose`, `expiresAt`, `consumedAt`, `attempts` — phase 2. Designed channel-agnostic so SMS adds a row type, not a schema change.
- All migrations additive and immutable per CareKit rules.

## 6. Phased Delivery

### Phase 1 — Foundation + Marketing (2–3 weeks)

**Ship criteria:** site online, branding + theme switching work, therapists/specialties pulled from backend, contact form writes to backend, both themes render all pages.

- Scaffold `apps/website` with Next.js 15, Tailwind 4, next-intl, shadcn/ui.
- Migrate current Sawaa pages into `themes/sawaa/*`, converting all hardcoded colors to semantic tokens.
- Design and build `themes/premium/*` (a separate visual-design subtask precedes this).
- Extend `@carekit/api-client` with phase-1 endpoints.
- Implement `BrandingProvider` (SSR token injection).
- Add phase-1 Prisma migrations + public controllers.
- Dashboard: "Website" settings page — theme selector, per-employee `isPublic` toggle + public bio editor, per-specialty public fields, contact-messages inbox.
- Docker service + Nginx routing.
- QA via Chrome DevTools MCP; sync to Kiwi TCMS under `Product=CareKit, Category=Website, Plan=Manual QA`.

### Phase 2 — Guest Booking + Payment (2–3 weeks)

**Ship criteria:** a visitor can complete a real paid booking end-to-end that appears in the dashboard immediately.

- `OtpCode` migration + OTP request/verify endpoints. **Email channel only in phase 2** using the existing `email/` module (SMTP). A `NotificationChannel` abstraction wraps the sender so that adding SMS later is one new adapter, not a refactor.
- Availability endpoint (re-uses existing booking conflict logic).
- Guest booking endpoint (creates `Client` on demand, links booking).
- Moyasar integration: payment init + 3DS + webhook reconciliation.
- Booking wizard pages in both themes: service → therapist → time → info+OTP → payment → confirmation.
- Dashboard: "Guest Bookings" filter, optional manual confirmation workflow.
- E2E Kiwi plan + QA gate.

### Phase 3 — Client Accounts (2 weeks)

**Ship criteria:** returning clients can log in, view history, reschedule/cancel bookings, and guest-booking records are linkable by phone number on signup.

- Auth endpoints (register, login, refresh, logout) + session cookies.
- `/account`, `/account/bookings`, `/account/profile` pages in both themes.
- Reschedule/cancel respecting clinic policies (existing booking rules).
- Migrate phone-linked guest bookings into the new account on signup.

### Phase 4 — Advanced (2 weeks)

- Subscription packages (existing backend support).
- Support-group bookings (group capacity, waitlist).
- ZATCA QR code on invoices (existing module).
- Refund flow.
- SEO polish: Schema.org `BookAction` / `MedicalBusiness`, dynamic sitemap, OG images, JSON-LD per therapist.

## 7. Testing Strategy

- **Unit:** zod schemas, state machines, and API-client methods in `packages/shared` and `packages/api-client` via Vitest. Reported to Kiwi under `Category=Website, Plan=Unit`.
- **Integration (backend):** public controllers via Jest E2E against a real Postgres. Reported under `Plan=E2E`.
- **Manual QA (dashboard + website):** Chrome DevTools MCP walkthrough per release, report saved to `docs/superpowers/qa/website-<phase>-<date>.md`, synced to Kiwi under `Plan=Manual QA` via `scripts/kiwi-sync-manual-qa.mjs`.
- **Security:** rate-limit tests, OTP abuse tests, captcha bypass attempts in E2E.

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Public booking endpoint becomes spam target | Throttling + OTP + captcha + bot detection on webhook patterns |
| Moyasar webhook race with booking creation | Existing idempotency key pattern in `payments/`; extend to guest path |
| Divergence between website and mobile flows | Force all non-visual logic into `packages/shared`; mobile and website import identical schemas and state machines |
| Two themes doubling maintenance cost | Strict rule: shared logic + shadcn primitives. Themes only override layout and visual chrome |
| Premium theme ships before design is ready | Treat premium theme design as a gated sub-task with its own visual spec before phase-1 implementation begins |
| SEO impact of client-side heavy flows | Booking wizard + marketing pages stay SSR; only after-booking dashboards are client-rendered |

## 9. Decisions

- **OTP channel (phase 2): email only.** Uses the existing `email/` (SMTP) module. SMS providers will be added later as a pluggable `NotificationChannel` adapter — the `OtpCode` model carries a `channel` column from day one to avoid a future migration.
- **Domain model: each clinic brings its own domain.** CareKit does not own or assign subdomains. Deployment provisions Nginx + TLS (Let's Encrypt or provided cert) per clinic domain. A `Branding.websiteDomain` field stores the authoritative domain for CORS allowlisting, canonical URLs, sitemap, and email links.
- **Default language: Arabic (RTL).** The site always renders in Arabic on first visit regardless of browser locale. English translation is available via a visible language switcher; the choice is persisted in a cookie and respected on subsequent visits. `next-intl` drives both locales; every string lives in `messages/ar.json` and `messages/en.json`. No auto-detect — Arabic is the product's primary voice.

## 10. Out of Scope (for this spec)

- Detailed visual design of the `premium` theme — separate design spec.
- Content strategy, copywriting, SEO keywords — owner-provided.
- Marketing analytics / pixel tracking — future enhancement.
