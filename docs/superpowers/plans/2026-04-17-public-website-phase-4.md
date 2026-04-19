# Public Website — Phase 4 (Advanced: Support Groups + ZATCA QR + Refunds + SEO) Implementation Plan

> **⚠️ Plan status:** Most speculative of the four plans — written before Phases 1.5, 2, 3 land. Scope is large; expect to split Phase 4 into 4.b (ZATCA + Refunds) and 4.c (SEO) based on business priority when the time comes.
>
> **🛑 Track A (Subscriptions) REMOVED from scope (2026-04-19).** CareKit is strictly a booking platform — appointment booking + recurring bookings + future session packages (service bundles). Subscription plans were never the product. The code that landed via Phase 4 Track A was removed in `chore/remove-subscription-feature` (PR #13). Tasks A1–A5, Q1, and any §5/§6 references below should be treated as historical context, not work items. When a "packages" requirement arrives, model it as a service-level bundle attached to `Service`, not as a resurrected Subscription system.

**Goal:** Ship the advanced capabilities that turn the public website from a booking tool into a full client-facing commerce + compliance surface: subscription packages, support-group bookings, ZATCA QR on invoices, refund flow, and SEO infrastructure (Schema.org, sitemap, OG images, JSON-LD).

**Architecture:** Each feature is an existing-module extension:
- **Subscriptions** → existing `subscriptions/` backend module + new public endpoints + website pages
- **Support groups** → existing `group-sessions/` module + public listing/booking
- **ZATCA QR** → existing `zatca/` module + rendering on client-facing invoice view
- **Refunds** → existing `payments/` module + Moyasar refund API + client-facing status
- **SEO** → frontend-only, no backend changes

**Reference Spec:** [`docs/superpowers/specs/2026-04-17-public-website-integration-design.md`](../specs/2026-04-17-public-website-integration-design.md) §6 Phase 4.

**Branch:** `feat/website-phase-4` from `main` after Phase 3 merges. Given size, consider splitting into three sub-branches: `feat/website-phase-4a-subscriptions`, `-4b-zatca-refunds`, `-4c-seo`.

---

## Track A — Subscriptions (5 tasks)

### Task A1: Verify existing subscriptions module + extend schema if needed

- [ ] **A1.1** Read `apps/backend/src/modules/subscriptions/` and `prisma/schema/*.prisma` (wherever `Subscription` lives).
- [ ] **A1.2** Confirm existing admin flow for creating subscription packages (plan templates) + assigning to clients.
- [ ] **A1.3** Identify schema gaps for public surface: is there a `Subscription.isPublic` flag? `Subscription.publicDescriptionAr/En`? Add if missing (additive migration).
- [ ] **A1.4** Commit: `feat(backend): subscription public fields` (if migration needed)

### Task A2: Backend — `GET /public/subscriptions` + `POST /public/subscriptions/purchase`

- [ ] **A2.1** `ListPublicSubscriptions`: filter `isPublic = true`; returns plan summaries + pricing.
- [ ] **A2.2** `PurchaseSubscription` (guest/client): creates invoice + initializes Moyasar payment, similar to Phase 2 booking flow. OTP or client session required.
- [ ] **A2.3** Moyasar webhook extension: on success, activate subscription + apply its benefits (discount, session credits).
- [ ] **A2.4** Controller under `/api/v1/public/subscriptions`. Throttled.
- [ ] **A2.5** Specs + OpenAPI.
- [ ] **A2.6** Commit: `feat(backend): public subscription listing + purchase`

### Task A3: api-client — Subscription endpoints

- [ ] **A3.1** `getPublicSubscriptions`, `purchaseSubscription`, `getMySubscriptions` (client-authed).
- [ ] **A3.2** Commit: `feat(api-client): subscription endpoints`

### Task A4: Website — features/subscriptions slice + pages

- [ ] **A4.1** Slice files + both theme pages (`/subscriptions`, `/subscriptions/[slug]`).
- [ ] **A4.2** Purchase wizard reuses OTP + payment flow from Phase 2.
- [ ] **A4.3** `/account/subscriptions` in both themes (list + status).
- [ ] **A4.4** Commit: `feat(website): subscriptions listing + purchase`

### Task A5: Dashboard — Subscription public toggle

- [ ] **A5.1** Add "Public" toggle + `publicDescriptionAr/En` fields to existing subscription edit page.
- [ ] **A5.2** Commit: `feat(dashboard): subscription public fields editor`

---

## Track B — Support Groups (4 tasks)

### Task B1: Verify existing group-sessions module + public extension

- [ ] **B1.1** Read `apps/backend/src/modules/group-sessions/` (or wherever groups live).
- [ ] **B1.2** Identify public-facing gaps: `GroupSession.isPublic`, `GroupSession.waitlistEnabled`, `GroupSession.publicDescriptionAr/En`.
- [ ] **B1.3** Migration if needed.
- [ ] **B1.4** Commit: `feat(backend): group-session public fields` (if needed)

### Task B2: Backend — Public group listing + booking

- [ ] **B2.1** `ListPublicGroups`, `GetPublicGroup`, `BookGroupSession` (with capacity check + waitlist fallback).
- [ ] **B2.2** Reuse OTP session + payment flow.
- [ ] **B2.3** Handle waitlist: if capacity full, write WaitlistEntry; promote automatically if a booking is cancelled.
- [ ] **B2.4** Specs.
- [ ] **B2.5** Commit: `feat(backend): public group bookings + waitlist`

### Task B3: Website — features/support-groups slice

- [ ] **B3.1** Slice + pages `/support-groups`, `/support-groups/[id]`.
- [ ] **B3.2** Booking CTA: if capacity available → normal flow; if full → "Join waitlist" flow.
- [ ] **B3.3** `/account/groups` shows upcoming group bookings + waitlist position.
- [ ] **B3.4** Commit: `feat(website): support groups listing + booking`

### Task B4: Dashboard — Group public toggle + waitlist management

- [ ] **B4.1** "Public" toggle on group edit page.
- [ ] **B4.2** Waitlist view (ordered list + manual promote button).
- [ ] **B4.3** Commit: `feat(dashboard): group public + waitlist management`

---

## Track C — ZATCA QR on client-facing invoices (2 tasks)

### Task C1: Backend — expose invoice QR in public invoice endpoint

- [ ] **C1.1** Ensure existing ZATCA module computes QR for every issued invoice.
- [ ] **C1.2** Add `GET /api/v1/public/invoices/:id` (guarded by booking ownership via client session OR by a signed token passed in confirmation email).
- [ ] **C1.3** Response includes `qrCode` (base64 PNG or data URL) + invoice details.
- [ ] **C1.4** Specs.
- [ ] **C1.5** Commit: `feat(backend): public invoice endpoint with ZATCA QR`

### Task C2: Website — Invoice view

- [ ] **C2.1** `/account/bookings/[id]/invoice` renders invoice + QR prominently.
- [ ] **C2.2** Printable view (CSS `@media print`).
- [ ] **C2.3** Download-as-PDF via Next.js API route (puppeteer or `@react-pdf/renderer`).
- [ ] **C2.4** Commit: `feat(website): client-facing invoice with ZATCA QR`

---

## Track D — Refunds (3 tasks)

### Task D1: Backend — Refund request + execution

- [ ] **D1.1** `RequestRefundHandler` (client-triggered): creates `RefundRequest` row, status `PENDING_REVIEW`.
- [ ] **D1.2** `ApproveRefundHandler` (admin): calls Moyasar refund API, updates invoice + booking statuses.
- [ ] **D1.3** Auto-refund path: cancellations within the configured window set `RefundRequest.autoApproved=true` and refund processes immediately.
- [ ] **D1.4** Moyasar webhook handles refund completion; invoice status `REFUNDED`.
- [ ] **D1.5** Commit: `feat(backend): refund request + execution`

### Task D2: api-client + Website — Refund visibility

- [ ] **D2.1** `requestRefund`, `getMyRefunds` client-authed endpoints.
- [ ] **D2.2** `/account/refunds` page: list of refunds with status + reason.
- [ ] **D2.3** Commit: `feat(website): client refund requests + status`

### Task D3: Dashboard — Refund approval queue

- [ ] **D3.1** New route `/refunds` with pending / approved / denied tabs.
- [ ] **D3.2** Approve / deny actions.
- [ ] **D3.3** Commit: `feat(dashboard): refund approval queue`

---

## Track E — SEO (5 tasks)

### Task E1: Schema.org JSON-LD

- [ ] **E1.1** `MedicalBusiness` schema on site home page (both themes).
- [ ] **E1.2** `BookAction` schema on therapist detail pages.
- [ ] **E1.3** `Organization` schema on `/about` or site-wide metadata.
- [ ] **E1.4** `Service` schema on service pages (if services have public pages).
- [ ] **E1.5** Commit: `feat(website): Schema.org JSON-LD`

### Task E2: Dynamic sitemap.xml + robots.txt

- [ ] **E2.1** `apps/website/app/sitemap.ts` — lists all therapists, specialties, subscriptions (public only).
- [ ] **E2.2** `apps/website/app/robots.ts` — allow all, point to sitemap, disallow `/account/*`.
- [ ] **E2.3** Uses `BrandingConfig.websiteDomain` for canonical URLs.
- [ ] **E2.4** Commit: `feat(website): sitemap + robots`

### Task E3: OG images (per therapist + specialty)

- [ ] **E3.1** `apps/website/app/therapists/[slug]/opengraph-image.tsx` (Next.js convention) — generates OG image dynamically from branding + therapist data.
- [ ] **E3.2** Same for `/specialties/[slug]`.
- [ ] **E3.3** Fallback site-wide OG image on root layout.
- [ ] **E3.4** Commit: `feat(website): dynamic OG images per therapist/specialty`

### Task E4: Metadata enrichment

- [ ] **E4.1** Each page sets `<title>`, `<meta description>`, canonical URL, og:*, twitter:card.
- [ ] **E4.2** next-intl hreflang alternates.
- [ ] **E4.3** Commit: `feat(website): comprehensive page metadata`

### Task E5: Performance polish for SEO

- [ ] **E5.1** Audit with `next build --profile` + Lighthouse.
- [ ] **E5.2** Fix top 3 Lighthouse issues (likely: image optimization, font preload, unused JS).
- [ ] **E5.3** Core Web Vitals: LCP < 2.5s, CLS < 0.1, INP < 200ms on a median mobile device.
- [ ] **E5.4** Commit: `perf(website): Core Web Vitals + SEO Lighthouse fixes`

---

## QA gate Phase 4 + Kiwi sync

**Cases (one per track):**

- [ ] **Q1** Subscription: browse plans → purchase → subscription active in `/account/subscriptions`.
- [ ] **Q2** Support group: book a session → appears in account → cancel → refund request PENDING.
- [ ] **Q3** Support group: book when full → placed on waitlist → admin promotes → booking confirmed.
- [ ] **Q4** ZATCA: visit `/account/bookings/[id]/invoice` → QR visible → download PDF → QR scannable.
- [ ] **Q5** Refund: cancel within window → auto-approved → Moyasar refund executes → status REFUNDED.
- [ ] **Q6** Refund: cancel outside window → PENDING_REVIEW → admin approves → executes.
- [ ] **Q7** SEO: view page source on home → JSON-LD present → `/sitemap.xml` lists public therapists.
- [ ] **Q8** OG image: share therapist URL on WhatsApp → preview shows custom OG image.
- [ ] **Q9** Branding invariance still holds end-to-end.
- [ ] **Q10** Kiwi sync + commit report.

---

## Ship criteria (from spec §6 Phase 4)

- ✅ Subscriptions purchasable publicly.
- ✅ Support groups bookable publicly with capacity + waitlist.
- ✅ ZATCA QR renders on client invoice views.
- ✅ Refund flow end-to-end.
- ✅ SEO: Schema.org, sitemap, OG images, Core Web Vitals pass.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Subscription + booking state machine conflicts (benefit application) | Unit tests in `@carekit/shared` covering every benefit-application case |
| Group waitlist race (two users grab last spot) | DB transaction + row-level lock on `GroupSession.enrolledCount` |
| ZATCA QR renders wrong data after invoice edit | Regenerate QR on every invoice state transition; snapshot test on QR payload |
| Moyasar refund partial / failure | Webhook-driven; never mark refunded until webhook confirms |
| SEO regressions (page becomes client-rendered by accident) | CI Lighthouse check on PR; fail if CWV regresses |

---

## What's NOT in Phase 4

- Analytics integration (GA4, Meta Pixel, etc.) — future tracked separately with privacy/consent layer.
- Multi-currency (all SAR per current scope).
- Admin-side subscription analytics dashboards — admin sees transactions, full analytics is post-Phase-4.
- Loyalty / referral programs.
- Native mobile app features parity — separate track.

---

## Post-Phase 4 — open questions for follow-up planning

- Do we consolidate the four sub-branches into one Phase 4 PR, or ship as 3 PRs (A+B, C+D, E)? Recommendation: **3 PRs** — each is a shippable increment, reviewers can focus.
- Do we add a `v1.0` Git tag on main after Phase 4 merges? Recommendation: **yes** — first production-ready milestone.
- Does the product need a public changelog at this point? Probably yes — add a minimal `CHANGELOG.md` during Phase 4.c SEO track.
