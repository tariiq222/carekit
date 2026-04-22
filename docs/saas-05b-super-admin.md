# SaaS-05b — Super-admin Backend

Backend surface area for CareKit super-admin employees. Lives behind the
admin audience at `/api/v1/admin/*`.

## Status

Backend **only** in this phase. The `apps/admin/` Next.js frontend,
Docker entry, and Nginx route are deferred to a follow-up phase — the
backend is dormant by default because:

1. `AdminHostGuard` rejects any host not in `ADMIN_HOSTS` (default
   `admin.carekit.app`). No existing tenant/dashboard host qualifies.
2. `SuperAdminGuard` re-verifies `User.isSuperAdmin=true` from the DB.
   No super-admins exist until the seed runs with
   `SUPER_ADMIN_EMAIL` + `SUPER_ADMIN_PASSWORD` set.

## Four runtime-enforced security invariants

| # | Invariant | Mechanism |
|---|---|---|
| 1 | `$allTenants` requires an active super-admin CLS context | `PrismaService.$allTenants` throws `ForbiddenException('super_admin_context_required')` unless `SUPER_ADMIN_CONTEXT_CLS_KEY=true`, set only by `SuperAdminContextInterceptor` AFTER `SuperAdminGuard` re-verifies via DB. |
| 2 | Admin routes reject non-admin hosts | `AdminHostGuard` global on every admin controller; compares `Host` header case-insensitively against `ADMIN_HOSTS` env. |
| 3 | Suspended-org JWTs rejected within 30s | `JwtGuard.assertOrganizationIsActive()` — Redis cache TTL 30s on `org-suspension:{orgId}`; suspend/reinstate handlers DEL the key on commit so the window closes immediately for actively-targeted orgs. |
| 4 | Shadow JWTs cannot call admin endpoints | Impersonation JWT OMITS `isSuperAdmin` entirely + carries `scope='impersonation'`. Strict `=== true` check in `SuperAdminGuard` rejects. `SuperAdminContextInterceptor` also refuses to set the CLS flag when scope=impersonation. |

## Endpoints

All protected by the load-bearing chain
`AdminHostGuard → JwtGuard → SuperAdminGuard` plus
`SuperAdminContextInterceptor`.

### Organizations
- `GET    /api/v1/admin/organizations` — list with search + suspended filter
- `GET    /api/v1/admin/organizations/:id` — detail + 30-day stats
- `POST   /api/v1/admin/organizations/:id/suspend` — audited
- `POST   /api/v1/admin/organizations/:id/reinstate` — audited

### Users
- `GET    /api/v1/admin/users?search=&organizationId=` — cross-tenant
- `POST   /api/v1/admin/users/:id/reset-password` — issues temp password, emails via SMTP, audited

### Plans
- `GET    /api/v1/admin/plans`
- `POST   /api/v1/admin/plans` (audited)
- `PATCH  /api/v1/admin/plans/:id` (audited)
- `DELETE /api/v1/admin/plans/:id` — soft-delete (refuses if active subs exist)

### Verticals
- `GET    /api/v1/admin/verticals`
- `POST   /api/v1/admin/verticals` (audited)
- `PATCH  /api/v1/admin/verticals/:id` (audited)
- `DELETE /api/v1/admin/verticals/:id` — soft-delete (refuses if orgs reference it)

### Metrics
- `GET    /api/v1/admin/metrics/platform` — orgs/users/bookings/revenue + subscriptions grouped by plan/status

### Audit Log
- `GET    /api/v1/admin/audit-log` — paginated `SuperAdminActionLog` with filters
  (`actionType`, `superAdminUserId`, `organizationId`, `from`, `to`)

### Impersonation
- `POST   /api/v1/admin/impersonation` — start (15-min shadow JWT)
- `POST   /api/v1/admin/impersonation/:id/end` — manual end
- `GET    /api/v1/admin/impersonation/sessions` — list active + historical

## Impersonation flow

1. Super-admin calls `POST /api/v1/admin/impersonation` with
   `{ organizationId, targetUserId, reason }` (reason min 10 chars).
