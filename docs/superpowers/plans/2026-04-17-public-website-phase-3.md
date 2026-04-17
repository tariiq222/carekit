# Public Website — Phase 3 (Client Accounts) Implementation Plan

> **⚠️ Plan status:** Draft written against the spec before Phases 1.5 + 2 land. Client auth decisions (session strategy, password policy, phone vs email login) and reschedule policy specifics must be re-verified after Phase 2 and before starting Phase 3 work.

**Goal:** Returning clients log in, see their booking history, and self-serve reschedule/cancel within clinic policy. Guest bookings created in Phase 2 link to the new account by phone number on signup — no data loss.

**Architecture:** Client auth reuses the existing admin auth infrastructure in `apps/backend/src/modules/identity/auth/` but with a separate token namespace (client tokens never authorize dashboard endpoints, and vice versa). Website grows `/account/*` pages behind a client-only guard.

**Tech Stack:** Same as Phases 1/1.5/2. No new dependencies expected.

**Reference Spec:** [`docs/superpowers/specs/2026-04-17-public-website-integration-design.md`](../specs/2026-04-17-public-website-integration-design.md) §6 Phase 3.

**Branch:** `feat/website-phase-3` from `main` after Phase 2 merges.

---

## Task 0: Prep

- [ ] **0.1** Phase 2 merged; pull main.
- [ ] **0.2** `git checkout -b feat/website-phase-3`.
- [ ] **0.3** Read `apps/backend/src/modules/identity/auth/` to understand token strategy, refresh rotation, CASL integration.
- [ ] **0.4** Decide: **email + password** for login vs **OTP-only** (no password). Recommended for Phase 3: email + password with OTP as password-reset; OTP-only is brittle for returning users.

---

## Task 1: Prisma — Client auth fields

**Files:**
- Modify: `apps/backend/prisma/schema/people.prisma` (Client model)
- Create: migration

- [ ] **1.1** Add to Client:
  ```prisma
  passwordHash   String?
  lastLoginAt    DateTime?
  accountActive  Boolean   @default(true)
  ```
- [ ] **1.2** `@@index([email])` on Client (if missing) for login lookup.
- [ ] **1.3** Migration + tests.
- [ ] **1.4** Commit: `feat(backend): Client auth fields`

---

## Task 2: Backend — Client registration

**Files:**
- Create: `modules/identity/client-auth/register.dto.ts`
- Create: `modules/identity/client-auth/register.handler.ts` (+ spec)
- Create: `api/public/client-auth.controller.ts`

- [ ] **2.1** DTO: `name`, `email`, `phone`, `password` (min 8, 1 upper, 1 digit), `otpSessionToken` (from OTP verify step).
- [ ] **2.2** Handler:
  - Verify OTP session JWT from Phase 2
  - If a Client with this phone OR email exists → merge into it (account upgrade from guest)
  - Else create new Client
  - Hash password (bcrypt, cost 12)
  - Set `emailVerified` / `phoneVerified` from OTP
  - Issue access + refresh tokens (client namespace)
- [ ] **2.3** Controller: `POST /api/v1/public/auth/register`. Throttle 3/min per IP.
- [ ] **2.4** Specs: new registration, merge with existing guest, weak password rejected.
- [ ] **2.5** Commit: `feat(backend): POST /public/auth/register`

---

## Task 3: Backend — Client login

**Files:**
- Create: `modules/identity/client-auth/login.dto.ts`
- Create: `modules/identity/client-auth/login.handler.ts` (+ spec)

- [ ] **3.1** DTO: `email`, `password`.
- [ ] **3.2** Handler:
  - Lookup client by email
  - bcrypt compare
  - Rate-limit wrong-password attempts (5/15min per email)
  - Issue access + refresh tokens
  - Update `lastLoginAt`
- [ ] **3.3** Controller: `POST /api/v1/public/auth/login`. Throttle 10/min.
- [ ] **3.4** Specs: happy, wrong password, non-existent email (same generic response — no enumeration).
- [ ] **3.5** Commit: `feat(backend): POST /public/auth/login`

---

## Task 4: Backend — Refresh + logout

**Files:**
- Create: `modules/identity/client-auth/refresh.handler.ts` (+ spec)
- Create: `modules/identity/client-auth/logout.handler.ts` (+ spec)

- [ ] **4.1** `refresh`: verify refresh token, rotate (invalidate old, issue new pair).
- [ ] **4.2** `logout`: revoke the refresh token in DB.
- [ ] **4.3** Controllers: `POST /api/v1/public/auth/refresh`, `POST /api/v1/public/auth/logout`.
- [ ] **4.4** Specs.
- [ ] **4.5** Commit: `feat(backend): client auth refresh + logout`

---

## Task 5: Backend — Client session guard + decorator

**Files:**
- Create: `common/guards/client-session.guard.ts`
- Create: `common/decorators/current-client.decorator.ts`

