# Admin Tenant Management Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current CareKit super-admin tenant area from partial monitoring/control into a safe tenant-management control plane that can create, inspect, suspend, impersonate, bill, and audit tenants without weakening tenant isolation.

**Architecture:** This is a DEEP, owner-only remediation because it touches tenant infrastructure, auth, super-admin, billing, feature entitlements, and dashboard impersonation. Work in a dedicated worktree, start with regression tests for current gaps, then fix one boundary at a time: strict tenant context, impersonation handoff, tenant lifecycle APIs, admin UI, billing/org identity contracts, entitlement ownership, suspension hardening, and final QA. Every task has a local rollback point and a gate that proves the fix did not break adjacent flows.

**Tech Stack:** NestJS 11, Prisma 7, PostgreSQL, Redis, Jest + Supertest, Next.js 15, React 19, TanStack Query, Vitest, next-intl, Chrome DevTools MCP manual QA, Kiwi TCMS.

---

## Safety Contract

This plan must not "fix one problem and cause another". The implementation rules are:

- Work in an isolated worktree from `main`.
- No production behavior change without a failing test first.
- No schema/migration changes except the explicitly named entitlement audit enum task.
- No broad refactor while fixing a boundary bug.
- No mobile changes.
- No Playwright reintroduction.
- After every task, run the narrow tests listed in that task before continuing.
- After every phase, run the phase gate before committing the next phase.
- If a phase gate fails for unrelated baseline reasons, document the exact failing command and isolate touched-file validation before continuing.
- Keep every commit scoped to one system and under CareKit commit limits.

## Execution Path

This is a DEEP path.

- Branch/worktree: `feat/admin-tenant-management-remediation`
- Suggested worktree: `/Users/tariq/code/carekit-admin-tenant-remediation`
- Owner-only reviewer scope: auth, tenant infra, platform/admin, billing, Prisma migration.
- Required final evidence: backend unit tests, backend strict e2e, admin typecheck/lint/build, dashboard impersonation tests/typecheck, manual admin + dashboard smoke, Kiwi manual sync.

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `docs/superpowers/qa/admin-tenant-management-baseline-2026-04-29.md` | Baseline commands and known current failures | Create |
| `apps/backend/src/common/tenant/tenant-resolver.middleware.ts` | Resolve unauthenticated public tenant only; avoid blocking private auth before guards | Modify |
| `apps/backend/src/common/tenant/tenant-resolver.middleware.spec.ts` | Unit coverage for strict/public/private resolution | Modify |
| `apps/backend/src/common/guards/jwt.guard.ts` | Stamp tenant CLS after JWT validation | Modify |
| `apps/backend/src/common/guards/jwt.guard.spec.ts` | Unit coverage for JWT tenant stamping + suspension checks | Modify |
| `apps/backend/test/setup/app.setup.ts` | Allow e2e tests to run strict/permissive without global leakage | Modify |
| `apps/backend/test/e2e/admin/super-admin-strict-tenant.e2e-spec.ts` | Production-like strict admin/tenant isolation proof | Create |
| `apps/dashboard/lib/api/auth.ts` | Accept shadow impersonation token without refresh token | Modify |
| `apps/dashboard/components/providers/auth-provider.tsx` | Bootstrap `_impersonation`, fetch user, clean URL, avoid refresh loop | Modify |
| `apps/dashboard/components/impersonation-banner.tsx` | Visible shadow-session banner in tenant dashboard | Create |
| `apps/dashboard/test/unit/auth/impersonation-bootstrap.spec.tsx` | Vitest proof dashboard consumes shadow token correctly | Create |
| `apps/backend/src/api/admin/dto/tenant-lifecycle.dto.ts` | DTOs for create/update/archive tenant | Create |
| `apps/backend/src/modules/platform/admin/create-tenant/create-tenant.handler.ts` | Atomic tenant provisioning | Create |
| `apps/backend/src/modules/platform/admin/update-organization/update-organization.handler.ts` | Admin-safe org metadata updates | Create |
| `apps/backend/src/modules/platform/admin/archive-organization/archive-organization.handler.ts` | Archive inactive tenant without deleting data | Create |
| `apps/backend/src/api/admin/organizations.controller.ts` | Add create/update/archive routes | Modify |
| `apps/backend/src/modules/platform/platform.module.ts` | Register new admin handlers | Modify |
| `apps/backend/src/modules/platform/admin/*/*.spec.ts` | Unit tests for lifecycle handlers | Create/modify |
| `apps/admin/features/organizations/create-tenant/*` | Tenant onboarding client slice | Create |
| `apps/admin/features/organizations/update-organization/*` | Edit tenant metadata client slice | Create |
| `apps/admin/features/organizations/archive-organization/*` | Archive confirmation client slice | Create |
| `apps/admin/app/(admin)/organizations/page.tsx` | Add create action and richer filters | Modify |
| `apps/admin/app/(admin)/organizations/[id]/page.tsx` | Add lifecycle actions and clearer status model | Modify |
| `apps/backend/src/modules/platform/admin/list-subscriptions/list-subscriptions.handler.ts` | Include org identity in billing subscription list | Modify |
| `apps/backend/src/modules/platform/admin/list-subscription-invoices/list-subscription-invoices.handler.ts` | Include org identity in invoice list | Modify |
| `apps/admin/features/billing/list-subscriptions/*` | Display org slug/name/status instead of raw IDs | Modify |
| `apps/admin/features/billing/list-subscription-invoices/*` | Display org slug/name/status instead of raw IDs | Modify |
| `apps/backend/prisma/schema/platform.prisma` | Add `FEATURE_FLAG_UPDATE` audit action | Modify |
| `apps/backend/prisma/migrations/20260429000200_add_feature_flag_update_action/migration.sql` | Immutable Prisma migration generated by Prisma | Create |
| `apps/backend/src/api/admin/feature-flags.controller.ts` | Super-admin entitlement override API | Create |
| `apps/backend/src/modules/platform/admin/list-feature-flags-admin/*` | List platform flags + tenant override state | Create |
| `apps/backend/src/modules/platform/admin/update-feature-flag-admin/*` | Update tenant override with audit log | Create |
| `apps/backend/src/api/dashboard/platform.controller.ts` | Make dashboard feature flags read-only or owner-gated | Modify |
| `apps/admin/app/(admin)/organizations/[id]/entitlements/*` | Tenant entitlement panel | Create |
| `apps/backend/src/modules/platform/admin/suspend-organization/suspend-organization.handler.ts` | Revoke refresh tokens + end impersonation sessions + cache invalidation | Modify |
| `apps/backend/src/modules/platform/admin/reinstate-organization/reinstate-organization.handler.ts` | Preserve audit and cache recovery | Modify |
| `apps/admin/messages/ar.json` | Arabic admin copy for tenant management | Modify |
| `apps/admin/messages/en.json` | English admin copy for tenant management | Modify |
| `apps/admin/package.json` | Add Vitest test script if admin test harness is added | Modify |
| `apps/admin/test/unit/**` | Unit tests for admin tenant flows | Create |
| `docs/superpowers/qa/admin-tenant-management-report-2026-04-29.md` | Final QA report | Create |
| `data/kiwi/admin-tenant-management-2026-04-29.json` | Manual QA plan for Kiwi sync | Create |