2. Backend validates target user: must exist, must NOT be a super-admin
   (escalation hazard), must have an active membership in target org.
3. Creates `ImpersonationSession` + `SuperAdminActionLog(IMPERSONATE_START)`
   in one `$allTenants.$transaction`.
4. Signs a 15-minute shadow JWT that:
   - carries `sub, email, role, customRoleId, organizationId, membershipId`
   - carries `scope='impersonation'` + `impersonatedBy` + `impersonationSessionId`
   - **OMITS** `isSuperAdmin` (invariant 4)
5. Returns `{ sessionId, shadowAccessToken, expiresAt, redirectUrl }`.
   The dashboard picks up the token from the `_impersonation` query
   param, stores it in its normal auth slot, and displays a persistent
   red banner until the session ends.
6. Every request under the shadow JWT passes through `JwtGuard`, which
   calls `assertImpersonationSessionIsLive()` — a Redis check for
   revocation + a DB lookup for `endedAt`/`expiresAt`. Failures throw
   distinct error codes:
   - `IMPERSONATION_REVOKED` — manual end fired
   - `IMPERSONATION_ENDED` — sweeper cleaned it up
   - `IMPERSONATION_EXPIRED` — 15 min elapsed
   - `IMPERSONATION_INVALID` — session row missing
7. "End session" → `POST /.../impersonation/:id/end` → marks `endedAt`,
   writes `IMPERSONATE_END` audit log, sets
   `impersonation-revoked:{id}` in Redis (16-min TTL).
8. Auto-end: `ExpireImpersonationSessionsCron` runs every minute
   (ops-cron queue), finds sessions with `endedAt IS NULL AND expiresAt <= now`,
   ends them with `endedReason='expired'`, writes audit logs, revokes in
   Redis.

## Audit log schema (`SuperAdminActionLog`)

| Column | Notes |
|---|---|
| `id` | cuid |
| `superAdminUserId` | FK-ish to `User` (no Prisma relation to avoid coupling) |
| `actionType` | enum: `SUSPEND_ORG \| REINSTATE_ORG \| IMPERSONATE_START \| IMPERSONATE_END \| RESET_PASSWORD \| PLAN_CREATE/UPDATE/DELETE \| VERTICAL_CREATE/UPDATE/DELETE` |
| `organizationId` | nullable — platform-scope actions have none |
| `impersonationSessionId` | nullable |
| `reason` | free text (min 10 chars at the DTO boundary for destructive actions) |
| `metadata` | JSONB — action-specific (e.g., `changedFields`, `targetUserId`) |
| `ipAddress`, `userAgent`, `createdAt` | request provenance |

## Seed

`apps/backend/prisma/seed.ts` creates a super-admin idempotently when
both `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` are set.

```bash
SUPER_ADMIN_EMAIL=tariq.alwalidi@gmail.com \
SUPER_ADMIN_PASSWORD='…' \
npm run seed --workspace=backend
```

The seeded user has no `Membership` rows — they are platform-global.

## Required environment

| Var | Default | Purpose |
|---|---|---|
| `ADMIN_HOSTS` | `admin.carekit.app` | Comma-separated Host allow-list for admin audience |
| `JWT_ACCESS_SECRET` | (required) | Shared with dashboard JWTs + shadow tokens |
| `DASHBOARD_PUBLIC_URL` | `https://app.carekit.app` | Impersonation redirect target |
| `SUPER_ADMIN_EMAIL` + `SUPER_ADMIN_PASSWORD` | unset | Seed gate — both must be set |
| `SMTP_*` | unset | Temp-password emails only deliver when SMTP is configured; otherwise the operation logs a warning and returns success |

## Deferred to follow-up phase

- `apps/admin/` Next.js app with sidebar + impersonation banner
- Docker Compose entry for the admin app
- Nginx route for `admin.carekit.app`
- Wire tenant dashboard to detect `ORG_SUSPENDED`/`IMPERSONATION_*`
  error codes end-to-end (partial: dashboard + mobile already force
  logout on `ORG_SUSPENDED` via `apps/dashboard/lib/api.ts` and
  `apps/mobile/services/api.ts` from Task 4.5)
