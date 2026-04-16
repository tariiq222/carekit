# Single-Organization Mode — QA Walkthrough

**Date:** 2026-04-17
**Branch:** `feat/single-organization-mode`
**Verifier:** Claude Code (Plan G, Task G8)

Dashboard walkthrough captured via Chrome DevTools MCP. Admin logged in as
`admin@carekit-test.com` / `Admin@1234` (seeded via `npm run seed`).

## Evidence: no tenant layer in the live stack

- **JWT payload** after login (decoded from request at `/dashboard/comms/notifications/unread-count`):
  `{ sub, email, role: "ADMIN", customRoleId: null, permissions: [], features: [] }` — no `tenantId` field.
- **`X-Tenant-ID` header**: absent from every inspected XHR/fetch request (backend → dashboard).
- **Public branding endpoint** (`GET /api/v1/public/branding`) returns the singleton row
  `{ id: "default", clinicNameAr: "منظمتي", ... }` with no `:tenantId` URL param.
- **Backend CORS** `allowedHeaders`: `['Content-Type', 'Authorization', 'X-Request-ID']` — `X-Tenant-ID` removed.

## Pages captured

| # | Path | Screenshot |
|---|---|---|
| 01 | `/` (login) | `01-login.png` |
| 02 | `/` (home after login) | `02-home.png` |
| 03 | `/bookings` | `03-bookings.png` |
| 04 | `/clients` | `04-clients.png` |
| 05 | `/employees` | `05-employees.png` |
| 06 | `/branches` | `06-branches.png` |
| 07 | `/departments` | `07-departments.png` |
| 08 | `/services` | `08-services.png` |
| 09 | `/branding` | `09-branding.png` |
| 10 | `/settings` | `10-settings.png` |
| 11 | `/invoices` | `11-invoices.png` |
| 12 | `/payments` | `12-payments.png` |
| 13 | `/reports` | `13-reports.png` |

## Stack under test

- Backend: port 5100, Postgres (docker pgvector/pgvector:pg16 on :5999, database `carekit_dev_qa`), Redis, one admin user + 2 singletons + 1 main branch (from `npm run seed`).
- Dashboard: port 5103, Next.js 15 + Turbopack dev server.
- Auth: short-lived access token in memory + httpOnly refresh token via `/api/proxy/auth/refresh`.

## Notes on noise

Some Next.js Turbopack `ENOENT ...\\_buildManifest.js.tmp.*` errors appeared in the
dashboard dev server log during rapid page navigation. This is a known Windows + Turbopack
transient-file race condition, unrelated to the single-organization refactor — pages render
successfully (server log shows `200` on the actual HTML response for every route).