---

## Phase 0: Worktree and Baseline

### Task 0.1: Create Isolated Worktree

**Files:**
- No code files.

- [ ] **Step 1: Create worktree**

Run:

```bash
cd /Users/tariq/code/carekit
git worktree add ../carekit-admin-tenant-remediation -b feat/admin-tenant-management-remediation main
cd ../carekit-admin-tenant-remediation
```

Expected: new worktree exists and `git branch --show-current` prints `feat/admin-tenant-management-remediation`.

- [ ] **Step 2: Record current dirty state in main workspace**

Run:

```bash
cd /Users/tariq/code/carekit
git status --short
```

Expected: existing user changes remain untouched in the main workspace.

### Task 0.2: Baseline Current Gates

**Files:**
- Create: `docs/superpowers/qa/admin-tenant-management-baseline-2026-04-29.md`

- [ ] **Step 1: Run backend tenant/admin baseline**

Run from worktree:

```bash
npm run prisma:validate --workspace=backend
npm run typecheck --workspace=backend
npm run lint --workspace=backend
npm run test --workspace=backend -- src/api/admin/organizations.controller.spec.ts src/modules/platform/admin/list-organizations/list-organizations.handler.spec.ts src/modules/platform/admin/get-organization/get-organization.handler.spec.ts src/common/tenant/tenant-resolver.middleware.spec.ts src/common/guards/jwt.guard.spec.ts
```

Expected: document PASS/FAIL exactly. Do not fix yet.

- [ ] **Step 2: Run admin app baseline**

Run:

```bash
npm run typecheck --workspace=admin
npm run lint --workspace=admin
npm run build --workspace=admin
```

Expected: document PASS/FAIL exactly.

- [ ] **Step 3: Run dashboard auth/tenant baseline**

Run:

```bash
npm run test --workspace=dashboard -- test/unit/auth/auth-provider.spec.tsx test/unit/components/tenant-switcher.spec.tsx test/unit/lib/auth-api.spec.ts
npm run typecheck --workspace=dashboard
```

Expected: document PASS/FAIL exactly.

- [ ] **Step 4: Write baseline report**

Create `docs/superpowers/qa/admin-tenant-management-baseline-2026-04-29.md` with:

```md
# Admin Tenant Management Baseline - 2026-04-29

## Backend

- `npm run prisma:validate --workspace=backend`: PASS/FAIL
- `npm run typecheck --workspace=backend`: PASS/FAIL
- `npm run lint --workspace=backend`: PASS/FAIL
- targeted admin/tenant Jest: PASS/FAIL

## Admin App

- `npm run typecheck --workspace=admin`: PASS/FAIL
- `npm run lint --workspace=admin`: PASS/FAIL
- `npm run build --workspace=admin`: PASS/FAIL

## Dashboard

- targeted auth/tenant Vitest: PASS/FAIL
- `npm run typecheck --workspace=dashboard`: PASS/FAIL

## Notes

- Existing baseline blockers:
- Touched-file blockers:
- Commands that must be re-run after each phase:
```

- [ ] **Step 5: Commit baseline report**

```bash
git add docs/superpowers/qa/admin-tenant-management-baseline-2026-04-29.md
git commit -m "docs(admin): capture tenant management remediation baseline"
```

---

## Phase 1: Strict Tenant Context Without Breaking Auth

### Task 1.1: Move Authenticated Tenant Stamping to `JwtGuard`

**Problem:** `TenantResolverMiddleware` runs before Nest guards, so in strict mode it cannot rely on `req.user` populated by `JwtGuard`. Authenticated private routes should not fail before JWT validation.

**Files:**
- Modify: `apps/backend/src/common/tenant/tenant-resolver.middleware.ts`
- Modify: `apps/backend/src/common/tenant/tenant-resolver.middleware.spec.ts`
- Modify: `apps/backend/src/common/guards/jwt.guard.ts`
- Modify: `apps/backend/src/common/guards/jwt.guard.spec.ts`

- [ ] **Step 1: Write failing middleware tests**

Add tests proving strict private routes do not throw before guards:

```ts
it('strict mode: private authenticated routes defer tenant resolution to JwtGuard', async () => {
  const mw = await build({ TENANT_ENFORCEMENT: 'strict' });
  await new Promise<void>((done) => {
    cls.run(() =>
      mw.use(req({ originalUrl: '/api/v1/dashboard/bookings' }), {} as never, () => {
        expect(ctx.get()).toBeUndefined();
        done();
      }),
    );
  });
});

it('strict mode: public routes without a valid X-Org-Id still fail closed', async () => {
  const mw = await build({ TENANT_ENFORCEMENT: 'strict' });
  expect(() =>
    cls.run(() =>
      mw.use(req({ originalUrl: '/api/v1/public/services/departments' }), {} as never, () => undefined),
    ),
  ).toThrow(TenantResolutionError);
});
```

