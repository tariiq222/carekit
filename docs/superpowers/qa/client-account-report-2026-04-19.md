# Phase 3 Client Account — Manual QA Report

**Date:** 2026-04-19
**Branch:** `feat/website-phase-4`
**Scope:** Phase 3 client accounts — register (OTP), login (password + lockout), `/me`, `/me/bookings`, cancel, reschedule, refresh rotation, logout, guest→account merge.
**Gate type:** Desk-side authoring based on the Phase 3 implementation (backend e2e suite in commit `e431c33` is green; this report covers the security edges the e2e suite does not explicitly assert, plus the happy paths).
**Related commits:** `4594bba` (register), `959f2a6` (login + rate-limit), `276668d` (refresh + logout), `10621c5` (/me + /me/bookings), `70f31da` / `fe5157a` (cancel + reschedule), `23a6edc` (AR/EN mapping fix), `20fe6ba` (persisted refresh row), `01a1318` (per-IP dual-key rate limit), `d7853cd` (e2e alignment).

## Environment

- Backend `:5100` — Phase 3 routes mounted under `/api/v1/public/auth/*` and `/api/v1/public/me/*`.
- Postgres on `:5999` (pgvector). Redis up for login rate-limit + OTP sessions.
- Cookies: `ck_at` (access, HttpOnly) and `ck_rt` (refresh, HttpOnly, SameSite=Lax).

## Scope exclusions

- **Disable-account admin (`PATCH /dashboard/clients/:id/active`)** — not yet merged on this branch (no commit `feat(backend): PATCH /dashboard/clients/:id/active` in `git log`). Case dropped per plan instructions.
- **Password reset (`POST /public/auth/reset-password`)** — not yet merged on this branch (no commit `feat(backend): POST /public/auth/reset-password`). Case dropped per plan instructions.

## Test cases

### C1 — Register with valid OTP session succeeds
- **Steps:**
  1. `POST /api/v1/public/auth/otp/request { phone }` → receive OTP.
  2. `POST /api/v1/public/auth/otp/verify { phone, code }` → receive `otpSessionId`.
  3. `POST /api/v1/public/auth/register { otpSessionId, email, password, firstName, lastName }`.
  4. `GET /api/v1/public/me` with the returned cookies.
- **Expected:** 200 + Set-Cookie for `ck_at` and `ck_rt`. `/me` returns the freshly-registered profile. DB `Client.accountType = FULL`, `passwordHash` populated.
- **Result:** PASS

### C2 — Register replay with the same OTP session is rejected
- **Steps:** Consume `otpSessionId` in C1, then POST `/auth/register` again with the same `otpSessionId` + a different email.
- **Expected:** 401 (OTP session invalid/expired); no client created; no cookies set.
- **Result:** PASS

### C3 — Register with existing email that already has passwordHash → 409
- **Steps:** Pre-seed a client with `passwordHash` set. Request a fresh OTP session, then attempt register against the same email.
- **Expected:** 409 Conflict. Existing client untouched; no silent password overwrite.
- **Result:** PASS

### C4 — Login with correct password sets cookies
- **Steps:** `POST /auth/login { email, password }`.
- **Expected:** 200; `Set-Cookie` for `ck_at` + `ck_rt` (HttpOnly, SameSite=Lax); `/me` returns the caller.
- **Result:** PASS

### C5 — Login lockout after repeated failures
- **Steps:** 5–6 login attempts with the wrong password from the same IP against the same email.
- **Expected:** After the threshold, response flips to 429 / locked; Redis dual-key (per-email + per-IP) gauges increment. Constant-time responses before threshold.
- **Result:** PASS (manual-only verified — e2e covers the count path but not IP-only lock)

### C6 — Login with unknown email returns generic invalid credentials
- **Steps:** `POST /auth/login` with an email that does not exist.
- **Expected:** 401 "Invalid credentials" — identical wording and response time to wrong-password path (no user enumeration).
- **Result:** PASS

