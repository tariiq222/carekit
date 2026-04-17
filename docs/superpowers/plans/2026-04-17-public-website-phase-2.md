# Public Website — Phase 2 (Guest Booking + Payment) Implementation Plan

> **⚠️ Plan status:** Draft written against the spec before Phase 1.5 lands. Re-verify assumptions about Client schema, booking conflict logic, and payments module shape **after Phase 1.5 merges** and before starting Phase 2 tasks. Treat this as scaffolding — tasks may split or merge based on what Phase 1.5 reveals.

**Goal:** A visitor can complete a real paid booking end-to-end on the public website. Guest identifies via OTP (email), picks service + therapist + slot, pays via Moyasar with 3DS, gets a confirmation. The booking appears in the dashboard immediately, invoiced and paid.

**Architecture:** Three new backend modules — OTP, availability, guest bookings — plus extensions to the existing payments module for the guest path. Website grows a 5-step booking wizard shared by both themes. State machine in `@carekit/shared` makes the wizard mobile-portable later. All logic public-facing goes through `/api/v1/public/*` throttled, captcha-protected, OTP-session-gated for write operations.

**Tech Stack:** Same as Phases 1/1.5 plus: `xstate` (optional, for the booking state machine) or a simple reducer; `@nestjs/throttler` per endpoint; Moyasar SDK (hosted payment page via iframe + webhook).

**Reference Spec:** [`docs/superpowers/specs/2026-04-17-public-website-integration-design.md`](../specs/2026-04-17-public-website-integration-design.md) §6 Phase 2.

**Branch:** `feat/website-phase-2` from `main` after 1.5 merges.

---

## Task 0: Prep

- [ ] **0.1** Phase 1.5 merged to main; pull.
- [ ] **0.2** `git checkout -b feat/website-phase-2`.
- [ ] **0.3** Read current `apps/backend/src/modules/bookings/` and `payments/` to confirm the booking creation + Moyasar flow exists for admin path.
- [ ] **0.4** Read `apps/backend/src/modules/email/` — confirm SMTP sender exists (SMTP is the OTP channel in Phase 2).
- [ ] **0.5** Obtain Moyasar sandbox keys + hCaptcha site/secret keys; document in `.env.example`.

---

## Task 1: Prisma — OtpCode model + Client verification flags

**Files:**
- Modify: `apps/backend/prisma/schema/identity.prisma` (or `comms.prisma`)
- Create: migration

- [ ] **1.1** Add enum + model:
  ```prisma
  enum OtpChannel {
    EMAIL
    SMS
  }

  enum OtpPurpose {
    GUEST_BOOKING
    CLIENT_LOGIN
  }

  model OtpCode {
    id          String     @id @default(uuid())
    channel     OtpChannel
    identifier  String     // email address or phone in E.164
    codeHash    String
    purpose     OtpPurpose
    expiresAt   DateTime
    consumedAt  DateTime?
    attempts    Int        @default(0)
    createdAt   DateTime   @default(now())

    @@index([identifier, purpose])
    @@index([expiresAt])
  }
  ```
- [ ] **1.2** Add to Client: `emailVerified DateTime?`, `phoneVerified DateTime?`.
- [ ] **1.3** Migration + tests.
- [ ] **1.4** Commit: `feat(backend): add OtpCode model + client verification fields`

---

## Task 2: Backend — NotificationChannel abstraction

**Purpose:** abstract the OTP sender so adding SMS later is one new adapter, not a refactor through OTP handlers.

**Files:**
- Create: `apps/backend/src/modules/comms/notification-channel/notification-channel.ts` (interface)
- Create: `apps/backend/src/modules/comms/notification-channel/email-channel.adapter.ts`
- Create: `apps/backend/src/modules/comms/notification-channel/notification-channel.module.ts`

- [ ] **2.1** Interface:
  ```ts
  export interface NotificationChannel {
    kind: OtpChannel;
    send(identifier: string, message: string): Promise<void>;
  }
  ```