Run:

```bash
npm run test --workspace=backend -- src/common/tenant/tenant-resolver.middleware.spec.ts
```

Expected: first new test FAILS on current code.

- [ ] **Step 2: Change middleware responsibility**

Update `TenantResolverMiddleware.use()`:

- If `TENANT_ENFORCEMENT=off`, call `next()`.
- If route is unauthenticated public route, require valid `X-Org-Id` in strict mode and set context.
- If route is not public, call `next()` and let `JwtGuard` stamp context.
- Keep permissive default fallback for dev-only unresolved public/private routes.
- Keep super-admin `X-Org-Id` logic only for contexts where `req.user` already exists; do not depend on it for normal private routes.

- [ ] **Step 3: Write failing JwtGuard tenant-stamping test**

Add a test in `jwt.guard.spec.ts` that simulates a valid JWT user:

```ts
it('stamps TenantContext after JWT validation', async () => {
  const ctx = makeExecutionContext({
    user: {
      id: 'user-1',
      organizationId: 'org-1',
      membershipId: 'member-1',
      role: 'ADMIN',
      isSuperAdmin: false,
    },
  });

  await expect(guard.canActivate(ctx)).resolves.toBe(true);
  expect(tenantContext.set).toHaveBeenCalledWith({
    organizationId: 'org-1',
    membershipId: 'member-1',
    id: 'user-1',
    role: 'ADMIN',
    isSuperAdmin: false,
  });
});
```

Expected: FAILS until `JwtGuard` injects and calls `TenantContextService`.

- [ ] **Step 4: Implement JwtGuard stamping**

Modify `JwtGuard` constructor to inject `TenantContextService`. After `super.canActivate(ctx)` and before suspension/session assertions complete, set tenant context when `req.user.organizationId` exists:

```ts
this.tenantContext.set({
  organizationId: req.user.organizationId,
  membershipId: req.user.membershipId ?? '',
  id: req.user.id ?? req.user.sub ?? '',
  role: req.user.role ?? '',
  isSuperAdmin: req.user.isSuperAdmin === true,
});
```

Keep `assertOrganizationIsActive()` and `assertImpersonationSessionIsLive()` behavior unchanged.

- [ ] **Step 5: Run narrow tests**

```bash
npm run test --workspace=backend -- src/common/tenant/tenant-resolver.middleware.spec.ts src/common/guards/jwt.guard.spec.ts
npm run typecheck --workspace=backend
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/common/tenant/tenant-resolver.middleware.ts apps/backend/src/common/tenant/tenant-resolver.middleware.spec.ts apps/backend/src/common/guards/jwt.guard.ts apps/backend/src/common/guards/jwt.guard.spec.ts
git commit -m "fix(tenant): stamp authenticated tenant context in jwt guard"
```

### Task 1.2: Strict-Mode Admin E2E Gate

**Files:**
- Modify: `apps/backend/test/setup/app.setup.ts`
- Create: `apps/backend/test/e2e/admin/super-admin-strict-tenant.e2e-spec.ts`

- [ ] **Step 1: Extend `createTestApp` with options**

Change signature:

```ts
export async function createTestApp(options: { tenantEnforcement?: 'permissive' | 'strict' } = {}): Promise<{
  app: INestApplication;
  request: SuperTest.Agent;
}> {
  const tenantEnforcement = options.tenantEnforcement ?? 'permissive';
}
```

Use `tenantEnforcement` in both `ConfigService.get()` and `getOrThrow()` maps instead of hardcoded `'permissive'`.

Do not reuse cached app when options differ. Store cache by key:

```ts
const appCache = new Map<string, INestApplication>();
const cacheKey = `tenant=${tenantEnforcement}`;
```

- [ ] **Step 2: Add strict e2e test**

Create `apps/backend/test/e2e/admin/super-admin-strict-tenant.e2e-spec.ts` covering:

- `GET /api/v1/admin/organizations` returns `200` for super-admin token with `isSuperAdmin=true`, valid `organizationId`, and allowed Host.
- Same endpoint returns `403` for wrong Host.
- Same endpoint returns `403` for non-super-admin user.
- Dashboard private route without auth returns `401`, not tenant resolution failure.
- Public route without `X-Org-Id` returns tenant resolution failure in strict.

- [ ] **Step 3: Run strict e2e only**

```bash
npm run test:e2e --workspace=backend -- test/e2e/admin/super-admin-strict-tenant.e2e-spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 4: Run existing super-admin isolation e2e**

```bash
npm run test:e2e --workspace=backend -- test/e2e/admin/super-admin-isolation.e2e-spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/test/setup/app.setup.ts apps/backend/test/e2e/admin/super-admin-strict-tenant.e2e-spec.ts
git commit -m "test(admin): prove super-admin routes under strict tenancy"
```

**Phase 1 Gate**

```bash
npm run prisma:validate --workspace=backend
npm run typecheck --workspace=backend
npm run lint --workspace=backend
npm run test --workspace=backend -- src/common/tenant/tenant-resolver.middleware.spec.ts src/common/guards/jwt.guard.spec.ts
npm run test:e2e --workspace=backend -- test/e2e/admin/super-admin-strict-tenant.e2e-spec.ts --runInBand
```

Do not continue until PASS or documented baseline-only failure.

---

## Phase 2: Dashboard Impersonation Handoff

### Task 2.1: Consume `_impersonation` Shadow Token in Dashboard

**Files:**
- Modify: `apps/dashboard/lib/api/auth.ts`
- Modify: `apps/dashboard/components/providers/auth-provider.tsx`
- Create: `apps/dashboard/components/impersonation-banner.tsx`
- Create: `apps/dashboard/test/unit/auth/impersonation-bootstrap.spec.tsx`

- [ ] **Step 1: Write failing Vitest**

Test behavior:

- URL starts with `/?_impersonation=shadow.jwt`.
- Dashboard stores shadow token via `setAccessToken`.
- Dashboard calls `fetchMe`.
- Dashboard removes `_impersonation` from URL with `history.replaceState`.
- Dashboard does not call refresh token before using the shadow token.

Run:

```bash
npm run test --workspace=dashboard -- test/unit/auth/impersonation-bootstrap.spec.tsx
```

Expected: FAIL because `_impersonation` is currently ignored.

- [ ] **Step 2: Add auth helper**

In `apps/dashboard/lib/api/auth.ts`, export:

```ts
export function acceptImpersonationToken(token: string): void {
  sessionStorage.setItem('carekit_impersonation', '1');
  setAccessToken(token);
}