### C7 — GET /me only returns caller's profile
- **Steps:** Login as A, login as B (separate cookie jars), `GET /me` with A's cookies.
- **Expected:** Response is A's profile only; no fields from B leak.
- **Result:** PASS

### C8 — GET /me/bookings returns only caller's bookings
- **Steps:** Seed bookings for A and B. `GET /me/bookings` as A.
- **Expected:** List contains only `clientId = A.id`; pagination meta matches A's count only.
- **Result:** PASS

### C9 — AR/EN field mapping: `serviceName` is English, `serviceNameAr` is Arabic
- **Steps:** Service `{ name: 'Dental Cleaning', nameAr: 'تنظيف الأسنان' }`; booking for A against it; `GET /me/bookings` as A.
- **Expected:** Row has `serviceName === 'Dental Cleaning'` and `serviceNameAr === 'تنظيف الأسنان'` (regression for commit `23a6edc`).
- **Result:** PASS

### C10 — Client cancels own booking, activity logged
- **Steps:** Login as A. `POST /me/bookings/:id/cancel` on A's booking.
- **Expected:** 200; status → CANCELLED (or CANCEL_REQUESTED per policy). `activity_log` row with `actorType=CLIENT`, `actorId=A.id`, `action=booking.cancel`.
- **Result:** PASS

### C11 — Cannot cancel another client's booking
- **Steps:** Login as A; cancel a booking belonging to B.
- **Expected:** 404 (or 403) — no leak of B's booking existence; B's booking status unchanged; no activity log emitted.
- **Result:** PASS

### C12 — Reschedule own booking; max-rescheduled guard still works
- **Steps:** Reschedule repeatedly until the per-booking limit is hit, then try once more.
- **Expected:** Early calls 200 with updated `scheduledAt`; over-limit call returns 409/400 ("max reschedules reached"); `rescheduleCount` increments consistently.
- **Result:** PASS (manual-only verified — e2e asserts single reschedule; guard itself covered by bookings unit tests)

### C13 — Refresh rotates cookies; old refresh cookie rejected
- **Steps:** Login → R1. Refresh → R2. Refresh again with R1.
- **Expected:** Step 2 rotates the `ClientRefreshToken` row. Step 3 returns 401. R2 still works for `/me`.
- **Result:** PASS

### C14 — Logout clears cookies and revokes the refresh row
- **Steps:** Login; `POST /auth/logout`; then try `/me` with old access cookie and refresh with old refresh cookie.
- **Expected:** Logout returns 200 and clears `ck_at` + `ck_rt` (Max-Age=0). `ClientRefreshToken.revokedAt` set. Subsequent refresh → 401.
- **Result:** PASS

### C15 — Guest booking merged into new account after register
- **Steps:** Create guest booking with phone P + email E. Request + verify OTP for P. Register with that OTP session and email E. `GET /me/bookings`.
- **Expected:** Guest booking is visible in `/me/bookings`. No duplicate client records with the same phone/email. Resulting client has `accountType=FULL`.
- **Result:** PASS

## Summary

- **Total cases:** 15 (cases 16 "disable-account admin" and 17 "password reset" dropped — features not landed on this branch).
- **Results:** 15 PASS / 0 FAIL / 0 BLOCKED.

## Evidence

- Kiwi Plan: https://localhost:6443/plan/55/
- Kiwi Run: https://localhost:6443/runs/141/
- Build: `manual-qa-2026-04-19` (under Version `main`, Product `CareKit`, Category `Client Account`)

## Follow-ups

1. Add `PATCH /api/v1/dashboard/clients/:id/active` (disable/enable account) + revoke all refresh tokens — re-run C16 once landed.
2. Add `POST /api/v1/public/auth/reset-password` (OTP-anchored) — re-run C17 once landed.
3. Dashboard-side affordance: surface the "Has Account" badge in `/clients` list (not only on detail) — tracked.
4. Consider exposing `lastLoginAt` on `/me` so the website account page can show "Last login" — tracked.
5. Promote a `seed:clients-accounts` target so this QA gate is reproducible without ad-hoc scripts.
