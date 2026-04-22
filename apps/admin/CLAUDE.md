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

1. **Vertical Slices architecture.** Every user-facing action is one
   directory under `features/<cluster>/<action>/` containing its API
   call, its TanStack Query hook, and any UI components specific to it.
   Mirror the backend layout at `modules/platform/admin/<action>/` so
   you can follow a feature end-to-end without bouncing across layers.
   No cross-feature imports (feature A → feature B). Shared primitives
   go in `@carekit/ui` or `lib/`.
2. **No feature-specific components in `@carekit/ui`** — that package is
   shared with the tenant dashboard. Admin-only widgets live here in
   the owning feature slice.
3. **LTR only.** The tenant dashboard is Arabic-first / RTL. This panel
   is staff-only and English-first; do not import `next-intl` or add
   locale providers.
4. **No tenant context ever.** Admin code never sets
   `X-Organization-Id` — the backend resolves via `SuperAdminGuard` +
   `SuperAdminContextInterceptor` which unlocks `$allTenants`. If you
   find yourself needing an org slug in the URL, you're building the
   wrong thing — that's the dashboard.
5. **Every destructive action collects a `reason` (min 10 chars)** in a
   Dialog and passes it to the backend, which writes it to
   `SuperAdminActionLog`. No shortcuts.
6. **Session storage is `localStorage.admin.accessToken` + cookie
   marker `admin.authenticated=1`.** Middleware uses the cookie to
   redirect unauthenticated users; the JWT in localStorage is what the
   fetch wrapper sends as `Authorization: Bearer …`.

## Layer rules

```
app/            ← Next pages — thin composition only (≤ ~80 lines each)
  (admin)/      ← authenticated shell; sidebar + main content
  login/        ← unauthenticated
features/       ← vertical slices — one directory per action
  <cluster>/
    types.ts                (cluster-shared response types)
    <action>/
      <action>.api.ts       (typed fetch call)
      use-<action>.ts       (TanStack hook for queries/mutations)
      <optional>.tsx        (UI components used by this action only)
shell/          ← layout-level UI (sidebar, logout button) — NOT feature UI
lib/
  api-client.ts ← raw fetch wrapper (adminRequest + publicRequest)
  types.ts      ← shared primitives (PageMeta)
```

Imports flow top-down only. Pages import features + shell; features
import lib; lib never imports features or shell.

To add a new action: create `features/<cluster>/<new-action>/` with the
three files above, then import its hook in a page. Do NOT add anything
to a shared API barrel — there isn't one.

## Routes (current)

- `/login` — sign-in form
- `/` — overview (platform metrics cards)
- `/organizations` — list + search + status filter
- `/organizations/[id]` — detail + suspend / reinstate dialogs
- `/audit-log` — filtered read-only log

Stubs still to build in a follow-up: `/users`, `/plans`, `/verticals`,
`/metrics` (dedicated page with groupBy charts),
`/impersonation-sessions`, and the "Impersonate" action inside the org
detail page. Each becomes its own `features/<cluster>/<action>/` slice.

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