export function clearImpersonationMarker(): void {
  sessionStorage.removeItem('carekit_impersonation');
}

export function isImpersonating(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem('carekit_impersonation') === '1';
}
```

- [ ] **Step 3: Update AuthProvider bootstrap order**

In `AuthProvider` mount effect:

1. Read `_impersonation` from `window.location.search`.
2. If present, call `acceptImpersonationToken(token)`.
3. Remove only `_impersonation` from the URL.
4. Call `fetchMe()`.
5. Set user/permissions.
6. Do not schedule refresh for impersonation sessions.
7. If absent, keep existing refresh-token flow.

- [ ] **Step 4: Add banner**

Create `apps/dashboard/components/impersonation-banner.tsx`:

- Shows only when `isImpersonating()` is true.
- Text comes from dashboard locale provider.
- Has a "End session" action that calls dashboard logout, clears local token and marker, and redirects to `/`.

- [ ] **Step 5: Place banner in dashboard shell**

Add banner near the top of the authenticated dashboard layout/header so it is visible on every route.

- [ ] **Step 6: Run dashboard tests**

```bash
npm run test --workspace=dashboard -- test/unit/auth/impersonation-bootstrap.spec.tsx test/unit/auth/auth-provider.spec.tsx test/unit/components/tenant-switcher.spec.tsx
npm run typecheck --workspace=dashboard
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/lib/api/auth.ts apps/dashboard/components/providers/auth-provider.tsx apps/dashboard/components/impersonation-banner.tsx apps/dashboard/test/unit/auth/impersonation-bootstrap.spec.tsx
git commit -m "fix(dashboard): accept admin impersonation shadow tokens"
```

**Phase 2 Gate**

Run backend start + dashboard manual smoke later in Phase 8. For now:

```bash
npm run test --workspace=dashboard -- test/unit/auth/impersonation-bootstrap.spec.tsx test/unit/auth/auth-provider.spec.tsx
npm run typecheck --workspace=dashboard
npm run lint --workspace=dashboard -- lib/api/auth.ts components/providers/auth-provider.tsx components/impersonation-banner.tsx
```

---

## Phase 3: Tenant Lifecycle Backend

### Task 3.1: Add Tenant Lifecycle DTOs

**Files:**
- Create: `apps/backend/src/api/admin/dto/tenant-lifecycle.dto.ts`

- [ ] **Step 1: Define DTOs**

Create DTOs:

```ts
export class CreateTenantDto {
  slug!: string;
  nameAr!: string;
  nameEn?: string;
  ownerUserId!: string;
  verticalSlug?: string;
  planId?: string;
  billingCycle?: 'MONTHLY' | 'ANNUAL';
  trialDays?: number;
  reason!: string;
}

export class UpdateOrganizationDto {
  nameAr?: string;
  nameEn?: string | null;
  verticalSlug?: string | null;
  trialEndsAt?: Date | null;
  reason!: string;
}

export class ArchiveOrganizationDto {
  reason!: string;
}
```

Add class-validator decorators:

- `slug`: lowercase slug regex, min 2, max 64.
- `nameAr`: min 2, max 120.
- `ownerUserId`: UUID.
- `planId`: optional UUID.
- `trialDays`: optional int 0..90.
- `reason`: min 10, max 500.

- [ ] **Step 2: Run backend typecheck**

```bash
npm run typecheck --workspace=backend
```

Expected: PASS.

### Task 3.2: Create Tenant Provisioning Handler

**Files:**
- Create: `apps/backend/src/modules/platform/admin/create-tenant/create-tenant.handler.ts`
- Create: `apps/backend/src/modules/platform/admin/create-tenant/create-tenant.handler.spec.ts`
- Modify: `apps/backend/src/modules/platform/platform.module.ts`

- [ ] **Step 1: Write failing tests**

Cover:

- Rejects duplicate slug.
- Rejects missing owner user.
- Creates organization.
- Creates OWNER membership for owner.
- Creates default `BrandingConfig`.
- Creates default `OrganizationSettings`.
- Seeds vertical departments/categories when `verticalSlug` is provided.
- Creates subscription when `planId` is provided.
- Writes `SuperAdminActionLog` with action metadata.

- [ ] **Step 2: Implement handler**

Handler command:

```ts
export interface CreateTenantCommand {
  slug: string;
  nameAr: string;
  nameEn?: string;
  ownerUserId: string;
  verticalSlug?: string;
  planId?: string;
  billingCycle?: 'MONTHLY' | 'ANNUAL';
  trialDays?: number;
  superAdminUserId: string;
  reason: string;
  ipAddress: string;
  userAgent: string;
}
```

Implementation rules:

- Use `this.prisma.$allTenants.$transaction`.
- Query only needed fields with `select`.
- Create organization first.
- Create membership with role `OWNER`.
- Create `BrandingConfig` with `organizationNameAr = nameAr`, `organizationNameEn = nameEn`.
- Create `OrganizationSettings` with `companyNameAr = nameAr`, `companyNameEn = nameEn`.
- If vertical provided, fetch active vertical and seed departments/categories inside the same transaction.
- If plan provided, create `Subscription` with `TRIALING`, period dates, and optional trial days.
- Create audit log with `SuperAdminActionType.REINSTATE_ORG` is not acceptable. If no lifecycle enum exists, add Task 3.4 before this implementation to add `TENANT_CREATE`; otherwise use the new enum.

### Task 3.3: Add Tenant Lifecycle Audit Enum

**Files:**
- Modify: `apps/backend/prisma/schema/platform.prisma`
- Create: Prisma-generated migration `apps/backend/prisma/migrations/20260429000100_add_tenant_lifecycle_audit_actions/migration.sql`

- [ ] **Step 1: Add enum values**

Add to `SuperAdminActionType`:

```prisma
  TENANT_CREATE
  TENANT_UPDATE
  TENANT_ARCHIVE
