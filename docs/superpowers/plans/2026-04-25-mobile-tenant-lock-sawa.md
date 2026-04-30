# Mobile Tenant-Lock — سواء للإرشاد الأسري — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock the Deqah mobile app to a single hard-coded tenant via `X-Org-Id` header, rebrand the app's launcher identity to "سواء للإرشاد الأسري", and seed the dev tenant as a family-consulting org.

**Architecture:** Backend `TenantResolverMiddleware` gains a new resolution step that accepts `X-Org-Id` only on unauthenticated public routes (JWT still wins on authenticated). Mobile sends the header on every request via an Axios interceptor. App identity (name, icon, bundle ID) is set in `app.config.ts`. Customer's vertical/name applied via an idempotent seed script.

**Tech Stack:** NestJS 11 + Express middleware, Prisma 7 (PostgreSQL), Jest (unit + e2e); Expo SDK 55 + React Native 0.83, Axios, TypeScript strict.

**Spec:** [docs/superpowers/specs/2026-04-25-mobile-tenant-lock-sawa-design.md](../specs/2026-04-25-mobile-tenant-lock-sawa-design.md)

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `apps/backend/src/common/tenant/tenant-resolver.middleware.ts` | Resolve org for the request, populate CLS | Modify (+~25 LoC) |
| `apps/backend/src/common/tenant/tenant-resolver.middleware.spec.ts` | Unit-test middleware | Modify (+5 cases) |
| `apps/backend/test/e2e/security/mobile-public-tenant-header.e2e-spec.ts` | E2E proof header is honored on public, ignored on authenticated | Create |
| `apps/backend/prisma/seeds/sawa-customer.ts` | Idempotent seed: relabel default org as Sawa, link to family-consulting vertical | Create |
| `apps/backend/package.json` | Add `seed:sawa` script | Modify (+1 line) |
| `apps/mobile/constants/config.ts` | Export `TENANT_ID`, update `APP_NAME` | Modify (+~5 LoC) |
| `apps/mobile/services/api.ts` | Add request interceptor for `X-Org-Id` | Modify (+~5 LoC) |
| `apps/mobile/services/api.test.ts` | Unit-test interceptor | Create |
| `apps/mobile/app.json` | Replaced by app.config.ts | Delete |
| `apps/mobile/app.config.ts` | Expo dynamic config — name, icon, bundle | Create |
| `apps/mobile/assets/sawa/icon.png` | Customer-provided launcher icon | Add (manual drop, blocking step) |
| `apps/mobile/assets/sawa/splash.png` | Splash placeholder (copy of Deqah until customer provides) | Add |
| `apps/mobile/assets/sawa/android-icon-*.png` | Android adaptive icon (placeholder copies) | Add |

Total: 6 modified, 6+ created/added, 1 deleted. Single PR.

---

## Task 1: Backend — Add public-route check helper

**Files:**
- Modify: `apps/backend/src/common/tenant/tenant-resolver.middleware.ts`

This task adds two pure helpers (route classifier + UUID parser) to the middleware **without** wiring them into the resolution priority yet. Pure additions, no behavior change. Lets us unit-test them in isolation in Task 2 before hooking them up in Task 3.

- [ ] **Step 1: Add the two helpers as private methods on the class**

Add inside `TenantResolverMiddleware` class, immediately after the constructor:

```ts
  /**
   * Public mobile routes that may resolve their tenant from the X-Org-Id
   * header. Webhook routes are excluded — they have their own system-context
   * resolution flow (see SaaS-02e moyasar-webhook).
   */
  private isPublicRoute(path: string): boolean {
    if (!path.startsWith('/api/v1/public/')) return false;
    if (path.includes('/webhooks/')) return false;
    return true;
  }

  /**
   * Validates a header value as a well-formed UUID (RFC 4122, any version
   * including the all-zero placeholder used as DEFAULT_ORGANIZATION_ID).
   * Returns the trimmed value when valid, undefined otherwise.
   */
  private parseUuidHeader(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      trimmed,
    )
      ? trimmed
      : undefined;
  }
```

- [ ] **Step 2: Run typecheck to confirm clean compile**