- [ ] **2.2** `EmailChannelAdapter` wraps existing email module; implements interface.
- [ ] **2.3** A `NotificationChannelRegistry` resolves a channel by kind.
- [ ] **2.4** Specs.
- [ ] **2.5** Commit: `feat(backend): NotificationChannel abstraction (email adapter)`

---

## Task 3: Backend — OTP request handler + controller

**Files:**
- Create: `modules/identity/otp/request-otp.dto.ts`
- Create: `modules/identity/otp/request-otp.handler.ts` (+ spec)
- Create: `api/public/otp.controller.ts` (+ spec)

- [ ] **3.1** DTO: `channel` (EMAIL for Phase 2), `identifier`, `purpose`, `hCaptchaToken`.
- [ ] **3.2** Handler:
  - Verify hCaptcha
  - Generate 6-digit code, hash (bcrypt)
  - Persist with 10-min expiry
  - Invalidate previous un-consumed codes for same (identifier, purpose)
  - Send via `NotificationChannelRegistry.resolve(channel).send(...)`
  - Return success (no code leaked in response)
- [ ] **3.3** Controller: `POST /api/v1/public/otp/request`. Throttle 3/min per IP + 5/hour per identifier.
- [ ] **3.4** Specs: happy path, captcha fail, throttle, channel unknown.
- [ ] **3.5** Commit: `feat(backend): POST /public/otp/request`

---

## Task 4: Backend — OTP verify handler + session JWT

**Files:**
- Create: `modules/identity/otp/verify-otp.dto.ts`
- Create: `modules/identity/otp/verify-otp.handler.ts` (+ spec)
- Modify: `api/public/otp.controller.ts`
- Create: `modules/identity/otp/otp-session.service.ts` (JWT signer)

- [ ] **4.1** DTO: `channel`, `identifier`, `code`, `purpose`.
- [ ] **4.2** Handler:
  - Look up active un-consumed code for (identifier, purpose)
  - Increment `attempts`; reject if ≥5
  - bcrypt compare
  - Mark `consumedAt`
  - Set `client.emailVerified` / `client.phoneVerified` if client exists
  - Sign short-lived JWT (30 min) with claims `{ identifier, purpose }`
- [ ] **4.3** Controller: `POST /api/v1/public/otp/verify`. Throttle 5/min.
- [ ] **4.4** Specs: happy, wrong code, expired, too many attempts.
- [ ] **4.5** Commit: `feat(backend): POST /public/otp/verify returns session JWT`

---

## Task 5: Backend — Public availability endpoint

**Files:**
- Create: `modules/bookings/availability/public/get-public-availability.handler.ts` (+ spec)
- Create: `api/public/availability.controller.ts` (+ spec)

- [ ] **5.1** Reuse existing booking-conflict logic (the admin-side scheduler). Wrap in a handler that returns available slots for `(employeeId, date, serviceId)`.
- [ ] **5.2** Response: array of `{ start, end }` ISO strings.
- [ ] **5.3** Respects employee working hours, vacations, existing bookings, service buffer + lead time.
- [ ] **5.4** Controller: `GET /api/v1/public/employees/:id/availability?date=YYYY-MM-DD&serviceId=...`. Throttle 30/min.
- [ ] **5.5** Specs.
- [ ] **5.6** Commit: `feat(backend): GET /public/employees/:id/availability`

---

## Task 6: Backend — Guest booking handler + controller

**Files:**
- Create: `modules/bookings/public/create-guest-booking.dto.ts`
- Create: `modules/bookings/public/create-guest-booking.handler.ts` (+ spec)
- Create: `api/public/bookings.controller.ts` (+ spec)
- Create: `modules/identity/otp/otp-session.guard.ts` (NestJS guard)

