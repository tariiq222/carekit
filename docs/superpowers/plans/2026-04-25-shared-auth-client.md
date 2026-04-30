# Shared Auth Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate duplication of auth API code across `apps/admin` and `apps/dashboard` by making `@deqah/api-client/auth` the single source of truth, with tests pinning the response contract.

**Scope:** This plan covers **admin + dashboard only**. Mobile (Expo + Axios + SecureStore) and a shared `<EmailPasswordFields/>` UI primitive ship in a separate plan to keep this one mergeable.

**Architecture:**
- The `@deqah/api-client` package already exposes `initClient(cfg)` + `apiRequest()` + a stub `modules/auth.ts`. We harden the auth module, fix `UserPayload` drift, and switch admin + dashboard to consume it.
- Dashboard keeps its `api.ts` wrapper (proxy paths + `ORG_SUSPENDED` handling) but the **auth functions themselves** come from the shared package — wrapper only resolves URLs.
- Tests live in `packages/api-client/src/modules/__tests__/auth.test.ts` and pin the contract (envelope unwrap, request shape, type surface).

**Tech Stack:** TypeScript strict, Vitest, NestJS contract (server returns `{success, data}` envelope), npm workspaces.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/api-client/src/types/auth.ts` (modify) | Canonical `UserPayload` + `AuthResponse` matching backend `/auth/login` response |
| `packages/api-client/src/modules/auth.ts` (modify) | `login`, `refreshToken`, `getMe`, `logout`, `changePassword` — all via shared `apiRequest` |
| `packages/api-client/src/modules/__tests__/auth.test.ts` (create) | Contract tests with mocked `fetch` |
| `packages/api-client/vitest.config.ts` (create if missing) | Vitest configuration |
| `apps/admin/features/auth/login/login.api.ts` (modify) | 19 lines → ~5 lines, delegates to `authApi.login` |
| `apps/dashboard/lib/api/auth.ts` (modify) | Replace inline `api.post('/auth/login', ...)` with `authApi.login(...)` |
| `apps/dashboard/lib/api.ts` (modify) | Wire `initClient` so `authApi` runs through the cookie proxy |

**Out of scope (separate plans):** `apps/mobile/services/auth.ts`, shared login UI primitive, `clientLogin/clientRegister` consolidation.

---

## Task 1: Inspect backend `/auth/login` response shape

**Files:**
- Read: `apps/backend/src/modules/identity/login/login.handler.ts`
- Read: `apps/backend/src/modules/identity/refresh-token/refresh-token.handler.ts`
- Read: `apps/backend/src/modules/identity/users/dto/user-response.dto.ts`

- [ ] **Step 1: Read each file and capture exact field names**

Run: `cat apps/backend/src/modules/identity/login/login.handler.ts`

Expected output: confirm the response contains `accessToken`, `refreshToken`, `expiresIn`, and a `user` object. Capture the exact user fields (id, email, role, name, organizationId, isSuperAdmin, …).

- [ ] **Step 2: Document findings inline in this plan**

Edit this file: under "Canonical UserPayload (from backend)" below, paste the exact field list discovered. **No guessing.**

**Canonical login response (from backend `apps/backend/src/api/public/auth.controller.ts:55-100`):**
```ts
// POST /auth/login → wrapped as { success: true, data: AuthResponse }
{
  accessToken: string,
  refreshToken: string,
  expiresIn: number,        // seconds
  user: {
    id: string,
    email: string,
    name: string,
    phone: string | null,
    gender: string | null,
    avatarUrl: string | null,
    isActive: boolean,
    role: string,
    customRoleId: string | null,
    customRole: { permissions: [...] } | null,
    createdAt: string,      // ISO
    updatedAt: string,
    isSuperAdmin: boolean,  // computed in controller
    permissions: string[],  // flattened in controller via flattenPermissions(user)
  }
}