- [ ] **5.1** Guard verifies client-namespace JWT. Rejects tokens with admin/employee claims.
- [ ] **5.2** `@CurrentClient()` extracts `{ clientId }` into handler params.
- [ ] **5.3** Specs.
- [ ] **5.4** Commit: `feat(backend): client session guard + decorator`

---

## Task 6: Backend — `GET /public/me`, `GET /public/me/bookings`

**Files:**
- Create: `modules/identity/client-auth/get-me.handler.ts` (+ spec)
- Create: `modules/bookings/client/list-client-bookings.handler.ts` (+ spec)
- Create: `api/public/me.controller.ts`

- [ ] **6.1** `/me`: returns client profile (name, email, phone, verification flags, NOT password).
- [ ] **6.2** `/me/bookings`: lists bookings for this client, paginated, sorted by `startsAt DESC`. Includes service + employee summary + status + payment status.
- [ ] **6.3** Guard: `ClientSessionGuard`.
- [ ] **6.4** Specs.
- [ ] **6.5** Commit: `feat(backend): /public/me + /public/me/bookings`

---

## Task 7: Backend — Reschedule + cancel with policy

**Files:**
- Create: `modules/bookings/client/reschedule-booking.handler.ts` (+ spec)
- Create: `modules/bookings/client/cancel-booking.handler.ts` (+ spec)
- Create: `api/public/me.controller.ts` (extend)

- [ ] **7.1** Reschedule policy: booking must be `CONFIRMED`, `startsAt > now + X hours` (configurable on OrgSettings or Service).
- [ ] **7.2** Cancel policy: same window; after the window, booking transitions to `CANCEL_REQUESTED` (manual review) instead of `CANCELLED`.
- [ ] **7.3** Reschedule reuses availability logic from Phase 2; creates a new slot atomically (DB transaction).
- [ ] **7.4** Cancel triggers refund request if payment was captured (Phase 4 handles actual refund).
- [ ] **7.5** Controllers: `PATCH /api/v1/public/me/bookings/:id/reschedule`, `PATCH /api/v1/public/me/bookings/:id/cancel`.
- [ ] **7.6** Specs: happy, outside window, not owned by client (403), booking not cancellable state.
- [ ] **7.7** Commit: `feat(backend): client reschedule + cancel endpoints`

---

## Task 8: api-client — Client auth + me endpoints

**Files:**
- Create: `packages/api-client/src/modules/client-auth.ts`
- Create: `packages/api-client/src/modules/me.ts`

- [ ] **8.1** `register`, `login`, `refresh`, `logout`.
- [ ] **8.2** `getMe`, `getMyBookings`, `rescheduleMyBooking`, `cancelMyBooking`.
- [ ] **8.3** Types in `@carekit/shared`.
- [ ] **8.4** Tests.
- [ ] **8.5** Commit: `feat(api-client): client auth + /me endpoints`

---

## Task 9: Website — features/auth slice

**Files under `apps/website/features/auth/`:**
- `auth.api.ts`, `auth.schema.ts`, `auth.types.ts`
- `auth-store.ts` (client-side token management)
- `use-current-client.ts` (React hook returning `{ client, isLoading }`)
- `auth-guard.tsx` (redirects to `/login` if unauthenticated)
- `login-form.tsx`, `register-form.tsx`
- `public.ts`, `auth.test.tsx`

- [ ] **9.1** Token storage: **httpOnly cookies set by backend** (preferred over localStorage for XSS safety). Adjust backend endpoints to set `Set-Cookie` headers.
- [ ] **9.2** `use-current-client` fetches `/me` via cookie auth; returns `null` if 401.
- [ ] **9.3** Tests.
- [ ] **9.4** Commit: `feat(website): auth feature slice (cookie-based)`

---

## Task 10: Website — /login + /register pages (both themes)

**Theme pages:**
- `themes/sawaa/pages/login.tsx`, `themes/sawaa/pages/register.tsx`
- `themes/premium/pages/login.tsx`, `themes/premium/pages/register.tsx`

**Routes:**
- `apps/website/app/login/page.tsx`
- `apps/website/app/register/page.tsx`

- [ ] **10.1** Login form: email + password + "forgot password?" link (stub for Phase 4 or link to OTP reset flow).
- [ ] **10.2** Register form: name + email + phone + password. Flow: on submit → OTP request → OTP verify → actual registration API call with session JWT.
- [ ] **10.3** On success, redirect to `/account`.
- [ ] **10.4** Commit: `feat(website): login + register pages`

---

## Task 11: Website — /account pages (profile + bookings)

**Theme pages:**
- `themes/sawaa/pages/account-profile.tsx`, `themes/sawaa/pages/account-bookings.tsx`
- `themes/premium/pages/account-profile.tsx`, `themes/premium/pages/account-bookings.tsx`

**Routes (protected by `<AuthGuard>`):**
- `apps/website/app/account/page.tsx` (profile)
- `apps/website/app/account/bookings/page.tsx`
- `apps/website/app/account/bookings/[id]/page.tsx` (detail + reschedule/cancel)