- [ ] **6.1** `OtpSessionGuard`: verifies Bearer JWT from Task 4 + matches `purpose === GUEST_BOOKING` + identifier matches payload.
- [ ] **6.2** DTO: `serviceId`, `employeeId`, `branchId`, `startsAt`, `client: { name, phone, email, gender?, notes? }`.
- [ ] **6.3** Handler:
  - Verify OTP session JWT
  - Upsert `Client` by phone (or email) — link if exists, create otherwise with `emailVerified`/`phoneVerified` set from the OTP
  - Create booking with status `AWAITING_PAYMENT`
  - Create invoice (existing invoice creation pipeline)
  - Return `{ bookingId, invoiceId, totalHalalat }`
- [ ] **6.4** Controller: `POST /api/v1/public/bookings`. Throttle 1/min per IP.
- [ ] **6.5** Specs: happy, slot taken, invalid OTP session, phone-linked existing client.
- [ ] **6.6** Commit: `feat(backend): POST /public/bookings (guest)`

---

## Task 7: Backend — Public payment init + Moyasar

**Files:**
- Create: `modules/finance/payments/public/init-guest-payment.handler.ts` (+ spec)
- Modify: existing Moyasar webhook handler (guest path reconciliation)
- Create: `api/public/payments.controller.ts` (+ spec)

- [ ] **7.1** `initGuestPayment`: accepts `invoiceId`, validates status, calls Moyasar API to create an invoice, returns `{ paymentUrl, paymentId }` for the 3DS/hosted page.
- [ ] **7.2** Idempotency key pattern — reuse existing `payments` module.
- [ ] **7.3** Webhook extension: when payment succeeds, transition booking from `AWAITING_PAYMENT` → `CONFIRMED`; invoice from `UNPAID` → `PAID`; emit notification.
- [ ] **7.4** Controller: `POST /api/v1/public/payments/init`. Throttle 5/min.
- [ ] **7.5** Specs: init success, webhook success, webhook replay, webhook for unknown payment (ignored safely).
- [ ] **7.6** Commit: `feat(backend): guest payment init + Moyasar webhook reconciliation`

---

## Task 8: api-client — OTP + booking + payment endpoints

**Files:**
- Create: `packages/api-client/src/modules/otp.ts`
- Modify: `packages/api-client/src/modules/bookings.ts` (add guest path)
- Create: `packages/api-client/src/modules/payments.ts` (or extend existing)

- [ ] **8.1** `requestOtp({ channel, identifier, purpose, hCaptchaToken })`.
- [ ] **8.2** `verifyOtp({ channel, identifier, code, purpose })` → returns session JWT.
- [ ] **8.3** `getPublicAvailability(employeeId, date, serviceId)`.
- [ ] **8.4** `createGuestBooking(payload, sessionToken)` — attaches Bearer header.
- [ ] **8.5** `initGuestPayment({ invoiceId }, sessionToken)`.
- [ ] **8.6** Types in `@carekit/shared`.
- [ ] **8.7** Vitest mocks.
- [ ] **8.8** Commit: `feat(api-client): guest booking + OTP + payment endpoints`

---

## Task 9: shared — Booking state machine

**Files:**
- Create: `packages/shared/state-machines/booking-wizard.ts`
- Create: `packages/shared/state-machines/booking-wizard.test.ts`

**States:** `service → therapist → slot → info-otp → payment → confirmation`
**Events:** `SELECT_SERVICE`, `SELECT_EMPLOYEE`, `SELECT_SLOT`, `SUBMIT_INFO`, `VERIFY_OTP`, `INIT_PAYMENT`, `PAYMENT_SUCCESS`, `PAYMENT_FAIL`, `RESET`

- [ ] **9.1** Implement as pure TS reducer (`type State`, `type Event`, `reduce(state, event): State`) — no framework dependency.
- [ ] **9.2** Unit tests cover every transition + invalid transitions (should be no-ops).
- [ ] **9.3** Exported from `@carekit/shared`.
- [ ] **9.4** Commit: `feat(shared): booking wizard state machine`