// POST /auth/refresh → { success: true, data: { accessToken, refreshToken, expiresIn } } — NO user
// GET  /auth/me     → { success: true, data: <user shape above> }
```

**Note:** organizationId is NOT in the user object — it's only inside the JWT claims.

No commit yet — this is research.

---

## Task 2: Update canonical types in `@deqah/api-client`

**Files:**
- Modify: `packages/api-client/src/types/auth.ts`

- [ ] **Step 1: Replace `UserPayload` with the canonical shape**

Edit `packages/api-client/src/types/auth.ts`:

```typescript
// Canonical user payload returned by POST /auth/login, /auth/refresh, GET /auth/me.
// Fields here MUST match backend src/modules/identity/login/login.handler.ts.
export interface UserPayload {
  id: string
  email: string
  name: string
  phone: string | null
  gender: string | null
  role: string
  avatarUrl: string | null
  isActive: boolean
  organizationId: string | null
  isSuperAdmin?: boolean
  permissions?: string[]
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface AuthResponse extends TokenPair {
  user: UserPayload
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
}
```

> **Rule:** if Task 1 reveals fields not listed here, add them. If `nameAr`/`clinicId` are absent in backend, drop them.

- [ ] **Step 2: typecheck the package**

Run: `cd packages/api-client && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: typecheck the admin and dashboard**

Run: `npm run typecheck --workspace=apps/admin && npm run typecheck --workspace=apps/dashboard`
Expected: errors only on places that consumed the OLD `UserPayload` (clinicId, nameAr). These will be fixed in Task 5/6.

- [ ] **Step 4: Commit**

```bash
git add packages/api-client/src/types/auth.ts
git commit -m "refactor(api-client): align UserPayload with backend /auth/login response"
```

---

## Task 3: Add Vitest config + auth contract tests (TDD red)

**Files:**
- Create: `packages/api-client/vitest.config.ts`
- Create: `packages/api-client/src/modules/__tests__/auth.test.ts`

- [ ] **Step 1: Add vitest config**

Create `packages/api-client/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 2: Write failing contract tests**

Create `packages/api-client/src/modules/__tests__/auth.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initClient } from '../../client'
import * as authApi from '../auth'
import type { AuthResponse } from '../../types/auth'

const fakeAccess = 'access.jwt'
const fakeRefresh = 'refresh.jwt'

const fakeUser = {
  id: 'usr_1',
  email: 'admin@deqah.app',
  name: 'Admin',
  phone: null,
  gender: null,
  role: 'OWNER',
  avatarUrl: null,
  isActive: true,
  organizationId: 'org_1',
  isSuperAdmin: false,
  permissions: ['booking:read'],
}

const fakeAuth: AuthResponse = {
  accessToken: fakeAccess,
  refreshToken: fakeRefresh,
  expiresIn: 900,
  user: fakeUser,
}

let storedAccess: string | null = null
let storedRefresh: string | null = null
let onAuthFailure = vi.fn()

beforeEach(() => {
  storedAccess = null
  storedRefresh = null
  onAuthFailure = vi.fn()
  initClient({
    baseUrl: 'http://api.test',
    getAccessToken: () => storedAccess,
    getRefreshToken: () => storedRefresh,
    onTokenRefreshed: (a, r) => {
      storedAccess = a
      storedRefresh = r
    },
    onAuthFailure,
  })
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function mockJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('authApi.login', () => {
  it('POSTs /auth/login with email+password and unwraps {success,data} envelope', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({ success: true, data: fakeAuth }),
    )

    const result = await authApi.login({
      email: 'admin@deqah.app',
      password: 'pw',
    })

    expect(result).toEqual(fakeAuth)

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('http://api.test/auth/login')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({
      email: 'admin@deqah.app',
      password: 'pw',
    })
  })

  it('also accepts a flat (non-enveloped) response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJsonResponse(fakeAuth))

    const result = await authApi.login({
      email: 'a@b.c',
      password: 'pw',
    })

    expect(result).toEqual(fakeAuth)
  })

  it('throws ApiError with status + message on failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({ message: 'Bad credentials' }, 401),
    )

    await expect(
      authApi.login({ email: 'a@b.c', password: 'wrong' }),
    ).rejects.toMatchObject({ status: 401, message: 'Bad credentials' })
  })
})

describe('authApi.refreshToken', () => {
  it('POSTs /auth/refresh with the refresh token in body and returns a TokenPair (no user)', async () => {
    const fakeTokenPair = {
      accessToken: 'new.access',
      refreshToken: 'new.refresh',
      expiresIn: 900,
    }
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({ success: true, data: fakeTokenPair }),
    )

    const result = await authApi.refreshToken('old.refresh')

    expect(result).toEqual(fakeTokenPair)
    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect(JSON.parse(init?.body as string)).toEqual({
      refreshToken: 'old.refresh',
    })
  })
})

