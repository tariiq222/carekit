# apps/admin — CareKit Super-admin Panel

Next.js 15 (App Router) + React 19 + TanStack Query, mounted at
`admin.carekit.app` in prod and `http://localhost:5104` in dev.

## Purpose

Platform control plane used only by CareKit staff. NOT a clinic-facing
dashboard — that lives in `apps/dashboard`. Super-admins:

- list / suspend / reinstate organizations
- search users across tenants + issue temp passwords
- manage Plans + Verticals (cross-tenant CRUD)
- view platform metrics
- read the super-admin audit log
- start + end impersonation sessions

## Hard rules

1. **No feature-specific components in `@carekit/ui`** — that package is
   shared with the tenant dashboard. Admin-only widgets live here.
2. **LTR only.** The tenant dashboard is Arabic-first / RTL. This panel
   is staff-only and English-first; do not import `next-intl` or add
   locale providers.
3. **No tenant context ever.** Admin code never sets
   `X-Organization-Id` — the backend resolves via `SuperAdminGuard` +
   `SuperAdminContextInterceptor` which unlocks `$allTenants`. If you
   find yourself needing an org slug in the URL, you're building the
   wrong thing — that's the dashboard.
4. **Every destructive action collects a `reason` (min 10 chars)** in a
   Dialog and passes it to the backend, which writes it to
   `SuperAdminActionLog`. No shortcuts.
5. **Session storage is `localStorage.admin.accessToken` + cookie
   marker `admin.authenticated=1`.** Middleware uses the cookie to
   redirect unauthenticated users; the JWT in localStorage is what the
   fetch wrapper sends as `Authorization: Bearer …`.

## Layer rules

```
app/         ← Next pages (RSC + client components marked 'use client')
  (admin)/   ← authenticated shell; sidebar + main content
  login/     ← unauthenticated
components/  ← admin-only UI (sidebar, impersonation banner, etc.)
lib/         ← api.ts (typed fetch wrapper), cookies, helpers
```

Imports flow top-down only. Pages import components + lib; components
import lib; lib never imports pages or components.

## Routes (current)

- `/login` — sign-in form
- `/` — overview (platform metrics cards)
- `/organizations` — list + search + status filter
- `/organizations/[id]` — detail + suspend / reinstate dialogs
- `/audit-log` — filtered read-only log

Stubs still to build in a follow-up: `/users`, `/plans`, `/verticals`,
`/metrics` (dedicated page with groupBy charts),
`/impersonation-sessions`, and the "Impersonate" action inside the org
detail page.

## Development

```bash
# backend must be running on :5100 (docker or dev mode)
npm run dev:admin   # → http://localhost:5104

# create a super-admin to sign in with
SUPER_ADMIN_EMAIL='you@carekit' SUPER_ADMIN_PASSWORD='changeme' \
  npm run seed --workspace=backend
```

Set `ADMIN_HOSTS=admin.localhost:5104,localhost:5104` in the backend
`.env.local` — otherwise `AdminHostGuard` will reject every request
from the dev admin app.

## Security posture

Mirrors the backend-only rollout:
- `AdminHostGuard` rejects any host not in `ADMIN_HOSTS`.
- `SuperAdminGuard` re-verifies `User.isSuperAdmin=true` from the DB.
- `SuperAdminContextInterceptor` unlocks `$allTenants` via a CLS flag.
- Impersonation shadow JWTs omit `isSuperAdmin` and carry
  `scope='impersonation'` — they cannot be replayed against admin
  endpoints.

Full reference: `docs/saas-05b-super-admin.md`.