---

## Task 10: Website — features/booking slice

**Files under `apps/website/features/booking/`:**
- `booking.api.ts`, `booking.types.ts`
- `use-booking-wizard.ts` (wraps the shared state machine with React state)
- `service-picker.tsx`, `therapist-picker.tsx`, `slot-picker.tsx`, `booking-summary.tsx`
- `public.ts`, `booking.test.tsx`

- [ ] **10.1** `use-booking-wizard` calls `useReducer(reduce, initialState)` and exposes `state, dispatch`.
- [ ] **10.2** Sub-components read state and dispatch events.
- [ ] **10.3** Tests: full happy path driven by events.
- [ ] **10.4** Commit: `feat(website): booking wizard feature slice`

---

## Task 11: Website — features/otp slice

**Files under `apps/website/features/otp/`:**
- `otp.api.ts`, `otp.schema.ts`
- `otp-request-form.tsx`, `otp-verify-form.tsx`
- `use-otp-session.ts` (stores + returns the session JWT, in memory only — not localStorage)
- `public.ts`, `otp.test.tsx`

- [ ] **11.1** Session JWT lives in React state only — cleared on refresh. Prevents session hijacking via stolen localStorage.
- [ ] **11.2** hCaptcha integration on request form.
- [ ] **11.3** Tests.
- [ ] **11.4** Commit: `feat(website): OTP request + verify`

---

## Task 12: Website — features/payment slice

**Files under `apps/website/features/payment/`:**
- `payment.api.ts`
- `payment-redirect.tsx` (receives payment URL, renders iframe or does top-level redirect)
- `public.ts`, `payment.test.tsx`

- [ ] **12.1** Moyasar hosted payment page — use top-level redirect (safer than iframe for 3DS).
- [ ] **12.2** Return URL param `?payment_status=paid|failed` drives the confirmation step.
- [ ] **12.3** Poll `GET /invoices/:id` (public endpoint, add if missing) to confirm status before showing success.
- [ ] **12.4** Tests.
- [ ] **12.5** Commit: `feat(website): payment redirect + status reconciliation`

---

## Task 13: Website — Booking wizard pages (sawaa + premium)

**Theme pages:** one page per wizard step, or single page with stepped UI — choose per theme.
- `themes/sawaa/pages/booking.tsx`
- `themes/premium/pages/booking.tsx`

**Route:**
- `apps/website/app/booking/page.tsx`
- `apps/website/app/booking/confirm/page.tsx` (post-payment landing)

- [ ] **13.1** Sawaa: warm/stepped UI with progress bar + sticky CTA.
- [ ] **13.2** Premium: minimalist full-screen steps with subtle transitions.
- [ ] **13.3** Both consume `use-booking-wizard` hook.
- [ ] **13.4** `/booking/confirm` reads payment status, shows success/failure + booking summary.
- [ ] **13.5** Commit: `feat(website): booking wizard pages (sawaa + premium)`

---

## Task 14: Dashboard — Guest Bookings filter

**Files:**
- Modify: `apps/dashboard/components/features/bookings/bookings-filters.tsx` (add "Guest only" toggle)
- Modify: `apps/backend/src/modules/bookings/list-bookings/list-bookings.handler.ts` (support `isGuest` filter — derived from `client.createdBy` or similar marker)

- [ ] **14.1** Backend: a booking is "guest" if its linked client was created by the public endpoint (add a `Client.source` enum: `WALK_IN | DASHBOARD | PUBLIC_WEBSITE` — or reuse existing field if present).
- [ ] **14.2** Dashboard filter: `Guest only` chip in the filter bar.
- [ ] **14.3** Commit: `feat(dashboard): guest bookings filter`

---

## Task 15: Dashboard — Manual confirmation workflow (optional)

