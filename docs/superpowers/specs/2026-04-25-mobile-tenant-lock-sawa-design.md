# Mobile Tenant-Lock — سواء للإرشاد الأسري

**Date:** 2026-04-25
**Status:** Approved (pending spec review)
**Owner:** Tariq
**Customer:** سواء للإرشاد الأسري (first paying tenant)

## Goal

Lock the CareKit mobile app to a single tenant (`Default Organization` for now, swappable to any tenant ID with one config change) and rebrand the app's launcher identity (name + icon + bundle ID) to **سواء للإرشاد الأسري**. Defer multi-tenant build pipeline until a second customer requires it.

## Non-Goals

- White-label build pipeline (EAS profiles per tenant) — deferred to Phase B when a second branded tenant is signed.
- Per-tenant theme/colors at runtime — out of scope for this iteration. The CareKit default theme stays.
- Tenant subdomain resolver (Plan 09) — not required because we hard-code the tenant.
- Mobile selection screen / multi-tenant onboarding — explicitly excluded.
- Production app store submission — local dev binary only at this stage.

## Context

The CareKit backend is multi-tenant (`TENANT_ENFORCEMENT=permissive` in dev). The mobile app currently sends no tenant context on public endpoints, so the backend's `TenantResolverMiddleware` falls through to `DEFAULT_ORGANIZATION_ID`. This works coincidentally today but breaks the moment we flip dev to `strict` or add a second tenant.

For the first paying customer (سواء للإرشاد الأسري) the user wants:

1. The mobile app launcher shows the customer's name and icon — not "CareKit".
2. The app, when opened, only ever talks to the customer's tenant.
3. Zero logic for "switching tenants" — single-tenant binary.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ apps/mobile (Expo)                                          │
│                                                             │
│   constants/config.ts                                       │
│     export const TENANT_ID = '00000000-...-000000000001';   │
│                                                             │
│   services/api.ts                                           │
│     interceptor → headers['X-Org-Id'] = TENANT_ID           │
│                                                             │
│   app.config.ts (replaces app.json)                         │
│     name: 'سواء للإرشاد الأسري'                              │
│     bundleIdentifier / package: 'sa.sawa.app'               │
│     icon: './assets/sawa/icon.png' (placeholder until file) │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ X-Org-Id: <TENANT_ID>
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ apps/backend                                                │
│                                                             │
│   common/tenant/tenant-resolver.middleware.ts               │
│     New priority step: accept X-Org-Id from public          │
│     endpoints if request matches the public allowlist       │
│     (no JWT present, route under /public/*).                │
│                                                             │
│   The header is NEVER trusted on authenticated routes —     │
│     JWT claim still wins.                                   │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Org context set in CLS
                          ▼
                  Existing scoped queries
                  (52 SCOPED_MODELS, RLS)
```

## Components

### 1. Backend — `TenantResolverMiddleware` extension

**File:** `apps/backend/src/common/tenant/tenant-resolver.middleware.ts`

Add a new resolution step between **JWT claim** and **DEFAULT_ORGANIZATION_ID fallback**:

```ts
// New step: X-Org-Id from public (unauthenticated) requests
const fromPublicHeader =
  !req.user && this.isPublicRoute(req.path)
    ? this.parseUuidHeader(req.headers['x-org-id'])
    : undefined;
```

`isPublicRoute(path)`: returns `true` when `path` starts with `/api/v1/public/` AND is NOT a webhook route (`/webhooks/`). Webhooks have their own tenant resolution (system-context flow).

`parseUuidHeader(value)`: validates the value matches the standard UUID regex (8-4-4-4-12 hex format, RFC 4122-compatible — *not* restricted to v4 because `DEFAULT_ORGANIZATION_ID = 00000000-0000-0000-0000-000000000001` is not a v4). Anything else → undefined (silent reject; falls through to DEFAULT in permissive, throws in strict).

**Security guarantees:**

- Authenticated requests are unaffected — JWT claim still has priority.
- Header is only honored when `req.user` is undefined AND the route is public.
- Invalid UUIDs are silently dropped, no info-leak.
- This does not bypass scoping — the resolved orgId still flows through the same CLS context, so all 52 SCOPED_MODELS auto-filter by it.
- Strict mode still throws if no JWT, no valid header, no valid subdomain — this only adds one more way to *populate* context, never to skip enforcement.

**Test coverage:**

- Existing `tenant-resolver.middleware.spec.ts` extended:
  - `accepts X-Org-Id on public route when unauthenticated`
  - `ignores X-Org-Id on authenticated route (JWT wins)`
  - `ignores X-Org-Id on private route even when unauthenticated (falls through)`
  - `ignores invalid UUID in X-Org-Id`
  - `ignores X-Org-Id on /webhooks/ public route`

### 2. Backend — DB update for the customer tenant

**One-time migration script** (not a Prisma migration — a seed script invoked once):

```
apps/backend/prisma/seeds/sawa-customer.ts
```

- Updates `Organization` (`id = 00000000-0000-0000-0000-000000000001`):
  - `nameAr = 'سواء للإرشاد الأسري'`
  - `nameEn = 'Sawa Family Counseling'`
  - `slug = 'sawa'`
  - `verticalId = <id of family-consulting vertical>`
- Idempotent: re-running is a no-op (uses upsert semantics).
- Triggered manually: `npm run seed:sawa --workspace=backend`.

We do NOT modify existing migrations (immutable rule). Departments / categories are NOT regenerated — the user can reseed via the dashboard if they want the family-consulting vertical defaults.

### 3. Mobile — Tenant constant

**File:** `apps/mobile/constants/config.ts`

```ts
export const TENANT_ID =
  process.env.EXPO_PUBLIC_TENANT_ID ?? '00000000-0000-0000-0000-000000000001';
```

- Default points at the dev `DEFAULT_ORGANIZATION_ID`.
- `EXPO_PUBLIC_TENANT_ID` env override allows swapping per-environment without code change (e.g. staging vs. prod).
- This is the **single source of truth** for "which tenant this binary serves". Future build-time customization (Phase B) reads the same env var.

### 4. Mobile — Axios interceptor

**File:** `apps/mobile/services/api.ts`

Add a new request interceptor (in addition to the existing JWT one):

```ts
api.interceptors.request.use((config) => {
  config.headers.set('X-Org-Id', TENANT_ID);
  return config;
});
```

Applied to ALL requests (both public and authenticated). On authenticated requests it's harmless because the JWT claim takes priority in the middleware.

### 5. Mobile — App identity (`app.config.ts`)

**Replace** `apps/mobile/app.json` with `apps/mobile/app.config.ts`. Same Expo config, but now in TS so we can read env vars at build time and stay typed.

```ts
import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'سواء للإرشاد الأسري',
  slug: 'sawa',
  version: '1.0.0',
  scheme: 'sawa',
  orientation: 'portrait',
  icon: './assets/sawa/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/sawa/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: { supportsTablet: true, bundleIdentifier: 'sa.sawa.app' },
  android: {
    package: 'sa.sawa.app',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/sawa/android-icon-foreground.png',
      backgroundImage: './assets/sawa/android-icon-background.png',
      monochromeImage: './assets/sawa/android-icon-monochrome.png',
    },
  },
  // remaining fields preserved verbatim from app.json
};

export default config;
```

### 6. Mobile — Asset placement

```
apps/mobile/assets/sawa/
  icon.png                       (1024×1024, customer-provided)
  splash.png                     (placeholder, customer-provided later)
  android-icon-foreground.png    (placeholder)
  android-icon-background.png    (solid color)
  android-icon-monochrome.png    (placeholder)
```

The user will drop `icon.png` (the one already ready) into `assets/sawa/`. Other assets start as copies of the existing CareKit ones until the customer provides their versions — they only affect Android adaptive icon and splash, not the launcher icon on iOS.

### 7. Mobile — In-app text references

Search and replace `'CareKit'` literal in mobile UI strings that are user-visible (e.g., title bar, about screen, splash) → use `APP_NAME` constant which is updated to `'سواء للإرشاد الأسري'` in `constants/config.ts`. Anything that's a CareKit identifier (analytics events, log tags, scheme references) stays as `carekit` to avoid breaking telemetry.

## Data Flow — Mobile request lifecycle

1. App opens. Splash renders from `assets/sawa/splash.png`.
2. Any API call (e.g., `GET /public/services/departments`) goes through `api.ts`.
3. Request interceptor injects `X-Org-Id: 00000000-...-000000000001`.
4. Backend `TenantResolverMiddleware`:
   - No JWT → `req.user` undefined.
   - Path starts with `/api/v1/public/` → public route.
   - `X-Org-Id` valid UUID → set CLS tenant context = that ID.
5. `ListPublicDepartmentsHandler` calls `requireOrganizationIdOrDefault()` → returns the ID set in CLS.
6. Prisma query filters by `organizationId` → returns only Sawa's departments.

For authenticated calls (e.g., post-login client API), the JWT carries the orgId and the header is ignored — no behavior change.

## Error Handling

- **Invalid `X-Org-Id` (non-UUID):** silently dropped, falls through to default (permissive) or throws TenantResolutionError (strict). Same UX as today's empty-context case.
- **Unknown but well-formed UUID:** middleware accepts it, queries return empty results. This is acceptable — a misconfigured mobile binary fails closed (no data leak), and the empty state is visible to the user.
- **Backend strict mode + no header:** middleware throws `TenantResolutionError`. The mobile binary always sends the header, so this only triggers if someone strips it manually (curl/Postman) — which is the desired behavior.

## Testing

### Backend
- Unit: extend `tenant-resolver.middleware.spec.ts` (5 new cases listed above).
- E2E: add 1 spec in `test/e2e/security/` — `mobile-public-tenant-header.e2e-spec.ts` — verifying:
  - public mobile request with `X-Org-Id` returns only that tenant's data
  - public mobile request with another tenant's `X-Org-Id` returns that tenant's data (proving header is honored)
  - authenticated request ignores `X-Org-Id` and uses JWT claim

### Mobile
- Unit: `services/api.spec.ts` — interceptor adds `X-Org-Id` to outgoing config.
- Manual QA: open app, verify departments shown match the customer tenant's departments in the dashboard (we just need them aligned — even if it's the default org's data right now).

### Manual QA (Kiwi sync afterwards)
- Open app: launcher shows "سواء للإرشاد الأسري" + custom icon.
- Open app on a fresh install: splash + first screen render correctly.
- Browse catalog: terminology shows family-consulting pack ("جلسة"/"مستفيد").
- Login as a client → JWT path still works.

## Operational

- **Local dev:** `npm run dev:mobile` works unchanged. The interceptor sends header to `localhost:5100`, backend resolves the default org.
- **Switching tenant:** set `EXPO_PUBLIC_TENANT_ID=<other-uuid>` in `.env.local` before `expo start`.
- **Production build (later phase):** same env var injected at EAS build time. No code changes needed.

## Migration / Rollout

1. Merge backend middleware change behind no flag — purely additive, default behavior unchanged.
2. Run `npm run seed:sawa --workspace=backend` once on local dev DB.
3. Drop the customer's icon into `apps/mobile/assets/sawa/icon.png`.
4. Apply the mobile changes (config.ts, api.ts, app.config.ts).
5. Run `npm run dev:mobile`, scan QR with Expo Go, verify name/icon (note: Expo Go won't show custom name/icon — that requires a development build with `expo run:ios` / `expo run:android`).
6. Manual QA + Kiwi sync.

## Out-of-Scope Follow-ups (tracked, not done here)

- **Logo inside the app** — customer hasn't provided yet. Placeholder retained until file lands. When it does, drop into `assets/sawa/logo.png` and reference from header components.
- **Custom splash for iOS/Android** — same as above.
- **Phase B (multi-tenant build pipeline):** EAS profiles, dynamic asset folder, CI hooks. Deferred until tenant #2.
- **Strict mode in dev:** continues to be `permissive` until SaaS-09 (subdomain resolver) lands.

## Files Touched

| File | Change |
|---|---|
| `apps/backend/src/common/tenant/tenant-resolver.middleware.ts` | +12 lines: public-route header acceptance |
| `apps/backend/src/common/tenant/tenant-resolver.middleware.spec.ts` | +5 test cases |
| `apps/backend/test/e2e/security/mobile-public-tenant-header.e2e-spec.ts` | new file |
| `apps/backend/prisma/seeds/sawa-customer.ts` | new file |
| `apps/backend/package.json` | +1 script: `seed:sawa` |
| `apps/mobile/constants/config.ts` | +1 export: `TENANT_ID`; update `APP_NAME` |
| `apps/mobile/services/api.ts` | +5 lines: tenant header interceptor |
| `apps/mobile/services/api.spec.ts` | new file (or extend existing) |
| `apps/mobile/app.json` | DELETED |
| `apps/mobile/app.config.ts` | new file (replaces app.json) |
| `apps/mobile/assets/sawa/icon.png` | new asset (customer-provided) |
| `apps/mobile/assets/sawa/*` | placeholder copies of existing CareKit assets |

Total: ~10 files, < 200 LoC change. Single PR, owner-only review (touches tenant resolver).