describe('authApi.getMe', () => {
  it('GETs /auth/me with bearer token from getAccessToken()', async () => {
    storedAccess = fakeAccess
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({ success: true, data: fakeUser }),
    )

    const me = await authApi.getMe()

    expect(me).toEqual(fakeUser)
    const [, init] = vi.mocked(fetch).mock.calls[0]
    const headers = init?.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${fakeAccess}`)
  })
})

describe('authApi.logout', () => {
  it('POSTs /auth/logout (no body required)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))

    await authApi.logout()

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('http://api.test/auth/logout')
    expect(init?.method).toBe('POST')
  })
})

describe('authApi.changePassword', () => {
  it('PATCHes /auth/password/change with current+new password', async () => {
    storedAccess = fakeAccess
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))

    await authApi.changePassword({
      currentPassword: 'old',
      newPassword: 'new',
    })

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('http://api.test/auth/password/change')
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(init?.body as string)).toEqual({
      currentPassword: 'old',
      newPassword: 'new',
    })
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/api-client && npx vitest run`
Expected: failure — `changePassword` does not exist on `authApi`. Other tests should pass against the existing module (login/refresh/logout/getMe).

- [ ] **Step 4: Commit (red)**

```bash
git add packages/api-client/vitest.config.ts packages/api-client/src/modules/__tests__/auth.test.ts
git commit -m "test(api-client): add auth module contract tests"
```

---

## Task 4: Implement `changePassword` + harden `authApi` (TDD green)

**Files:**
- Modify: `packages/api-client/src/modules/auth.ts`

- [ ] **Step 1: Add `changePassword` and import `ChangePasswordPayload`**

Replace `packages/api-client/src/modules/auth.ts` with:

```typescript
import { apiRequest } from '../client'
import type {
  AuthResponse,
  ChangePasswordPayload,
  TokenPair,
  UserPayload,
} from '../types/auth'

export interface LoginPayload {
  email: string
  password: string
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function refreshToken(token: string): Promise<TokenPair> {
  return apiRequest<TokenPair>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: token }),
  })
}

export async function logout(): Promise<void> {
  return apiRequest<void>('/auth/logout', { method: 'POST' })
}

export async function getMe(): Promise<UserPayload> {
  return apiRequest<UserPayload>('/auth/me')
}

export async function changePassword(
  payload: ChangePasswordPayload,
): Promise<void> {
  return apiRequest<void>('/auth/password/change', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export type { TokenPair, AuthResponse, UserPayload, ChangePasswordPayload }
```

> Note: `refreshToken` returns `TokenPair` only (NO user) — backend confirmed in Task 1.

- [ ] **Step 2: Run tests**

Run: `cd packages/api-client && npx vitest run`
Expected: PASS for all 7 tests.

- [ ] **Step 3: typecheck**

Run: `cd packages/api-client && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add packages/api-client/src/modules/auth.ts
git commit -m "feat(api-client): add changePassword + return AuthResponse from refreshToken"
```

---

## Task 5: Migrate `apps/admin` login to shared `authApi`

**Files:**
- Modify: `apps/admin/features/auth/login/login.api.ts`
- Read: `apps/admin/features/auth/login/use-login.ts` (sanity check consumers)

- [ ] **Step 1: Replace `login.api.ts`**

Replace `apps/admin/features/auth/login/login.api.ts` entirely with:

```typescript
import { authApi } from '@deqah/api-client'
import type { AuthResponse, LoginPayload } from '@deqah/api-client'

export type LoginRequest = LoginPayload
export type LoginResponse = AuthResponse

export function login(body: LoginRequest): Promise<LoginResponse> {
  return authApi.login(body)
}
```

> The shared client already routes through admin's proxy because `apps/admin/lib/api-client.ts` calls `initClient({ baseUrl: '' })` and admin endpoints use `/api/proxy/admin/*` rewrites. **But `/auth/login` is a public endpoint** — the bare `apiRequest` call will hit `/auth/login` which the Next rewrite must forward to `/api/v1/auth/login`. Verify in Step 3.

- [ ] **Step 2: Verify the LoginPayload export exists**

Run: `grep -n "LoginPayload" packages/api-client/src/index.ts`

If missing, add to `packages/api-client/src/index.ts`:
```typescript
export type { LoginPayload } from './modules/auth'
```

- [ ] **Step 3: Verify the rewrite covers `/auth/*`**

Read: `apps/admin/next.config.mjs`
Expected: a rewrite from `/auth/:path*` (or `/api/proxy/auth/:path*`) to `${BACKEND_URL}/api/v1/auth/:path*`. If not, add it. Show the exact diff in the commit message.

- [ ] **Step 4: typecheck + lint**

Run:
```bash
cd apps/admin && npm run typecheck && npm run lint
```
Expected: 0 errors. The `LoginResponse.user.isSuperAdmin?` type works because canonical `UserPayload.isSuperAdmin` is optional.

- [ ] **Step 5: Manual smoke test**

```bash
npm run dev:backend     # background
npm run dev:admin       # background
```
Open `http://localhost:5104/login`, sign in with seeded super-admin. Expected: redirect to `/`. If 404 on `/auth/login`, the rewrite is wrong (Step 3).

- [ ] **Step 6: Commit**

```bash
git add apps/admin/features/auth/login/login.api.ts \
        packages/api-client/src/index.ts \
        $(git diff --name-only apps/admin/next.config.mjs 2>/dev/null)
git commit -m "refactor(admin): consume @deqah/api-client/authApi for login"
```

---

## Task 6: Migrate `apps/dashboard` auth to shared `authApi` (with cookie proxy)

The dashboard is harder because:
- It uses a same-origin proxy `/api/proxy` for cookie-bearing endpoints (login/logout/refresh).
- It handles `ORG_SUSPENDED` 401s specially.
- Its own `lib/api.ts` exposes `setAccessToken` / `getAccessToken` used across many feature files — we cannot delete it.

**Strategy:** wire the shared `apiRequest` *behind* the existing `lib/api.ts` for auth endpoints only, leaving feature endpoints untouched. Step 7 of this task is the verification gate.

**Files:**
- Modify: `apps/dashboard/lib/api.ts` (wire `initClient` so `authApi` uses the same in-memory access token + proxy URL resolver)
- Modify: `apps/dashboard/lib/api/auth.ts` (delegate `login`/`refreshToken`/`fetchMe`/`logoutApi`/`changePassword` to `authApi`)

- [ ] **Step 1: Wire `initClient` in `apps/dashboard/lib/api.ts`**

Add at the top of `apps/dashboard/lib/api.ts` (after the existing imports), and **before** the existing `api` export:

```typescript
import { initClient } from '@deqah/api-client'

// Initialise the shared @deqah/api-client so authApi calls travel through
// the same in-memory access token and same-origin /api/proxy used by the
// dashboard's local fetch wrapper above.
if (typeof window !== 'undefined') {
  initClient({
    baseUrl: '', // resolveUrl below prepends /api/proxy or API_BASE_URL per endpoint
    getAccessToken: () => accessToken,
    getRefreshToken: () => localStorage.getItem('deqah_refresh_token'),
    onTokenRefreshed: (a, r) => {
      setAccessToken(a)
      if (r) localStorage.setItem('deqah_refresh_token', r)
    },
    onAuthFailure: () => {
      clearAuthState()
    },
  })
}
```

> The shared `apiRequest` will call `fetch('${baseUrl}${path}')` with `path = '/auth/login'`. The dashboard's Next dev server already proxies `/auth/*` to backend through `next.config.mjs` rewrites — verify in next step.

- [ ] **Step 2: Verify `/auth/*` rewrite exists in dashboard**

Read: `apps/dashboard/next.config.mjs`. Expected: a rewrite that forwards `/auth/:path*` (or `/api/proxy/auth/:path*`) to backend. If absent, add it:

```javascript
{
  source: '/auth/:path*',
  destination: `${process.env.BACKEND_URL ?? 'http://localhost:5100'}/api/v1/auth/:path*`,
},
```

- [ ] **Step 3: Refactor `apps/dashboard/lib/api/auth.ts`**

Replace the body (preserve the public exports `login`, `fetchMe`, `refreshToken`, `logoutApi`, `logout`, `changePassword`, `getStoredUser`, `isAuthenticated`, types `AuthUser`, `AuthResponse`):

```typescript
/**
 * Auth API — Deqah Dashboard
 * Thin wrapper over @deqah/api-client/authApi. The shared package owns
 * request shape, envelope unwrapping, and 401 refresh; this file only adds
 * persist/clear local-storage helpers + dashboard-specific aliases.
 */

import { authApi } from '@deqah/api-client'
import type { AuthResponse, UserPayload } from '@deqah/api-client'
import { setAccessToken, getAccessToken } from '@/lib/api'

export type AuthUser = UserPayload
export type { AuthResponse }

const USER_KEY = 'deqah_user'
const REFRESH_KEY = 'deqah_refresh_token'

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const data = await authApi.login({ email, password })
  persistAuth(data)
  return data
}

export async function fetchMe(): Promise<AuthUser> {
  const data = await authApi.getMe()
  localStorage.setItem(USER_KEY, JSON.stringify(data))
  return data
}

export async function refreshToken(): Promise<AuthResponse> {
  const stored = typeof window !== 'undefined'
    ? localStorage.getItem(REFRESH_KEY)
    : null
  if (!stored) throw new Error('No refresh token')

  const data = await authApi.refreshToken(stored)
  setAccessToken(data.accessToken)
  if (data.refreshToken) localStorage.setItem(REFRESH_KEY, data.refreshToken)
  return data
}

export async function logoutApi(): Promise<void> {
  try {
    await authApi.logout()
  } catch {
    // Ignore — clear local state regardless
  }
  clearAuth()
}

export function logout(): void {
  clearAuth()
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await authApi.changePassword({ currentPassword, newPassword })
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function isAuthenticated(): boolean {
  return !!getAccessToken()
}

function persistAuth(data: AuthResponse): void {
  localStorage.setItem(USER_KEY, JSON.stringify(data.user))
  setAccessToken(data.accessToken)
  if (data.refreshToken) localStorage.setItem(REFRESH_KEY, data.refreshToken)
}

function clearAuth(): void {
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(REFRESH_KEY)
  setAccessToken(null)
}
```

- [ ] **Step 4: Update existing dashboard auth tests**

Run: `cd apps/dashboard && npx vitest run test/unit/lib/auth-api.spec.ts`

If failures: tests probably mocked the inline `api.post('/auth/login', ...)` call. Update mocks to stub `@deqah/api-client` instead:

```typescript
import * as authApi from '@deqah/api-client/auth'
vi.spyOn(authApi, 'login').mockResolvedValue(fakeAuthResponse)
```

(Show the exact diff to whichever spec needs it — do not invent test cases the file does not have.)

- [ ] **Step 5: Run typecheck + lint + i18n parity**

```bash
cd apps/dashboard && npm run typecheck && npm run lint && npm run i18n:verify
```
Expected: 0 errors.

- [ ] **Step 6: Manual smoke test through Chrome DevTools MCP**

Per dashboard/CLAUDE.md, dashboard QA is via Chrome DevTools MCP. Cover:
1. Login with valid creds → redirect to `/`
2. Refresh page → still authenticated (refresh-token flow ran)
3. Logout → redirect to login screen
4. Login with bad creds → toast shows error
5. ORG_SUSPENDED simulation (suspend org via admin) → AuthGate shows banner

Document outcomes in `docs/superpowers/qa/auth-shared-client-<date>.md`.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/lib/api.ts apps/dashboard/lib/api/auth.ts \
        $(git diff --name-only apps/dashboard/next.config.mjs 2>/dev/null) \
        $(git diff --name-only apps/dashboard/test/ 2>/dev/null)
git commit -m "refactor(dashboard): consume @deqah/api-client/authApi for auth flows"
```

---

## Task 7: Final verification

- [ ] **Step 1: Run all workspace tests**

```bash
npm run test --workspace=packages/api-client
npm run test --workspace=apps/dashboard
npm run test --workspace=apps/admin
```
Expected: all green.

- [ ] **Step 2: Build all affected workspaces**

```bash
npm run build --workspace=packages/api-client
npm run build --workspace=apps/dashboard
npm run build --workspace=apps/admin
```
Expected: 0 errors.

- [ ] **Step 3: Confirm duplication actually went down**

```bash
wc -l apps/admin/features/auth/login/login.api.ts \
      apps/dashboard/lib/api/auth.ts
```
Expected: admin file ≤10 lines (was 19). Dashboard file ≤95 lines (was 119) AND no inline `fetch`/`api.post('/auth/...')` calls.

- [ ] **Step 4: Open PR**

Title: `refactor: unify admin+dashboard auth on @deqah/api-client`
Body: link this plan; include line-count diff; note mobile + UI primitive deferred to follow-up plan.

---

## Out of Scope (Follow-up plans)

1. **`apps/mobile/services/auth.ts`** — uses Axios + Expo SecureStore + Redux. The shared package would need a `createAuthClient({ storage })` adapter pattern. Separate plan: `2026-04-26-mobile-auth-on-shared-client.md`.
2. **Shared `<EmailPasswordFields/>`** UI primitive in `@deqah/ui` for admin + dashboard login screens (saves ~80 lines × 2). Separate plan when design tokens for the admin LTR screen are settled.
3. **`clientLogin` / `clientRegister`** consolidation — public client auth flow used by mobile + website. Already partially extracted into `modules/client-auth.ts`; needs the same TDD treatment as `authApi` here.