```

- [ ] **Step 2: Generate migration**

Run:

```bash
npm run prisma:migrate --workspace=backend -- --name add_tenant_lifecycle_audit_actions
```

Expected: new migration file only. Do not edit old migrations.
If Prisma generates a timestamped directory name different from `20260429000100_add_tenant_lifecycle_audit_actions`, keep Prisma's generated immutable directory and update this plan path in the same commit before continuing.

- [ ] **Step 3: Validate Prisma**

```bash
npm run prisma:validate --workspace=backend
npm run prisma:generate --workspace=backend
npm run typecheck --workspace=backend
```

Expected: PASS.

### Task 3.4: Add Update and Archive Handlers

**Files:**
- Create: `apps/backend/src/modules/platform/admin/update-organization/update-organization.handler.ts`
- Create: `apps/backend/src/modules/platform/admin/update-organization/update-organization.handler.spec.ts`
- Create: `apps/backend/src/modules/platform/admin/archive-organization/archive-organization.handler.ts`
- Create: `apps/backend/src/modules/platform/admin/archive-organization/archive-organization.handler.spec.ts`
- Modify: `apps/backend/src/modules/platform/platform.module.ts`

- [ ] **Step 1: Update handler tests**

Cover:

- Cannot update missing organization.
- Can update `nameAr`, `nameEn`, `trialEndsAt`, and `verticalId`.
- Writes audit metadata with previous and next values.

- [ ] **Step 2: Archive handler tests**

Cover:

- Cannot archive missing organization.
- Cannot archive already archived organization.
- Sets `status=ARCHIVED`, `suspendedAt` if empty, and `suspendedReason`.
- Revokes active refresh tokens for memberships in that org.
- Ends active impersonation sessions for that org.
- Writes audit log.

- [ ] **Step 3: Implement handlers minimally**

Do not delete tenant data. Archive is reversible only by a future explicit reinstate path; for this plan, `reinstate` should keep rejecting archived orgs unless a separate `restore` command is added.

### Task 3.5: Wire Controller Routes

**Files:**
- Modify: `apps/backend/src/api/admin/organizations.controller.ts`
- Modify: `apps/backend/src/api/admin/organizations.controller.spec.ts`

- [ ] **Step 1: Add routes**

Add:

- `POST /api/v1/admin/organizations`
- `PATCH /api/v1/admin/organizations/:id`
- `POST /api/v1/admin/organizations/:id/archive`

All routes must use the existing guard/interceptor chain.

- [ ] **Step 2: Controller tests**

Assert each route passes:

- `superAdminUserId`
- `ipAddress`
- `userAgent`
- DTO body
- route param id

- [ ] **Step 3: Run backend tests**

```bash
npm run test --workspace=backend -- src/api/admin/organizations.controller.spec.ts src/modules/platform/admin/create-tenant/create-tenant.handler.spec.ts src/modules/platform/admin/update-organization/update-organization.handler.spec.ts src/modules/platform/admin/archive-organization/archive-organization.handler.spec.ts
npm run typecheck --workspace=backend
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/prisma/schema/platform.prisma apps/backend/prisma/migrations apps/backend/src/api/admin/dto/tenant-lifecycle.dto.ts apps/backend/src/api/admin/organizations.controller.ts apps/backend/src/api/admin/organizations.controller.spec.ts apps/backend/src/modules/platform/admin/create-tenant apps/backend/src/modules/platform/admin/update-organization apps/backend/src/modules/platform/admin/archive-organization apps/backend/src/modules/platform/platform.module.ts
git commit -m "feat(admin): add tenant lifecycle backend"
```

**Phase 3 Gate**

```bash
npm run prisma:validate --workspace=backend
npm run typecheck --workspace=backend
npm run lint --workspace=backend
npm run test --workspace=backend -- src/api/admin/organizations.controller.spec.ts src/modules/platform/admin/create-tenant/create-tenant.handler.spec.ts src/modules/platform/admin/update-organization/update-organization.handler.spec.ts src/modules/platform/admin/archive-organization/archive-organization.handler.spec.ts
```

---

## Phase 4: Admin Tenant Lifecycle UI

### Task 4.1: Add Admin Test Harness

**Files:**
- Modify: `apps/admin/package.json`
- Create: `apps/admin/vitest.config.ts`
- Create: `apps/admin/test/setup.ts`

- [ ] **Step 1: Add scripts**

Add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: Add Vitest config**

Use jsdom, React plugin, and aliases matching Next app imports.

- [ ] **Step 3: Smoke run**

```bash
npm run test --workspace=admin
```

Expected: PASS with zero tests or one setup smoke test.

### Task 4.2: Add Create Tenant Flow

**Files:**
- Create: `apps/admin/features/organizations/create-tenant/create-tenant.api.ts`
- Create: `apps/admin/features/organizations/create-tenant/use-create-tenant.ts`
- Create: `apps/admin/features/organizations/create-tenant/create-tenant-dialog.tsx`
- Modify: `apps/admin/app/(admin)/organizations/page.tsx`
- Create: `apps/admin/test/unit/organizations/create-tenant-dialog.spec.tsx`

- [ ] **Step 1: Write UI tests**

Cover:

- Submit disabled until slug, Arabic name, owner user ID, and reason are valid.
- Calls `POST /admin/organizations`.
- Invalidates organization list query on success.
- Shows backend error message on failure.

- [ ] **Step 2: Implement API slice**

`createTenant()` posts:

```ts
{
  slug,
  nameAr,
  nameEn,
  ownerUserId,
  verticalSlug,
  planId,
  billingCycle,
  trialDays,
  reason
}
```

- [ ] **Step 3: Implement dialog**

Use existing UI primitives. Keep copy translatable through `next-intl`. Do not use raw hex colors, `ml`/`mr`, or hardcoded English outside translation dictionaries.

- [ ] **Step 4: Run admin tests/typecheck**

```bash
npm run test --workspace=admin -- test/unit/organizations/create-tenant-dialog.spec.tsx
npm run typecheck --workspace=admin
npm run lint --workspace=admin
```

Expected: PASS.

### Task 4.3: Improve Organization Status and Actions

**Files:**
- Modify: `apps/admin/features/organizations/types.ts`
- Modify: `apps/admin/features/organizations/list-organizations/organizations-table.tsx`
- Modify: `apps/admin/features/organizations/list-organizations/organizations-filter-bar.tsx`
- Modify: `apps/admin/app/(admin)/organizations/[id]/page.tsx`

- [ ] **Step 1: Represent real status**

Stop deriving active from only `suspendedAt`. Display:

- `TRIALING`
- `ACTIVE`
- `PAST_DUE`
- `SUSPENDED`
- `ARCHIVED`

Use `suspendedAt` as extra detail, not the primary status.

- [ ] **Step 2: Add filters**

List filters should include:

- search
- status
- suspended
- vertical
- plan

If backend does not yet support all filters, add backend list query support in the same task with tests.

- [ ] **Step 3: Add update/archive actions**

Add edit metadata and archive dialogs on the detail page. Archive button must be hidden for already archived orgs and disabled when mutation is pending.

- [ ] **Step 4: Gate**

```bash
npm run test --workspace=admin -- test/unit/organizations/create-tenant-dialog.spec.tsx
npm run typecheck --workspace=admin
npm run lint --workspace=admin
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin apps/backend/src/modules/platform/admin/list-organizations apps/backend/src/api/admin/organizations.controller.ts
git commit -m "feat(admin): add tenant lifecycle UI"
```

---

## Phase 5: Billing and Org Identity Contract

### Task 5.1: Return Organization Identity in Billing Lists

**Files:**
- Modify: `apps/backend/src/modules/platform/admin/list-subscriptions/list-subscriptions.handler.ts`
- Modify: `apps/backend/src/modules/platform/admin/list-subscriptions/list-subscriptions.handler.spec.ts`
- Modify: `apps/backend/src/modules/platform/admin/list-subscription-invoices/list-subscription-invoices.handler.ts`
- Modify: `apps/backend/src/modules/platform/admin/list-subscription-invoices/list-subscription-invoices.handler.spec.ts`
- Modify: `apps/admin/features/billing/types.ts`
- Modify: `apps/admin/features/billing/list-subscriptions/subscriptions-table.tsx`
- Modify: `apps/admin/features/billing/list-subscription-invoices/invoices-table.tsx`

- [ ] **Step 1: Backend tests**

Assert subscription and invoice list rows include:

```ts
organization: {
  id: true,
  slug: true,
  nameAr: true,
  nameEn: true,
  status: true,
  suspendedAt: true,
}
```

- [ ] **Step 2: Backend implementation**

For `Subscription`, select relation:

```ts
organization: {
  select: {
    id: true,
    slug: true,
    nameAr: true,
    nameEn: true,
    status: true,
    suspendedAt: true,
  },
}
```

For invoices, join through subscription organization when relation is available; if Prisma relation is absent, fetch org summaries by `organizationId in (...)` in one query and merge in memory. Do not do N+1.

- [ ] **Step 3: UI update**

Tables should show:

- org Arabic/English name
- slug
- status badge
- raw id in monospace secondary text only

- [ ] **Step 4: Gate**

```bash
npm run test --workspace=backend -- src/modules/platform/admin/list-subscriptions/list-subscriptions.handler.spec.ts src/modules/platform/admin/list-subscription-invoices/list-subscription-invoices.handler.spec.ts
npm run typecheck --workspace=backend
npm run typecheck --workspace=admin
npm run lint --workspace=admin
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/platform/admin/list-subscriptions apps/backend/src/modules/platform/admin/list-subscription-invoices apps/admin/features/billing
git commit -m "fix(admin): show tenant identity in billing tables"
```

---

## Phase 6: Feature Entitlements Ownership

### Task 6.1: Add Feature Flag Audit Action

**Files:**
- Modify: `apps/backend/prisma/schema/platform.prisma`
- Create: Prisma-generated migration `apps/backend/prisma/migrations/20260429000200_add_feature_flag_update_action/migration.sql`

- [ ] **Step 1: Add enum value**

Add to `SuperAdminActionType`:

```prisma
  FEATURE_FLAG_UPDATE