Run: `cd apps/backend && npm run typecheck`
Expected: PASS, no errors.

- [ ] **Step 3: Run existing middleware tests, confirm still green**

Run: `cd apps/backend && npx jest src/common/tenant/tenant-resolver.middleware.spec.ts`
Expected: All 6 existing tests PASS (helpers are private + unused, so no behavior change).

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/common/tenant/tenant-resolver.middleware.ts
git commit -m "feat(tenant): add public-route + uuid header helpers (unused)"
```

---

## Task 2: Backend — Test the new helpers in isolation

**Files:**
- Modify: `apps/backend/src/common/tenant/tenant-resolver.middleware.spec.ts`

We expose the helpers via a small test trick (cast to `any` to call private methods) since this codebase already uses Jest without prototype-pollution wrappers.

- [ ] **Step 1: Write failing tests for `isPublicRoute`**

Add at the bottom of the existing `describe('TenantResolverMiddleware', ...)` block, just before the closing `});`:

```ts
  describe('isPublicRoute()', () => {
    let mw: TenantResolverMiddleware;
    beforeEach(async () => {
      mw = await build({ TENANT_ENFORCEMENT: 'permissive' });
    });

    it('accepts /api/v1/public/* paths', () => {
      expect((mw as unknown as { isPublicRoute(p: string): boolean }).isPublicRoute('/api/v1/public/services/departments')).toBe(true);
    });

    it('rejects authenticated paths', () => {
      expect((mw as unknown as { isPublicRoute(p: string): boolean }).isPublicRoute('/api/v1/dashboard/bookings')).toBe(false);
    });

    it('rejects /api/v1/public/sms/webhooks/* (webhooks self-resolve)', () => {
      expect((mw as unknown as { isPublicRoute(p: string): boolean }).isPublicRoute('/api/v1/public/sms/webhooks/unifonic/org-1')).toBe(false);
    });
  });

  describe('parseUuidHeader()', () => {
    let mw: TenantResolverMiddleware;
    beforeEach(async () => {
      mw = await build({ TENANT_ENFORCEMENT: 'permissive' });
    });

    const parse = (v: unknown) =>
      (mw as unknown as { parseUuidHeader(v: unknown): string | undefined }).parseUuidHeader(v);

    it('accepts well-formed UUID', () => {
      expect(parse('550e8400-e29b-41d4-a716-446655440000')).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('accepts the all-zero DEFAULT_ORGANIZATION_ID', () => {
      expect(parse('00000000-0000-0000-0000-000000000001')).toBe('00000000-0000-0000-0000-000000000001');
    });

    it('rejects non-string values', () => {
      expect(parse(undefined)).toBeUndefined();
      expect(parse(123)).toBeUndefined();
      expect(parse(null)).toBeUndefined();
    });

    it('rejects malformed UUIDs', () => {
      expect(parse('not-a-uuid')).toBeUndefined();
      expect(parse('550e8400-e29b-41d4-a716')).toBeUndefined();
      expect(parse('550e8400e29b41d4a716446655440000')).toBeUndefined();
    });

    it('trims whitespace', () => {
      expect(parse('  550e8400-e29b-41d4-a716-446655440000  ')).toBe('550e8400-e29b-41d4-a716-446655440000');
    });
  });
```

- [ ] **Step 2: Run the new tests, expect them to PASS (helpers exist from Task 1)**

Run: `cd apps/backend && npx jest src/common/tenant/tenant-resolver.middleware.spec.ts`
Expected: ALL tests PASS (6 original + 8 new = 14).

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/common/tenant/tenant-resolver.middleware.spec.ts
git commit -m "test(tenant): cover public-route + uuid header helpers"
```

---

## Task 3: Backend — Wire the new resolution step into the priority chain

**Files:**
- Modify: `apps/backend/src/common/tenant/tenant-resolver.middleware.ts`

Now we connect the helpers into the priority order:
**JWT → super-admin header → public-route header (NEW) → DEFAULT (permissive) → throw (strict)**.

- [ ] **Step 1: Update the resolution block**

Find the existing block that computes `fromJwt`, `fromHeader`, `fromDefault`. Replace it with:

```ts
    // Priority:
    //   1. JWT claim (authenticated users)
    //   2. X-Org-Id header (super-admins only — never trusted from regular users)
    //   3. X-Org-Id header on UNAUTHENTICATED public routes (mobile tenant-lock)
    //   4. Subdomain resolver (added in Plan 09)
    //   5. DEFAULT_ORGANIZATION_ID (permissive mode only)
    const fromJwt = req.user?.organizationId;
    const fromSuperAdminHeader =
      req.user?.isSuperAdmin === true
        ? this.parseUuidHeader(req.headers['x-org-id'])
        : undefined;
    const fromPublicHeader =
      !req.user && this.isPublicRoute(req.path ?? req.url ?? '')
        ? this.parseUuidHeader(req.headers['x-org-id'])
        : undefined;
    const fromDefault =
      mode === 'permissive'
        ? this.config.get<string>('DEFAULT_ORGANIZATION_ID', DEFAULT_ORGANIZATION_ID)
        : undefined;

    const organizationId =
      fromJwt ?? fromSuperAdminHeader ?? fromPublicHeader ?? fromDefault;
```

The original code referenced `fromHeader` once below; rename that reference accordingly. The `if (!organizationId) throw new TenantResolutionError(...)` line stays unchanged.

- [ ] **Step 2: Add `path` field to the test `req()` helper**

The existing test helper (`tenant-resolver.middleware.spec.ts:30-37`) doesn't pass `path`. Update its type signature so new tests can override it:

```ts
  const req = (
    overrides: Partial<{
      user: unknown;
      headers: Record<string, unknown>;
      hostname: string;
      path: string;
      url: string;
    }> = {},
  ) =>
    ({
      user: undefined,
      headers: {},
      hostname: 'localhost',
      path: '/api/v1/dashboard/bookings',
      url: '/api/v1/dashboard/bookings',
      ...overrides,
    }) as never;
```

This sets a sensible default path (`/dashboard/bookings`) for existing tests so they continue to behave as before — a non-public route. The existing 6 cases assume no public-header resolution, which still holds.

- [ ] **Step 3: Run all existing middleware tests, confirm still green**

Run: `cd apps/backend && npx jest src/common/tenant/tenant-resolver.middleware.spec.ts`
Expected: 14 tests PASS (no regressions).

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/common/tenant/tenant-resolver.middleware.ts \
        apps/backend/src/common/tenant/tenant-resolver.middleware.spec.ts
git commit -m "feat(tenant): honor X-Org-Id on unauthenticated public routes"
```

---

## Task 4: Backend — Unit tests for the new resolution step

**Files:**
- Modify: `apps/backend/src/common/tenant/tenant-resolver.middleware.spec.ts`

- [ ] **Step 1: Add 5 new behavior cases**

Append to the main `describe` block, before the helper-method `describe` blocks added in Task 2:

```ts
  describe('public-route X-Org-Id resolution', () => {
    const VALID = '550e8400-e29b-41d4-a716-446655440000';

    it('strict mode: accepts X-Org-Id on unauthenticated public route', async () => {
      const mw = await build({ TENANT_ENFORCEMENT: 'strict' });
      await new Promise<void>((done) => {
        cls.run(() =>
          mw.use(
            req({
              path: '/api/v1/public/services/departments',
              headers: { 'x-org-id': VALID },
            }),
            {} as never,
            () => {
              expect(ctx.getOrganizationId()).toBe(VALID);
              done();
            },
          ),
        );
      });
    });

    it('strict mode: ignores X-Org-Id on authenticated public route (JWT wins)', async () => {
      const mw = await build({ TENANT_ENFORCEMENT: 'strict' });
      await new Promise<void>((done) => {
        cls.run(() =>
          mw.use(
            req({
              user: { id: 'u1', organizationId: 'org-jwt', membershipId: 'm1', role: 'CLIENT' },
              path: '/api/v1/public/services/departments',
              headers: { 'x-org-id': VALID },
            }),
            {} as never,
            () => {
              expect(ctx.getOrganizationId()).toBe('org-jwt');
              done();
            },
          ),
        );
      });
    });

    it('strict mode: ignores X-Org-Id on private route when unauthenticated (throws)', async () => {
      const mw = await build({ TENANT_ENFORCEMENT: 'strict' });
      expect(() =>
        cls.run(() =>
          mw.use(
            req({
              path: '/api/v1/dashboard/bookings',
              headers: { 'x-org-id': VALID },
            }),
            {} as never,
            () => undefined,
          ),
        ),
      ).toThrow(TenantResolutionError);
    });

    it('strict mode: ignores invalid UUID, throws (no fallback)', async () => {
      const mw = await build({ TENANT_ENFORCEMENT: 'strict' });
      expect(() =>
        cls.run(() =>
          mw.use(
            req({
              path: '/api/v1/public/services/departments',
              headers: { 'x-org-id': 'not-a-uuid' },
            }),
            {} as never,
            () => undefined,
          ),
        ),
      ).toThrow(TenantResolutionError);
    });

    it('strict mode: ignores X-Org-Id on /webhooks/ public route', async () => {
      const mw = await build({ TENANT_ENFORCEMENT: 'strict' });
      expect(() =>
        cls.run(() =>
          mw.use(
            req({
              path: '/api/v1/public/sms/webhooks/unifonic/org-1',
              headers: { 'x-org-id': VALID },
            }),
            {} as never,
            () => undefined,
          ),
        ),
      ).toThrow(TenantResolutionError);
    });
  });
```

- [ ] **Step 2: Run tests, expect all PASS**

Run: `cd apps/backend && npx jest src/common/tenant/tenant-resolver.middleware.spec.ts`
Expected: 19 PASS (14 from before + 5 new).

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/common/tenant/tenant-resolver.middleware.spec.ts
git commit -m "test(tenant): cover public-route X-Org-Id behavior"
```

---

## Task 5: Backend — E2E test (real HTTP path through middleware)

**Files:**
- Create: `apps/backend/test/e2e/security/mobile-public-tenant-header.e2e-spec.ts`

This test boots the real Nest app over supertest and verifies the header is honored end-to-end on a real public catalog endpoint.

- [ ] **Step 1: Inspect harness conventions**

Run: `cat apps/backend/test/e2e/security/harness.ts | head -60`
Expected: shows the helpers used by the existing 4 specs (`bootstrapApp`, tenant creation, etc.). Reuse these — don't reinvent.

- [ ] **Step 2: Write the failing E2E spec**

Create `apps/backend/test/e2e/security/mobile-public-tenant-header.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapTestApp, createTestOrg, type TestOrg } from './harness';

describe('Mobile public tenant header (X-Org-Id)', () => {
  let app: INestApplication;
  let orgA: TestOrg;
  let orgB: TestOrg;

  beforeAll(async () => {
    app = await bootstrapTestApp();
    orgA = await createTestOrg({ slug: 'mobile-hdr-a' });
    orgB = await createTestOrg({ slug: 'mobile-hdr-b' });
    // Each org's createTestOrg helper seeds 1 active department by default.
  });

  afterAll(async () => {
    await app.close();
  });

  it('public route: X-Org-Id resolves to that tenant', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/public/services/departments')
      .set('X-Org-Id', orgA.id)
      .expect(200);

    const body = res.body as { data: Array<{ id: string }> };
    expect(body.data.length).toBeGreaterThan(0);
    // every department returned belongs to org A — never org B
    expect(body.data.every((d) => d.id !== undefined)).toBe(true);
  });

  it('public route: different X-Org-Id returns a different result set', async () => {
    const aRes = await request(app.getHttpServer())
      .get('/api/v1/public/services/departments')
      .set('X-Org-Id', orgA.id)
      .expect(200);

    const bRes = await request(app.getHttpServer())
      .get('/api/v1/public/services/departments')
      .set('X-Org-Id', orgB.id)
      .expect(200);

    const aIds = (aRes.body as { data: Array<{ id: string }> }).data.map((d) => d.id);
    const bIds = (bRes.body as { data: Array<{ id: string }> }).data.map((d) => d.id);
    // Disjoint sets — no department appears under both
    expect(aIds.some((id) => bIds.includes(id))).toBe(false);
  });

  it('public route: invalid UUID falls through (permissive default org)', async () => {
    // In test mode default is permissive → falls back to DEFAULT_ORGANIZATION_ID
    await request(app.getHttpServer())
      .get('/api/v1/public/services/departments')
      .set('X-Org-Id', 'not-a-uuid')
      .expect(200);
  });
});
```

- [ ] **Step 3: Run E2E**

Run: `cd apps/backend && npx jest --config test/jest-e2e.json mobile-public-tenant-header`
Expected: 3 PASS.

If the harness signature differs (`createTestOrg` may have different args), adjust to match the existing patterns in `cross-tenant-penetration.e2e-spec.ts`. Do NOT change the harness itself.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/test/e2e/security/mobile-public-tenant-header.e2e-spec.ts
git commit -m "test(e2e): mobile X-Org-Id honored on public, isolated per tenant"
```

---

## Task 6: Backend — Sawa customer seed script

**Files:**
- Create: `apps/backend/prisma/seeds/sawa-customer.ts`
- Modify: `apps/backend/package.json`

- [ ] **Step 1: Create the seed script**

`apps/backend/prisma/seeds/sawa-customer.ts`:

```ts
/**
 * One-time idempotent seed: relabel the dev DEFAULT_ORGANIZATION as
 * "سواء للإرشاد الأسري" and link it to the family-consulting vertical.
 *
 * Run:  npm run seed:sawa --workspace=backend
 * Safe to re-run.
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  await prisma.$connect();

  const vertical = await prisma.vertical.findUnique({
    where: { slug: 'family-consulting' },
  });
  if (!vertical) {
    throw new Error(
      'Vertical "family-consulting" not found. Run base seeds first (npm run seed).',
    );
  }

  const updated = await prisma.organization.update({
    where: { id: DEFAULT_ORG_ID },
    data: {
      nameAr: 'سواء للإرشاد الأسري',
      nameEn: 'Sawa Family Counseling',
      slug: 'sawa',
      verticalId: vertical.id,
    },
  });

  console.log('✓ Updated organization:', {
    id: updated.id,
    nameAr: updated.nameAr,
    slug: updated.slug,
    verticalId: updated.verticalId,
  });

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add the npm script**

Open `apps/backend/package.json`. Find the `"scripts"` block; locate the existing `"seed": "tsx prisma/seed.ts"` line. Add immediately after it:

```json
    "seed:sawa": "tsx prisma/seeds/sawa-customer.ts",
```

(Mind the trailing comma — the next line should still be valid JSON.)

- [ ] **Step 3: Run the seed against dev DB**

Run: `cd apps/backend && npm run seed:sawa`
Expected: stdout shows `✓ Updated organization: { id: '00000000-...', nameAr: 'سواء للإرشاد الأسري', slug: 'sawa', verticalId: '...' }`

- [ ] **Step 4: Verify in DB**

Run:
```bash
docker exec deqah-postgres psql -U deqah -d deqah_dev -c \
  "SELECT o.\"nameAr\", o.slug, v.slug AS vertical FROM \"Organization\" o LEFT JOIN \"Vertical\" v ON v.id = o.\"verticalId\" WHERE o.id = '00000000-0000-0000-0000-000000000001';"
```
Expected: row showing `سواء للإرشاد الأسري | sawa | family-consulting`.

- [ ] **Step 5: Run again to confirm idempotency**

Run: `cd apps/backend && npm run seed:sawa`
Expected: same successful output, no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/prisma/seeds/sawa-customer.ts apps/backend/package.json
git commit -m "feat(seed): sawa customer seed (relabel default org to family-consulting)"
```

---

## Task 7: Mobile — Add `TENANT_ID` constant

**Files:**
- Modify: `apps/mobile/constants/config.ts`

- [ ] **Step 1: Update the file**

Replace the contents of `apps/mobile/constants/config.ts` with:

```ts
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

/**
 * The tenant this binary is locked to. Defaults to dev DEFAULT_ORGANIZATION_ID.
 * Override per-environment via EXPO_PUBLIC_TENANT_ID. Sent as the X-Org-Id
 * header on every API call by services/api.ts.
 */
export const TENANT_ID =
  process.env.EXPO_PUBLIC_TENANT_ID ?? '00000000-0000-0000-0000-000000000001';

export const APP_NAME = 'سواء للإرشاد الأسري';
export const APP_SCHEME = 'sawa';

export const DEFAULT_LANGUAGE = 'ar';
export const SUPPORTED_LANGUAGES = ['ar', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
```

- [ ] **Step 2: Run mobile typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: PASS (no callers of `APP_SCHEME` should break — value change only).

If any code depends on the literal `'deqah'` for scheme, leave a TODO and surface it; don't fix in this task. Search:

```bash
grep -rn "'deqah'" apps/mobile/ --include='*.ts' --include='*.tsx' | grep -v node_modules
```

If matches found that aren't telemetry/analytics constants, list them in the commit body.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/constants/config.ts
git commit -m "feat(mobile): add TENANT_ID constant + rebrand APP_NAME to Sawa"
```

---

## Task 8: Mobile — Axios interceptor sends `X-Org-Id`

**Files:**
- Modify: `apps/mobile/services/api.ts`
- Create: `apps/mobile/services/api.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/services/api.test.ts`:

```ts
import api from './api';
import { TENANT_ID } from '@/constants/config';

describe('api interceptor', () => {
  it('attaches X-Org-Id header from TENANT_ID constant', async () => {
    // Run all request interceptors against a synthetic config — they're
    // chained, so we replay them in order.
    let config: any = { headers: { set(this: any, k: string, v: string) { this[k] = v; } } };
    // axios stores interceptors in handlers array; AxiosHeaders is array-like
    // but supports plain object access too.
    config.headers = { ...config.headers };
    const handlers = (api.interceptors.request as any).handlers as Array<{
      fulfilled: (c: any) => Promise<any> | any;
    }>;
    for (const h of handlers) {
      if (h && typeof h.fulfilled === 'function') {
        config = await h.fulfilled(config);
      }
    }
    expect(config.headers['X-Org-Id']).toBe(TENANT_ID);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd apps/mobile && npx jest services/api.test.ts`
Expected: FAIL — header not set yet.

- [ ] **Step 3: Add the interceptor**

Open `apps/mobile/services/api.ts`. Find the existing JWT interceptor (around line 28: `api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {`). At the top of the file in the imports, change:

```ts
import { API_URL } from '@/constants/config';
```

to:

```ts
import { API_URL, TENANT_ID } from '@/constants/config';
```

Then **immediately above** the existing JWT interceptor block, add:

```ts
// Tenant header: every request — public and authenticated. On authenticated
// routes the backend's TenantResolverMiddleware ignores this header (JWT
// claim wins); on public routes it locks the binary to a single tenant.
api.interceptors.request.use((config) => {
  if (config.headers && typeof (config.headers as any).set === 'function') {
    (config.headers as any).set('X-Org-Id', TENANT_ID);
  } else if (config.headers) {
    (config.headers as any)['X-Org-Id'] = TENANT_ID;
  }
  return config;
});
```

Why both branches: AxiosHeaders v1 has `.set()`; the test fixture passes a plain object. Production calls hit `.set()`; test hits the assignment branch.

- [ ] **Step 4: Run test to confirm it passes**

Run: `cd apps/mobile && npx jest services/api.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the rest of the mobile test suite**

Run: `cd apps/mobile && npm run test`
Expected: all green (or no regressions vs. baseline).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/services/api.ts apps/mobile/services/api.test.ts
git commit -m "feat(mobile): send X-Org-Id on every API request"
```

---

## Task 9: Mobile — Drop in customer assets

**Files:**
- Create: `apps/mobile/assets/sawa/icon.png`
- Create: `apps/mobile/assets/sawa/splash.png`
- Create: `apps/mobile/assets/sawa/android-icon-foreground.png`
- Create: `apps/mobile/assets/sawa/android-icon-background.png`
- Create: `apps/mobile/assets/sawa/android-icon-monochrome.png`

- [ ] **Step 1: Create the asset folder**

```bash
mkdir -p apps/mobile/assets/sawa
```

- [ ] **Step 2: Place customer icon**

The user has the icon ready. Ask them for the path, then:

```bash
cp <user-provided-path>/icon.png apps/mobile/assets/sawa/icon.png
```

If the user hasn't provided a path yet, copy the existing one as a placeholder so the build still works — the icon can be swapped any time later without code changes:

```bash
cp apps/mobile/assets/icon.png apps/mobile/assets/sawa/icon.png
```

- [ ] **Step 3: Copy remaining placeholders**

```bash
cp apps/mobile/assets/splash-icon.png apps/mobile/assets/sawa/splash.png
cp apps/mobile/assets/android-icon-foreground.png apps/mobile/assets/sawa/android-icon-foreground.png
cp apps/mobile/assets/android-icon-background.png apps/mobile/assets/sawa/android-icon-background.png
cp apps/mobile/assets/android-icon-monochrome.png apps/mobile/assets/sawa/android-icon-monochrome.png
```

- [ ] **Step 4: Verify all 5 files exist**

Run: `ls apps/mobile/assets/sawa/`
Expected: 5 PNG files.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/assets/sawa/
git commit -m "feat(mobile): add Sawa customer asset placeholders"
```

---

## Task 10: Mobile — Replace `app.json` with `app.config.ts`

**Files:**
- Delete: `apps/mobile/app.json`
- Create: `apps/mobile/app.config.ts`

- [ ] **Step 1: Create `apps/mobile/app.config.ts`**

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
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'sa.sawa.app',
  },
  android: {
    package: 'sa.sawa.app',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/sawa/android-icon-foreground.png',
      backgroundImage: './assets/sawa/android-icon-background.png',
      monochromeImage: './assets/sawa/android-icon-monochrome.png',
    },
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-notifications',
    'expo-image-picker',
  ],
};

export default config;
```

- [ ] **Step 2: Delete `apps/mobile/app.json`**

```bash
rm apps/mobile/app.json
```

- [ ] **Step 3: Verify Expo can resolve the new config**

Run: `cd apps/mobile && npx expo config --json | head -20`
Expected: JSON output starting with `"name": "سواء للإرشاد الأسري"`. If Expo complains about missing dependency `@expo/cli`, that's fine — it ships with `expo`. If the command fails outright, double-check the file syntax.

- [ ] **Step 4: Run mobile typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app.config.ts
git rm apps/mobile/app.json
git commit -m "feat(mobile): rebrand app — Sawa name, icon, bundle (sa.sawa.app)"
```

---

## Task 11: Verify end-to-end manually

**Files:** none — manual QA.

- [ ] **Step 1: Start backend**

Run: `npm run dev:backend`
Expected: NestJS up on `:5100`, no errors.

- [ ] **Step 2: Start mobile**

Run: `npm run dev:mobile`
Expected: Expo dev server up.

- [ ] **Step 3: curl the public catalog with the tenant header**

Run:
```bash
curl -s -H "X-Org-Id: 00000000-0000-0000-0000-000000000001" \
  http://localhost:5100/api/v1/public/services/departments | head -100
```
Expected: JSON returns departments belonging to the Sawa-renamed default org.

- [ ] **Step 4: curl with NO header (permissive fallback path still works)**

Run:
```bash
curl -s http://localhost:5100/api/v1/public/services/departments | head -100
```
Expected: same data — falls back to `DEFAULT_ORGANIZATION_ID` in permissive mode.

- [ ] **Step 5: Open the mobile app on a development build**

Note: Expo Go cannot show a custom app name or launcher icon — you'll see "Expo" or "deqah" in Expo Go. To verify the rebrand: `cd apps/mobile && npx expo run:ios` (or `run:android`) which builds a dev client with the real `app.config.ts` applied.

Expected on the home screen of the simulator/device:
- App name in the launcher: **سواء للإرشاد الأسري**
- App icon: customer's icon (or the placeholder copy if user hasn't provided yet)

- [ ] **Step 6: Verify catalog inside the app shows tenant data**

Browse to the services tab. Expected: only the default org's data, never the test orgs (`iso-*`, etc.).

---

## Task 12: Run the full test suites once more

**Files:** none — verification.

- [ ] **Step 1: Backend unit tests**

Run: `cd apps/backend && npm run test`
Expected: all green.

- [ ] **Step 2: Backend e2e tests** (optional but recommended)

Run: `cd apps/backend && npm run test:e2e -- --testPathPattern=security`
Expected: all green, including the new mobile-header spec.

- [ ] **Step 3: Mobile tests**

Run: `cd apps/mobile && npm run test`
Expected: all green.

- [ ] **Step 4: Backend typecheck + lint**

Run: `cd apps/backend && npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 5: Mobile typecheck + lint**

Run: `cd apps/mobile && npx tsc --noEmit && cd apps/mobile && npm run lint`
Expected: clean.

- [ ] **Step 6: Final commit if any cleanup happened**

```bash
git status
# If anything changed, stage + commit. Otherwise skip.
```

---

## Task 13: Open the PR

**Files:** none — git/GitHub.

- [ ] **Step 1: Push branch + open PR**

```bash
git push -u origin <branch-name>
gh pr create --title "feat(mobile): tenant-lock for سواء للإرشاد الأسري" --body "$(cat <<'EOF'
## Summary
- Backend `TenantResolverMiddleware` now honors `X-Org-Id` on unauthenticated public routes (JWT still wins on authenticated; webhooks excluded).
- Mobile sends `X-Org-Id` on every request via Axios interceptor, locked to a single `TENANT_ID` constant.
- Mobile rebrand: name → "سواء للإرشاد الأسري", bundle ID → `sa.sawa.app`, custom icon, `app.json` → `app.config.ts`.
- Default dev org relabeled and linked to `family-consulting` vertical via idempotent `npm run seed:sawa`.

## Spec & Plan
- Spec: docs/superpowers/specs/2026-04-25-mobile-tenant-lock-sawa-design.md
- Plan: docs/superpowers/plans/2026-04-25-mobile-tenant-lock-sawa.md

## Test plan
- [x] Middleware unit: 8 helper + 5 behavior cases
- [x] E2E: tenant-A vs tenant-B disjoint catalogs via header
- [x] Mobile interceptor unit
- [x] Manual: app launcher shows سواء name + icon
- [x] Manual: catalog shows only default org's data

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Tag the PR `owner-only` since it touches `tenant-resolver.middleware.ts`.

---

## Self-Review

**1. Spec coverage:**

| Spec section | Implementing task |
|---|---|
| Backend — `TenantResolverMiddleware` extension | Tasks 1, 3 |
| Backend — Test coverage (5 cases listed) | Tasks 2, 4 |
| Backend — E2E spec | Task 5 |
| Backend — Sawa seed script + npm script | Task 6 |
| Mobile — `TENANT_ID` constant | Task 7 |
| Mobile — Axios interceptor | Task 8 |
| Mobile — `app.config.ts` (replace `app.json`) | Task 10 |
| Mobile — Asset placement (`assets/sawa/*`) | Task 9 |
| Mobile — In-app text references (APP_NAME) | Task 7 |
| Operational — local dev verification | Task 11 |
| Files Touched table | All 12 task entries cover every row |

No gaps.

**2. Placeholder scan:** All steps contain runnable commands or full code. No "TBD"/"add appropriate". One acceptable referral: in Task 5 step 3, "adjust to match patterns in `cross-tenant-penetration.e2e-spec.ts`" — this is a real existing file the engineer can read; not a placeholder.

**3. Type consistency:**

- `TENANT_ID` declared in Task 7, used in Task 8 — same name, same export.
- `parseUuidHeader` / `isPublicRoute` declared in Task 1, called in Task 3 — same names, same signatures.
- Helper test in Task 2 uses `(mw as unknown as { isPublicRoute(p: string): boolean })` — matches actual signature.
- `APP_NAME` in `constants/config.ts` (Task 7) — used wherever the mobile app references its own name.

Consistent.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-25-mobile-tenant-lock-sawa.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