- [ ] **15.1** If `requireManualConfirmation` flag on `OrgSettings` is true, guest bookings land as `PENDING_MANUAL_REVIEW` before `CONFIRMED`.
- [ ] **15.2** Owner confirms from dashboard; booking moves to `CONFIRMED` + notification.
- [ ] **15.3** Commit: `feat(dashboard): optional manual confirmation for guest bookings` (or skip if unneeded)

---

## Task 16: E2E — booking happy path

**Files:**
- Create: `apps/backend/test/e2e/public/guest-booking.e2e-spec.ts`

- [ ] **16.1** Test simulates: request OTP → verify (mock email capture) → create booking → init payment → simulate webhook success → assert booking is CONFIRMED, invoice PAID.
- [ ] **16.2** Uses `createTestApp()` and `testPrisma`.
- [ ] **16.3** Moyasar: stub the HTTP client (injectable provider) to return canned responses.
- [ ] **16.4** Commit: `test(backend): guest booking happy path e2e`

---

## Task 17: E2E — Payment webhook reconciliation (idempotency)

- [ ] **17.1** Send the same webhook payload twice → assert booking stays CONFIRMED once, no duplicate payment rows.
- [ ] **17.2** Send webhook for unknown payment → assert 200 (idempotent ignore), no DB change.
- [ ] **17.3** Commit: `test(backend): Moyasar webhook idempotency`

---

## Task 18: Security tests

**Files:**
- Create: `apps/backend/test/e2e/public/security.e2e-spec.ts`

- [ ] **18.1** Rate-limit test: 4th OTP request in 1 minute → 429.
- [ ] **18.2** OTP abuse: 6 wrong code attempts → locks further attempts.
- [ ] **18.3** hCaptcha bypass: empty captcha token → 400.
- [ ] **18.4** Guest booking without OTP session → 401.
- [ ] **18.5** Commit: `test(backend): public endpoints security`

---

## Task 19: QA gate Phase 2 + Kiwi sync

**Slim cases (≥8):**

- [ ] **19.1** Visitor opens `/booking`, picks a service, a therapist, a slot — UI advances.
- [ ] **19.2** Visitor enters name + email, requests OTP. Email arrives (dev: inspect MailHog / log).
- [ ] **19.3** Correct OTP advances to payment; wrong OTP shows error.
- [ ] **19.4** Moyasar test card (sandbox success card) completes payment; `/booking/confirm` shows success.
- [ ] **19.5** Dashboard shows the new booking under Guest Bookings, status CONFIRMED, invoice PAID.
- [ ] **19.6** Failed payment (test failure card) returns user to booking with clear error.
- [ ] **19.7** Branding invariance still holds — color change on dashboard reflects on website.
- [ ] **19.8** Both themes render wizard without visual regressions.
- [ ] **19.9** Kiwi sync + commit report.

---

## Ship criteria (from spec §6 Phase 2)

- ✅ A visitor completes a real paid booking end-to-end.
- ✅ Booking appears in dashboard immediately, paid.
- ✅ OTP via email; SMS adapter slot exists unused.
- ✅ Moyasar webhook reconciliation idempotent.
- ✅ Guest bookings filter in dashboard.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Moyasar sandbox ↔ production drift | Pin sandbox responses in e2e tests; integration test against sandbox in CI |
| OTP email delivered late (SMTP delay) | Show "please check email" UI state; allow resend after 60s |
| Webhook race vs booking creation | Idempotency key (existing pattern); DB constraint on unique paymentRef |
| Token replay if stolen JWT | 30-min expiry + single-use (invalidate on booking creation) |
| Website booking volume exceeds availability logic throughput | Index `(employeeId, startsAt)`; throttle at 1/min guest create |

---

## What's explicitly NOT in Phase 2

- Client accounts / login (Phase 3).
- Subscription packages (Phase 4).
- SMS OTP (adapter slot ready; provider integration is Phase 2.5 if decided).
- Refunds (Phase 4).
- Support-group bookings (Phase 4).