```

- [ ] **Step 2: Generate migration**

```bash
npm run prisma:migrate --workspace=backend -- --name add_feature_flag_update_action
npm run prisma:validate --workspace=backend
npm run prisma:generate --workspace=backend
```

Expected: generated migration only; no existing migration edits.
If Prisma generates a timestamped directory name different from `20260429000200_add_feature_flag_update_action`, keep Prisma's generated immutable directory and update this plan path in the same commit before continuing.

### Task 6.2: Move Tenant Feature Flag Mutation to Admin

**Files:**
- Create: `apps/backend/src/api/admin/feature-flags.controller.ts`
- Create: `apps/backend/src/modules/platform/admin/list-feature-flags-admin/list-feature-flags-admin.handler.ts`
- Create: `apps/backend/src/modules/platform/admin/list-feature-flags-admin/list-feature-flags-admin.handler.spec.ts`
- Create: `apps/backend/src/modules/platform/admin/update-feature-flag-admin/update-feature-flag-admin.handler.ts`
- Create: `apps/backend/src/modules/platform/admin/update-feature-flag-admin/update-feature-flag-admin.handler.spec.ts`
- Modify: `apps/backend/src/modules/platform/platform.module.ts`
- Modify: `apps/backend/src/api/dashboard/platform.controller.ts`
- Modify: `apps/backend/src/api/dashboard/platform.controller.spec.ts`

- [ ] **Step 1: Admin handler tests**

Cover:

- Lists platform catalog and selected org override.
- Creates org override when none exists.
- Updates org override when it exists.
- Rejects missing organization.
- Rejects missing flag key in platform catalog.
- Writes `FEATURE_FLAG_UPDATE` audit log.

- [ ] **Step 2: Admin controller**

Add:

- `GET /api/v1/admin/feature-flags?organizationId=<uuid>`
- `PATCH /api/v1/admin/feature-flags/:key`

Patch body:

```ts
{
  organizationId: string;
  enabled: boolean;
  reason: string;
}
```

- [ ] **Step 3: Dashboard mutation hardening**

Remove or restrict `PATCH /dashboard/platform/feature-flags/:key`. Tenant dashboard should not silently mutate entitlements unless it has an explicit owner-only permission and audit. Default decision for this plan: read-only dashboard.

- [ ] **Step 4: Gate**

```bash
npm run test --workspace=backend -- src/api/dashboard/platform.controller.spec.ts src/modules/platform/admin/list-feature-flags-admin/list-feature-flags-admin.handler.spec.ts src/modules/platform/admin/update-feature-flag-admin/update-feature-flag-admin.handler.spec.ts
npm run typecheck --workspace=backend
npm run lint --workspace=backend
```

### Task 6.3: Add Admin Entitlements UI

**Files:**
- Create: `apps/admin/features/organizations/entitlements/list-entitlements.api.ts`
- Create: `apps/admin/features/organizations/entitlements/use-entitlements.ts`
- Create: `apps/admin/features/organizations/entitlements/entitlements-panel.tsx`
- Modify: `apps/admin/app/(admin)/organizations/[id]/page.tsx`

- [ ] **Step 1: UI tests**

Cover:

- Lists flags.
- Toggle requires reason.
- Calls admin endpoint with `organizationId`, `key`, `enabled`, `reason`.
- Invalidates org entitlements and audit log.

- [ ] **Step 2: Implement panel**

Show:

- plan-derived state
- tenant override state
- final enabled state
- last updated if API returns it

- [ ] **Step 3: Gate and commit**

```bash
npm run test --workspace=admin -- test/unit/organizations/entitlements-panel.spec.tsx
npm run typecheck --workspace=admin
npm run lint --workspace=admin
git add apps/backend apps/admin
git commit -m "feat(admin): move tenant entitlements to super-admin"
```

---

## Phase 7: Suspension and Archive Hardening

### Task 7.1: Revoke Tenant Sessions on Suspension

**Files:**
- Modify: `apps/backend/src/modules/platform/admin/suspend-organization/suspend-organization.handler.ts`
- Modify: `apps/backend/src/modules/platform/admin/suspend-organization/suspend-organization.handler.spec.ts`
- Modify: `apps/backend/src/modules/platform/admin/reinstate-organization/reinstate-organization.handler.ts`
- Modify: `apps/backend/src/modules/platform/admin/reinstate-organization/reinstate-organization.handler.spec.ts`

- [ ] **Step 1: Write failing tests**

Suspension should:

- Set organization `status=SUSPENDED`.
- Set `suspendedAt` and `suspendedReason`.
- Revoke all active refresh tokens for users with active membership in the org.
- End active impersonation sessions for org.
- Delete Redis suspension cache.
- Write audit log.

Reinstate should:

- Only work for `SUSPENDED`, not `ARCHIVED`.
- Set `status=ACTIVE`.
- Clear suspension fields.
- Delete Redis suspension cache.
- Write audit log.

- [ ] **Step 2: Implement without deleting data**

Use transaction for database changes; Redis cache deletion after successful transaction.

- [ ] **Step 3: Gate**

```bash
npm run test --workspace=backend -- src/modules/platform/admin/suspend-organization/suspend-organization.handler.spec.ts src/modules/platform/admin/reinstate-organization/reinstate-organization.handler.spec.ts src/common/guards/jwt.guard.spec.ts
npm run typecheck --workspace=backend
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/platform/admin/suspend-organization apps/backend/src/modules/platform/admin/reinstate-organization
git commit -m "fix(admin): revoke tenant sessions on suspension"
```

---

## Phase 8: Admin i18n, RTL, and UX Polish

### Task 8.1: Translate Tenant Management UI

**Files:**
- Modify: `apps/admin/messages/ar.json`
- Modify: `apps/admin/messages/en.json`
- Modify: admin organization/billing/entitlement components touched above

- [ ] **Step 1: Add translation namespaces**

Add:

- `organizations`
- `organizations.create`
- `organizations.detail`
- `organizations.status`
- `organizations.entitlements`
- `billing`
- `audit`
- `common`

- [ ] **Step 2: Replace hardcoded UI strings**

Replace user-visible strings in touched admin components with `useTranslations`.

- [ ] **Step 3: RTL checks**

Replace directional classes in touched files:

- `ml-*` -> `ms-*`
- `mr-*` -> `me-*`
- `text-right` only when numeric/table alignment genuinely needs it; otherwise use logical layout.

- [ ] **Step 4: Gate**

```bash
npm run typecheck --workspace=admin
npm run lint --workspace=admin
npm run build --workspace=admin
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin/messages apps/admin/app apps/admin/features
git commit -m "fix(admin): localize tenant management surfaces"
```

---

## Phase 9: End-to-End Verification and Kiwi

### Task 9.1: Backend Final Gates

Run:

```bash
npm run prisma:validate --workspace=backend
npm run prisma:migrate:deploy --workspace=backend
npm run typecheck --workspace=backend
npm run lint --workspace=backend
npm run test --workspace=backend -- src/api/admin src/modules/platform/admin src/common/tenant src/common/guards
npm run test:e2e --workspace=backend -- test/e2e/admin/super-admin-strict-tenant.e2e-spec.ts test/e2e/admin/super-admin-isolation.e2e-spec.ts --runInBand
```

Expected: PASS.

### Task 9.2: Frontend Final Gates

Run:

```bash
npm run test --workspace=dashboard -- test/unit/auth/impersonation-bootstrap.spec.tsx test/unit/auth/auth-provider.spec.tsx test/unit/components/tenant-switcher.spec.tsx
npm run typecheck --workspace=dashboard
npm run i18n:verify --workspace=dashboard
npm run typecheck --workspace=admin
npm run lint --workspace=admin
npm run build --workspace=admin
```

Expected: PASS.

### Task 9.3: Manual Browser QA

Use Chrome DevTools MCP, not Playwright.

Flows:

1. Log into admin app.
2. Open organizations list.
3. Create tenant with existing owner user.
4. Open tenant detail.
5. Verify status, vertical, billing, owner membership.
6. Change plan.
7. Add entitlement override.
8. Start impersonation and land in dashboard.
9. Confirm impersonation banner appears.
10. End local impersonation session.
11. Suspend tenant.
12. Confirm tenant dashboard access receives suspension UX.
13. Reinstate tenant.
14. Confirm tenant dashboard access recovers.
15. Archive a test tenant.
16. Confirm archived tenant is no longer treated as active.

Write results to:

`docs/superpowers/qa/admin-tenant-management-report-2026-04-29.md`

### Task 9.4: Kiwi Manual Sync

Create `data/kiwi/admin-tenant-management-2026-04-29.json`:

```json
{
  "domain": "Admin Tenant Management",
  "version": "main",
  "build": "admin-tenant-management-remediation",
  "planName": "CareKit / Admin Tenant Management / Manual QA",
  "planSummary": "Manual QA for super-admin tenant lifecycle, impersonation, billing identity, entitlements, and suspension hardening.",
  "runSummary": "Executed locally after remediation.",
  "cases": [
    {
      "summary": "Super-admin creates tenant and sees it in organizations list",
      "text": "Create a tenant from admin and verify detail page fields.",
      "result": "passed"
    },
    {
      "summary": "Super-admin impersonates tenant user and dashboard accepts shadow token",
      "text": "Start impersonation from org detail and verify dashboard banner.",
      "result": "passed"
    },
    {
      "summary": "Suspending a tenant blocks tenant dashboard access",
      "text": "Suspend tenant and verify authenticated tenant dashboard requests are blocked with suspension UX.",
      "result": "passed"
    },
    {
      "summary": "Reinstating a tenant restores tenant dashboard access",
      "text": "Reinstate tenant and verify dashboard can load again.",
      "result": "passed"
    },
    {
      "summary": "Billing tables show tenant identity instead of raw IDs",
      "text": "Open billing subscriptions and invoices and verify org name, slug, status, and detail links.",
      "result": "passed"
    },
    {
      "summary": "Tenant entitlements are controlled from super-admin",
      "text": "Toggle a tenant entitlement with a reason and verify audit log entry.",
      "result": "passed"
    }
  ]
}
```

Run:

```bash
npm run kiwi:sync-manual data/kiwi/admin-tenant-management-2026-04-29.json
```

Expected: Kiwi plan/run URLs printed. Add them to QA report.

### Task 9.5: Final Review

Checklist:

- No unrelated user changes reverted.
- No old migrations edited.
- No mobile files touched.
- No dashboard tenant-switcher regression.
- No admin route accessible from tenant host.
- No shadow impersonation token can call admin routes.
- Strict tenant enforcement works in e2e.
- Admin app builds.
- Dashboard impersonation tests pass.
- Billing org identity is readable.
- Suspension revokes refresh and impersonation sessions.
- Kiwi manual run linked.

Final commit:

```bash
git status --short
git log --oneline --decorate -8
```

Deliver with exact test commands and results.

---

## Recommended Commit Series

1. `docs(admin): capture tenant management remediation baseline`
2. `fix(tenant): stamp authenticated tenant context in jwt guard`
3. `test(admin): prove super-admin routes under strict tenancy`
4. `fix(dashboard): accept admin impersonation shadow tokens`
5. `feat(admin): add tenant lifecycle backend`
6. `feat(admin): add tenant lifecycle UI`
7. `fix(admin): show tenant identity in billing tables`
8. `feat(admin): move tenant entitlements to super-admin`
9. `fix(admin): revoke tenant sessions on suspension`
10. `fix(admin): localize tenant management surfaces`
11. `test(admin): record tenant management manual QA`

## Stop Conditions

Stop and ask before continuing if:

- Prisma migration conflicts with an existing local migration.
- Strict-mode e2e cannot boot after tenant context changes.
- The admin app requires a design change that expands beyond tenant management.
- Creating tenant owner accounts requires a business decision about invitation/email delivery.
- A test failure appears in unrelated mobile files.

## Acceptance Criteria

The work is complete only when:

- Admin can create/update/archive tenant records.
- Admin can suspend/reinstate tenants and session revocation is proven.
- Admin impersonation actually lands in dashboard and displays a shadow-session banner.
- Feature entitlements are controlled from super-admin, not casual tenant dashboard toggles.
- Billing and audit surfaces identify tenants by name/slug/status, not only UUID.
- Strict tenant enforcement is proven in backend e2e.
- Admin app typecheck/lint/build pass.
- Dashboard impersonation/auth tests pass.
- Manual browser QA and Kiwi sync are complete.