- [ ] **11.1** Profile: name, email, phone (read-only for Phase 3; edit in Phase 3.5).
- [ ] **11.2** Bookings list: tabs (Upcoming / Past), cards with service + therapist + time + status.
- [ ] **11.3** Booking detail: full info + "Reschedule" + "Cancel" buttons (disabled if policy window closed).
- [ ] **11.4** Logout button in profile.
- [ ] **11.5** Commit: `feat(website): client account pages`

---

## Task 12: Website — Reschedule flow

**Files:**
- Create: `apps/website/features/booking/reschedule-flow.tsx` (reuses slot-picker from Phase 2)

- [ ] **12.1** Client opens booking detail → "Reschedule" → reuses existing `slot-picker` for the same employee + service.
- [ ] **12.2** On confirm → calls `rescheduleMyBooking` → success toast → back to booking detail.
- [ ] **12.3** Handle outside-window error with clear message.
- [ ] **12.4** Commit: `feat(website): reschedule flow`

---

## Task 13: Website — Cancel flow

- [ ] **13.1** Cancel button → confirmation dialog explaining policy (refund window? refund status?).
- [ ] **13.2** Within window → immediate cancel (status CANCELLED) with refund flagged.
- [ ] **13.3** Outside window → CANCEL_REQUESTED + message "manual review".
- [ ] **13.4** Commit: `feat(website): cancel flow with policy-aware UX`

---

## Task 14: Guest-booking-to-account linking (explicit test)

- [ ] **14.1** Guest booked in Phase 2 with phone `+9665...`. Later, someone registers with the same phone → backend merges the Client row (see Task 2).
- [ ] **14.2** E2E test asserts the existing guest bookings become visible in `/account/bookings` after registration.
- [ ] **14.3** Edge case: email in new registration doesn't match guest email — policy decision: phone wins as merge key, email overwrites on Client.
- [ ] **14.4** Commit: `test(backend): guest-to-account link by phone e2e`

---

## Task 15: E2E — full client journey

**Files:**
- Create: `apps/backend/test/e2e/public/client-account.e2e-spec.ts`

- [ ] **15.1** Register → login → fetch /me → list bookings (empty) → complete a guest booking on same phone → login again → bookings list shows the earlier booking.
- [ ] **15.2** Reschedule flow within policy window.
- [ ] **15.3** Cancel outside window transitions to CANCEL_REQUESTED.
- [ ] **15.4** Commit: `test(backend): client account e2e`

---

## Task 16: Dashboard — Client account flag + admin override

**Files:**
- Modify: `apps/dashboard/components/features/clients/client-detail-page.tsx`

- [ ] **16.1** Show "Has Account" badge on client records with `passwordHash IS NOT NULL`.
- [ ] **16.2** Admin action: "Disable account" (sets `accountActive = false` → client can't log in anymore, but data preserved).
- [ ] **16.3** Commit: `feat(dashboard): client account management`

---

## Task 17: QA gate Phase 3 + Kiwi sync

**Slim cases:**

- [ ] **17.1** Register a new account — lands on `/account`.
- [ ] **17.2** Logout + login with same credentials.
- [ ] **17.3** Book as guest with phone X → register with phone X → booking appears in account.
- [ ] **17.4** Reschedule an upcoming booking within policy.
- [ ] **17.5** Attempt to reschedule past-the-window booking → clear error.
- [ ] **17.6** Cancel within window → CANCELLED.
- [ ] **17.7** Disabled account (toggled by admin) can't log in.
- [ ] **17.8** Both themes render auth + account pages.
- [ ] **17.9** Kiwi sync + report.

---

## Ship criteria (from spec §6 Phase 3)

- ✅ Returning clients register + log in.
- ✅ Client session separate from admin.
- ✅ `/account`, `/account/bookings`, `/account/bookings/:id` live.
- ✅ Reschedule + cancel respecting clinic policies.
- ✅ Guest bookings migrate into accounts by phone.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Client JWT leaks to browser → XSS steals token | httpOnly cookie + SameSite=Lax + Secure in prod |
| Phone-based merge collides (two guests different people same phone) | Impossible in practice for same clinic; block if found, flag for manual admin resolve |
| Password reuse / weak passwords | zxcvbn-style strength meter (client + server), min-complexity enforced |
| Session fixation | Refresh rotation on every refresh, invalidate on logout, short access token TTL (15 min) |
| Reschedule race (client + receptionist simultaneously) | DB transaction with optimistic concurrency (version column or SELECT ... FOR UPDATE) |

---

## What's NOT in Phase 3

- Subscription packages (Phase 4).
- Refund execution (Phase 4 — Phase 3 only flags).
- Support-group bookings (Phase 4).
- Password reset flow — decide whether to ship in Phase 3 (OTP-based reset is small) or Phase 3.5.
- Profile editing (name/phone/email changes) — Phase 3.5 if time-constrained.
- 2FA for client accounts.
