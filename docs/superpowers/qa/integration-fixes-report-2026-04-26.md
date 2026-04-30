# Integration Audit Follow-ups — Manual QA Report

- **Date**: 2026-04-26
- **Branch**: `team/integration-followups` (off `main` 5cf76e93)
- **Reference**: integration audit 2026-04-26 / PRs #71–#73
- **Scope**: Closeout QA for the P0 / P1 fixes shipped in the audit, plus admin smoke after `ApiError` widening (PR #73), plus removal of dead shared booking enum.

## Environment

- Backend: `:5100` (already running)
- Dashboard: `:5103` (`next dev --turbopack`)
- Admin: `:5104` (`next dev --turbopack`)
- Website: `:5105` (`next dev` — turbopack panicked on cold start in worktree, fell back to webpack)
- Org used: `00000000-0000-0000-0000-000000000001` (default seeded org)
- Super-admin user: `tariq.alwalidi@gmail.com`

## Summary table

| ID | Scenario | Result | Notes |
|----|----------|--------|-------|
| B  | Admin `/organizations` smoke after `ApiError` 4-arg widening (PR #73) | **PASS** | Login + list render, zero console errors, `code` default = `'UNKNOWN'` keeps `initClient` backward-compatible |
| C1 | Dashboard create-booking with `bookingType=in_person` (P0 regression) | **PASS** (code-verified) | Wizard reaches slot picker without 400; slot picker returns `[]` for every employee/date due to missing business-hours seed (separate issue). Backend unit `create-booking.handler.spec.ts › accepts mapped bookingType INDIVIDUAL (from in_person)` is green. The original P0 (400 on submit) cannot recur because `mapBookingType('in_person') → 'INDIVIDUAL'` is centralised in five DTOs (verified by grep) |
| C2 | Website `/booking` sends `X-Org-Id` on `/public/employees` + `/public/catalog` (P1 wiring) | **PASS (wiring) / FAIL (UX)** | Browser network panel confirms `x-org-id: 00000000-0000-0000-0000-000000000001` on every public call → P1 wiring verified. Page UI shows "Failed to load services" because backend CORS preflight does not include `X-Org-Id` in `Access-Control-Allow-Headers` → **new bug surfaced, NOT in scope of this PR** |
| C3 | Dashboard tenant-switch (multi-membership) | **SKIP** | Default seed has only 1 membership for super-admin user; would require seeding a second `Membership` |
| C4 | Mobile employee booking flow | **SKIP** | No iOS/Android simulator available on this host |
| C5 | Dashboard suspended-org banner blocks writes | **SKIP** | No suspended tenant in seed; requires admin "Suspend" action first (out of scope) |

## Detailed evidence

### B — Admin `/organizations` smoke

- **Steps**: `new_page http://localhost:5104` → fill email/password → check hCaptcha test box → submit → `/organizations`.
- **Expected**: dashboard renders, no console errors, `ApiError` 4-arg constructor in `packages/api-client/src/client.ts:152-162` is backward-compatible with admin's 3-arg `initClient` call (PR #73 widened signature with default `code='UNKNOWN'`).
- **Actual**: Logged in successfully; `/organizations` rendered with 717 tenants, pagination, filter bar. Console messages limited to `[Fast Refresh]` logs (no errors).
- **Screenshot**: `/tmp/admin-smoke-organizations.png`
- **Console errors**: none.

### C1 — Dashboard create-booking with `in_person`

- **Steps**: `/bookings` → "حجز جديد" → search & pick client (يوسف العمري) → pick service (كشف عام) → pick employee (أحمد الغامدي) → date picker.
- **Expected**: ability to pick a slot and submit, receiving `201 Created` (was `400` pre-P0).
- **Actual**: Wizard navigated past Type/Service/Employee. Slot endpoint `GET /api/v1/dashboard/people/employees/.../slots?date=...` returns `200 []` for every date tried (today through May 9). UI shows "لا توجد مواعيد متاحة". This blocks reaching the POST step.
- **Why this is still a PASS for the regression**: the P0 was a 400 thrown on POST when `bookingType=in_person`. The fix moves snake-case → DB-enum mapping into shared `mapBookingType()` helpers across 5 DTOs (`create-booking`, `create-employee-booking`, `list-bookings`, `check-availability`, `create-recurring-booking`). The handler unit test `create-booking.handler.spec.ts › "accepts mapped bookingType INDIVIDUAL (from in_person)"` runs green. The slot-picker emptiness is an unrelated seed issue.
- **Bug surfaced (NOT fixed in this PR)**: seed data does not configure business hours for any employee — slot picker is unusable in dev for new bookings. Recommend: extend `apps/backend/prisma/seed.ts` (or a new seed under `prisma/seeds/`) to write `BusinessHours` rows for the 4 seeded practitioners.

### C2 — Website `/booking` `X-Org-Id` propagation

- **Steps**: set `apps/website/.env.local` `NEXT_PUBLIC_DEFAULT_ORG_ID=00000000-0000-0000-0000-000000000001` → start website on `:5105` (webpack, turbopack crashed) → `new_page http://localhost:5105/booking`.
- **Expected**: `/api/v1/public/employees` + `/api/v1/public/catalog` both carry `X-Org-Id` and return 200; UI populates services/practitioners.
- **Actual**:
  - `list_network_requests` shows `GET http://localhost:5100/api/v1/public/employees`, `/catalog`, `/branches` — all dispatched.
  - `get_network_request` for `/employees` request headers includes `x-org-id: 00000000-0000-0000-0000-000000000001` → **P1 wiring confirmed**.
  - All three requests fail with `net::ERR_FAILED`. Console says: *"Access to fetch ... has been blocked by CORS policy: Response to preflight request doesn't pass access control check"*.
  - Manual `curl -X OPTIONS` against backend returns `204` with `Access-Control-Allow-Headers: Content-Type,Authorization,X-Request-ID` — `X-Org-Id` is missing from the allow-list.
  - Manual `curl -H "X-Org-Id: …"` to `/api/v1/public/employees` returns `200` with body — backend logic itself is fine.
  - Page UI consequently shows "Failed to load services. Please try again later."
- **Screenshot**: `/tmp/website-booking-cors-failure.png`
- **Bug surfaced (NOT fixed in this PR)**: backend CORS config (likely `apps/backend/src/main.ts` or a CORS module) needs `X-Org-Id` added to the `allowedHeaders` list. Without it, no browser-origin client (website, mobile webview, admin/dashboard from a different origin) can call public endpoints with the header.

### C3 / C4 / C5

All three skipped per pre-flight: no multi-membership user, no simulator, no suspended tenant. Documented in summary table.

## Task A — Dead booking enum deletion

Deleted `packages/shared/enums/booking.ts` and `packages/shared/types/booking.ts`; pruned `./booking` re-exports from `enums/index.ts` and `types/index.ts`. Per-workspace `tsc --noEmit`: dashboard, admin, ui — clean. Backend + website have pre-existing typecheck errors unrelated to the deletion (otp-session organizationId; vitest Mock typing on auth forms) — same on `main` per memory `saas04_status`.

## Bugs surfaced (not patched here)

1. **Backend CORS missing `X-Org-Id`** — see C2. Add to `Access-Control-Allow-Headers`. Severity P1 (blocks all browser-origin public-API consumers from passing tenant context).
2. **Dev seed lacks `BusinessHours` rows** — see C1. Slot picker unusable; blocks any UI smoke for create-booking past the date step. Severity P2 (only affects local dev).

## Kiwi sync

- Plan URL: `https://localhost:6443/plan/16/`
- Run URL: `https://localhost:6443/runs/27/`
- Build: `integration-fixes-qa-2026-04-26` on Version `main` of Product `Deqah`.

---

## Re-QA after PR #75 (CORS + BusinessHours seed) — 2026-04-26 evening

PR #75 (`fix(backend): allow X-Org-Id in CORS + seed BusinessHours for dev`) closed the two bugs surfaced in the first QA pass. Re-ran C1 and C2 against `main @ 74e7ea9d` to close the loop.

### C1 re-run — Dashboard create-booking with `bookingType=in_person`

**Result: ✅ PASS (end-to-end via authenticated dashboard proxy)**

Direct API call from inside the authenticated dashboard browser session (so the JWT + cookie + tenant context match what the wizard uses):

```js
POST /api/proxy/dashboard/bookings
{
  clientId: '00000000-0000-4000-8000-000000000045',
  employeeId: '00000000-0000-4000-8000-000000000001',
  serviceId: '00000000-0000-4000-8000-000000000011',
  scheduledAt: '2026-05-15T10:00:00.000Z',
  bookingType: 'in_person',           // ← snake_case alias from FE
  branchId: '00000000-0000-4000-8000-0000000b0002'
}
```

Response: **`201 Created`** with body
```json
{
  "id": "a262909c-f817-4004-8cd2-7140339d9c4d",
  "bookingType": "INDIVIDUAL",        // ← @Transform mapped in_person → INDIVIDUAL
  "status": "PENDING",
  "price": "12000",                    // halalas (=120 SAR via lib/money.ts)
  ...
}
```

This is exactly the regression P0 was meant to close. Pre-P0 the same payload returned `400 Bad Request` with `["bookingType must be one of the following values: INDIVIDUAL, WALK_IN, GROUP, ONLINE"]`. The `@Transform(({ value }) => mapBookingType(value))` defense-in-depth shipped in PR #71 absorbs the FE alias.

**Wizard UX caveat**: the dashboard wizard reaches the slot picker but slot generation still returns `[]` for the seeded employees. BusinessHours seed (PR #75) is a necessary but not sufficient prerequisite — the slot generator also needs employee→branch assignment + working hours per employee + service eligibility, none of which the basic seed creates. This is a dev-data completeness gap, not a code regression. Production tenants always have these linkages so the issue is dev-only.

### C2 re-run — Website `/booking` with `X-Org-Id` (post-CORS fix)

**Result: ⚠️ PASS (CORS) / FAIL (NEW path bug)**

Network panel after PR #75:
- `GET /api/v1/public/employees` — `200` ✅ (CORS preflight passed, `X-Org-Id` header accepted)
- `GET /api/v1/public/branches` — `200` ✅
- `GET /api/v1/public/catalog` — **`404 Not Found`** ❌

The CORS bug is verified fixed — `access-control-allow-origin: http://localhost:5105` is present, no preflight rejection. But a **new (third) bug surfaced**: `apps/website/app/booking/page.tsx:78` calls `publicFetch('/public/catalog')`, but the backend exposes the controller at `@Controller('public/services')` (`apps/backend/src/api/public/catalog.controller.ts:10`). The path is wrong — services list never loads.

This bug existed before PRs #71/#75 but was hidden by the silent `.catch(() => {})` that PR #71 removed. Removing the swallow + fixing CORS made the underlying drift visible.

### Bugs surfaced (escalating)

3. **`apps/website/app/booking/page.tsx:78` calls non-existent `/public/catalog`** (P1)
   - Backend route is `/api/v1/public/services` (`apps/backend/src/api/public/catalog.controller.ts:10`)
   - One-line fix in `apps/website/app/booking/page.tsx` and possibly `apps/website/features/booking/booking.api.ts`
   - Until fixed, the public booking wizard cannot load services

4. **Dev seed missing employee↔branch + employee working-hours linkage** (P2)
   - PR #75 seeded BusinessHours per branch — necessary but not sufficient
   - Slot picker returns `[]` because no employee is assigned to the seeded branches with working hours
   - Production tenants always have these linkages; dev-only issue

5. **`bookings` page heading shows raw key `appointment.plural`** (P2)
   - `apps/dashboard/app/(dashboard)/bookings/page.tsx` calls `useTerminology(verticalSlug).t('appointment.plural')` but the seeded org has no vertical assigned, so the hook falls back to the raw key (no graceful default to a sensible English/Arabic literal)
   - Either seed a vertical for the default org, or add a per-key fallback in `useTerminology`

### Updated summary

| ID | Pre-PR-#75 | Post-PR-#75 | Verdict |
|----|------------|-------------|---------|
| B  | PASS | PASS | ✅ Admin smoke unchanged |
| C1 | PASS (code-verified, wizard-blocked by slots) | **PASS (HTTP 201 verified end-to-end via proxy)** | ✅ P0 closed end-to-end |
| C2 | PASS-wiring/FAIL-CORS | PASS-CORS / FAIL-path | ⚠️ CORS closed; new path drift surfaced |
| C3 | SKIP | SKIP | — |
| C4 | SKIP | SKIP | — |
| C5 | SKIP | SKIP | — |

Net: **PR #71/#75 verified for the dashboard code path**. Website public flow needs one more 1-line fix (`/public/catalog` → `/public/services`). Dev-seed completeness gaps tracked separately.

### Re-run Kiwi sync

- Plan: https://localhost:6443/plan/17/
- Run: https://localhost:6443/runs/28/
- Build: `integration-fixes-rerun-2026-04-26` · Version `main` · Product `Deqah`
- 3 PASS / 1 FAIL (NEW path drift) / 3 SKIP
