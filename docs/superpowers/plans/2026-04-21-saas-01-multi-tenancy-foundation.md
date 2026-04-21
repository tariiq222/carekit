# SaaS-01 — Multi-tenancy Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce multi-tenancy primitives (Organization, Membership, tenant context, dormant scoping middleware, RLS scaffolding) into the backend without changing single-tenant runtime behavior. By end-of-plan, primitives exist and are tested; Plan 02 will activate them cluster-by-cluster.

**Architecture:** Strangler pattern. Add `Organization` + `Membership` alongside `User`; backfill a single default organization that owns all existing rows (once Plan 02 adds `organizationId` to other tables). Tenant context lives in an async-local store (`nestjs-cls`). A `TenantResolverMiddleware` extracts the org id from the JWT / header / subdomain, but a feature flag (`TENANT_ENFORCEMENT`) keeps the resolver permissive until Plan 02 completes rollout. Prisma scoping middleware and Postgres RLS policies are created dormant — wired but no-op until the flag flips.

**Tech Stack:** NestJS 11, Prisma 7, PostgreSQL 16, `nestjs-cls` 4.x, Jest, `@nestjs/testing`.

---

## File Structure

### New files (created in this plan)

| File | Responsibility |
|---|---|
| `apps/backend/src/common/tenant/tenant-context.service.ts` | Typed wrapper over `ClsService` — get/set current `organizationId`, `membershipId`, user `id`, `role`, `isSuperAdmin`. Field is named `id` (not `userId`) to match the shape `JwtStrategy.validate()` already attaches to `req.user`. |
| `apps/backend/src/common/tenant/tenant-context.service.spec.ts` | Unit tests for context read/write/clear |
| `apps/backend/src/common/tenant/tenant.module.ts` | Global module exporting `TenantContextService` |
| `apps/backend/src/common/tenant/tenant-resolver.middleware.ts` | Resolves org from JWT → header → subdomain; sets CLS context |
| `apps/backend/src/common/tenant/tenant-resolver.middleware.spec.ts` | Unit tests for resolver priority + flag behavior |
| `apps/backend/src/common/tenant/tenant.constants.ts` | `DEFAULT_ORGANIZATION_ID` + error codes |
| `apps/backend/src/common/tenant/tenant.errors.ts` | `TenantResolutionError`, `CrossTenantAccessError` |
| `apps/backend/src/common/tenant/tenant-scoping.extension.ts` | Prisma Client extension that auto-injects `organizationId` (dormant, guarded by flag) |
| `apps/backend/src/common/tenant/tenant-scoping.extension.spec.ts` | Tests proving extension is a no-op when flag off |
| `apps/backend/src/common/tenant/rls.helper.ts` | `SET LOCAL app.current_org_id` helper for raw-SQL handlers |
| `apps/backend/prisma/schema/platform.prisma` | Adds `Organization`, `OrganizationStatus`, `Membership`, `MembershipRole` (this cluster file already exists — we extend it) |
| `apps/backend/prisma/migrations/<ts>_saas01_organization_membership/migration.sql` | Creates `organizations` + `memberships` tables + indexes + `DEFAULT_ORGANIZATION_ID` seed row |
| `apps/backend/prisma/migrations/<ts>_saas01_backfill_memberships/migration.sql` | Backfills `memberships` row for every existing `User` under default org |
| `apps/backend/prisma/migrations/<ts>_saas01_rls_scaffolding/migration.sql` | Creates `app.current_org_id` GUC and RLS policy template (dormant until tables have `organization_id`) |
| `apps/backend/test/tenant-isolation/isolation-harness.ts` | Shared helpers: create 2 orgs, switch context, assert cross-read forbidden |
| `apps/backend/test/tenant-isolation/foundation.e2e-spec.ts` | Smoke tests: default org exists, memberships resolve, context propagates across requests |
| `apps/backend/src/modules/platform/organizations/organization.types.ts` | `Organization` branded types + type guards |
| `apps/backend/docs/saas-tenancy.md` | Engineer-facing guide: how to scope a query, activate RLS, write isolation tests |

### Modified files

| File | Change |
|---|---|
| `apps/backend/package.json` | Add `nestjs-cls@^4.5.0` dependency |
| `apps/backend/src/config/env.validation.ts` | Add `TENANT_ENFORCEMENT` (default `off`) + `DEFAULT_ORGANIZATION_ID` (uuid, has known default) |
| `apps/backend/src/app.module.ts` | Register `ClsModule.forRoot()` and `TenantModule`; apply `TenantResolverMiddleware` globally |
| `apps/backend/src/modules/identity/shared/token.service.ts` | Extend the inline `JwtPayload` interface with optional `organizationId`/`membershipId`/`isSuperAdmin` claims; accept optional `tenantClaims` in `issueTokenPair` and include them in the signed payload. **No separate `jwt-payload.interface.ts` file — the type lives here today and stays here.** |
| `apps/backend/src/modules/identity/jwt.strategy.ts` | Pass claim fields through to `request.user`; **`req.user.id` stays as-is (existing handlers depend on it)** — we add `organizationId`/`membershipId`/`isSuperAdmin` alongside it. |
| `apps/backend/src/modules/identity/login/login.handler.ts` | Resolve active membership on login, pass `{ organizationId, membershipId, isSuperAdmin }` to `tokens.issueTokenPair(user, tenantClaims)`. |
| `apps/backend/src/infrastructure/database/prisma.service.ts` | Apply `tenant-scoping.extension` using Prisma 7's official `$extends` client-extension API (no `Object.assign` hack). If the extended client cannot replace `this` cleanly, fall back to exposing a `tenantScoped` getter — see Task 11. |
| `apps/backend/CLAUDE.md` | Replace "Single-organization mode" note with transitional note pointing to `docs/saas-tenancy.md` |

### Explicitly out of scope (deferred to Plan 02)

- Adding `organizationId` to any table other than `Organization` and `Membership`
- Activating `TENANT_ENFORCEMENT=on` in any environment
- Enabling RLS policies on tenant-scoped tables
- Modifying any existing handler to read `organizationId` from context
- Converting `BrandingConfig` / `OrganizationSettings` / `SiteSetting` from singletons

---

## Invariants (must hold at every task boundary)

1. `npm run typecheck` passes.
2. `npm run test` passes (existing tests unchanged).
3. `npm run test:e2e` passes against a dev database.
4. `TENANT_ENFORCEMENT=off` (default) → runtime behavior identical to main.
5. Every migration added is append-only (root CLAUDE.md rule).

---

## Task 1 — Add `nestjs-cls` dependency + env flags

**Files:**
- Modify: `apps/backend/package.json`
- Modify: `apps/backend/src/config/env.validation.ts`
- Modify: `apps/backend/.env.example`

- [ ] **Step 1.1: Add dependency**

```bash
cd apps/backend && npm install nestjs-cls@^4.5.0
```

Expected: `package.json` shows `"nestjs-cls": "^4.5.0"` in `dependencies`.

- [ ] **Step 1.2: Extend env validation**

Edit `apps/backend/src/config/env.validation.ts`. Add two entries inside the `Joi.object({...})`:

```ts
  // Multi-tenancy (SaaS-01) — flag defaults OFF until Plan 02 rollout
  TENANT_ENFORCEMENT: Joi.string().valid('off', 'permissive', 'strict').default('off'),
  DEFAULT_ORGANIZATION_ID: Joi.string().uuid().default('00000000-0000-0000-0000-000000000001'),
```

- [ ] **Step 1.3: Update `.env.example`**

Append these lines to `apps/backend/.env.example`:

```
# Multi-tenancy (SaaS-01)
# off        — no tenant resolution (single-tenant behavior, default)
# permissive — resolve but fall back to DEFAULT_ORGANIZATION_ID if missing
# strict     — require org on every request; 400 if unresolved
TENANT_ENFORCEMENT=off
DEFAULT_ORGANIZATION_ID=00000000-0000-0000-0000-000000000001
```

- [ ] **Step 1.4: Run typecheck**

```bash
cd apps/backend && npm run typecheck
```

Expected: no errors.

- [ ] **Step 1.5: Commit**

```bash
git add apps/backend/package.json apps/backend/package-lock.json apps/backend/src/config/env.validation.ts apps/backend/.env.example
git commit -m "chore(saas-01): add nestjs-cls + TENANT_ENFORCEMENT env flags"
```

---

## Task 2 — Add `Organization` + `Membership` to schema

**Files:**
- Modify: `apps/backend/prisma/schema/platform.prisma`

- [ ] **Step 2.1: Open platform.prisma and append models**

Edit `apps/backend/prisma/schema/platform.prisma`. Append at the end:

```prisma
// ─── Organization (SaaS-01) ──────────────────────────────────────────────────
// Top-level tenant. Every tenant-scoped row in every cluster will FK to this
// once Plan 02 rolls out. For now only User memberships reference it; the
// default org (id = DEFAULT_ORGANIZATION_ID env var) owns all historical data.

enum OrganizationStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  SUSPENDED
  ARCHIVED
}

model Organization {
  id             String             @id @default(uuid())
  slug           String             @unique
  nameAr         String
  nameEn         String?
  status         OrganizationStatus @default(ACTIVE)
  trialEndsAt    DateTime?
  suspendedAt    DateTime?
  suspendedReason String?
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt

  memberships Membership[]

  @@index([status])
}

// ─── Membership (SaaS-01) ────────────────────────────────────────────────────
// Join table — a User can belong to N organizations with different roles in
// each. Existing JWT `role` claim becomes per-membership (Plan 02 wires this).

enum MembershipRole {
  OWNER
  ADMIN
  RECEPTIONIST
  ACCOUNTANT
  EMPLOYEE
}

model Membership {
  id             String         @id @default(uuid())
  userId         String
  organizationId String
  role           MembershipRole @default(RECEPTIONIST)
  isActive       Boolean        @default(true)
  acceptedAt     DateTime?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([userId, organizationId])
  @@index([userId])
  @@index([organizationId])
}
```

- [ ] **Step 2.2: Run prisma format + validate**

```bash
cd apps/backend && npx prisma format && npx prisma validate
```

Expected: "The schema is valid 🚀" (or equivalent success).

- [ ] **Step 2.3: Commit**

```bash
git add apps/backend/prisma/schema/platform.prisma
git commit -m "feat(saas-01): add Organization + Membership Prisma models"
```

---

## Task 3 — Create migration for Organization + Membership + default org seed

**Files:**
- Create: `apps/backend/prisma/migrations/<TIMESTAMP>_saas01_organization_membership/migration.sql`

- [ ] **Step 3.1: Generate migration SQL (without applying)**

```bash
cd apps/backend && npx prisma migrate dev --name saas01_organization_membership --create-only
```

Expected: new folder under `prisma/migrations/` containing `migration.sql`. Prisma will have generated `CREATE TABLE` + `CREATE INDEX` statements.

- [ ] **Step 3.2: Append seed for default organization**

At the **end** of the generated `migration.sql`, append:

```sql
-- Seed the default organization that will own all historical data.
-- UUID matches DEFAULT_ORGANIZATION_ID env default. Deployments that set a
-- custom DEFAULT_ORGANIZATION_ID must run an additional one-off script to
-- update this row (documented in docs/saas-tenancy.md).
INSERT INTO "Organization" (id, slug, "nameAr", "nameEn", status, "createdAt", "updatedAt")
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'default',
  'Default Organization',
  'Default Organization',
  'ACTIVE',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 3.3: Apply migration**

```bash
cd apps/backend && npx prisma migrate dev
```

Expected: migration applies, client regenerates, no errors. If it fails because of existing data in dev db, run `npm run docker:down && npm run docker:up && npx prisma migrate dev` (fresh db).

- [ ] **Step 3.4: Verify default org exists**

```bash
cd apps/backend && npx prisma studio
```

Manually: open Prisma Studio, look at `Organization` table, confirm 1 row with slug=`default`.

Or via CLI:

```bash
cd apps/backend && node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.organization.findMany().then(r => { console.log(r); p.\$disconnect(); });
"
```

Expected: one row with `id='00000000-0000-0000-0000-000000000001'`, `slug='default'`.

- [ ] **Step 3.5: Commit**

```bash
git add apps/backend/prisma/migrations/*_saas01_organization_membership
git commit -m "feat(saas-01): migration — Organization + Membership + default org seed"
```

---

## Task 4 — Backfill memberships for every existing user

**Files:**
- Create: `apps/backend/prisma/migrations/<TIMESTAMP>_saas01_backfill_memberships/migration.sql`

- [ ] **Step 4.1: Create migration folder**

```bash
cd apps/backend && TS=$(date -u +%Y%m%d%H%M%S) && mkdir -p prisma/migrations/${TS}_saas01_backfill_memberships
```

- [ ] **Step 4.2: Write backfill SQL**

Create the file `apps/backend/prisma/migrations/<TS>_saas01_backfill_memberships/migration.sql` with this content:

```sql
-- Backfill: one Membership per existing User under the default organization.
-- Maps User.role (UserRole enum) -> MembershipRole enum. Unknown roles default to RECEPTIONIST.
-- CLIENT users are excluded — they are website clients, not clinic staff, and
-- must not receive a staff membership under the default org.
-- Idempotent: ON CONFLICT DO NOTHING uses the (userId, organizationId) unique.

INSERT INTO "Membership" (id, "userId", "organizationId", role, "isActive", "acceptedAt", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  u.id,
  '00000000-0000-0000-0000-000000000001',
  CASE u.role::text
    WHEN 'SUPER_ADMIN'  THEN 'OWNER'::"MembershipRole"
    WHEN 'ADMIN'        THEN 'ADMIN'::"MembershipRole"
    WHEN 'RECEPTIONIST' THEN 'RECEPTIONIST'::"MembershipRole"
    WHEN 'ACCOUNTANT'   THEN 'ACCOUNTANT'::"MembershipRole"
    WHEN 'EMPLOYEE'     THEN 'EMPLOYEE'::"MembershipRole"
    ELSE 'RECEPTIONIST'::"MembershipRole"
  END,
  TRUE,
  u."createdAt",
  NOW(),
  NOW()
FROM "User" u
WHERE u.role::text <> 'CLIENT'
ON CONFLICT ("userId", "organizationId") DO NOTHING;
```

**Amendment 2026-04-21:** Added `WHERE u.role::text <> 'CLIENT'`. `UserRole` has a `CLIENT` member (website users). Per [backend CLAUDE.md "Client Auth" section](../../apps/backend/CLAUDE.md), client auth is a fully isolated token namespace; client users must not receive a clinic-staff membership. The plan's original `ELSE 'RECEPTIONIST'` would have mapped every CLIENT user to a receptionist, which is wrong.

- [ ] **Step 4.3: Register the migration in Prisma's history**

Run:

```bash
cd apps/backend && npx prisma migrate dev
```

Expected: Prisma applies the new SQL file. Confirms "Your database is now in sync with your schema."

- [ ] **Step 4.4: Verify**

```bash
cd apps/backend && node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
Promise.all([p.user.count(), p.membership.count()]).then(([u,m]) => {
  console.log({users: u, memberships: m});
  if (u !== m) { console.error('MISMATCH'); process.exit(1); }
  p.\$disconnect();
});
"
```

Expected: `users` equals `memberships`. If the dev db is empty that's fine — both are 0.

- [ ] **Step 4.5: Commit**

```bash
git add apps/backend/prisma/migrations/*_saas01_backfill_memberships
git commit -m "feat(saas-01): migration — backfill memberships for existing users"
```

---

## Task 5 — Tenant constants + errors

**Files:**
- Create: `apps/backend/src/common/tenant/tenant.constants.ts`
- Create: `apps/backend/src/common/tenant/tenant.errors.ts`

- [ ] **Step 5.1: Create constants file**

Create `apps/backend/src/common/tenant/tenant.constants.ts`:

```ts
/**
 * Well-known tenant identifiers and error codes.
 * Values must match prisma/migrations/*_saas01_organization_membership seed.
 */
export const DEFAULT_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000001';
export const DEFAULT_ORGANIZATION_SLUG = 'default';

export const TENANT_CLS_KEY = 'tenant' as const;

export const TENANT_ERROR_CODES = {
  RESOLUTION_FAILED: 'TENANT_RESOLUTION_FAILED',
  CROSS_TENANT_ACCESS: 'TENANT_CROSS_ACCESS',
  NOT_MEMBER: 'TENANT_NOT_MEMBER',
  ORG_SUSPENDED: 'TENANT_ORG_SUSPENDED',
} as const;

export type TenantEnforcementMode = 'off' | 'permissive' | 'strict';
```

- [ ] **Step 5.2: Create errors file**

Create `apps/backend/src/common/tenant/tenant.errors.ts`:

```ts
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TENANT_ERROR_CODES } from './tenant.constants';

export class TenantResolutionError extends BadRequestException {
  constructor(reason: string) {
    super({ code: TENANT_ERROR_CODES.RESOLUTION_FAILED, message: reason });
  }
}

export class CrossTenantAccessError extends ForbiddenException {
  constructor(resource: string, expectedOrgId: string, actualOrgId: string) {
    super({
      code: TENANT_ERROR_CODES.CROSS_TENANT_ACCESS,
      message: `Cross-tenant access attempt on ${resource}`,
      expectedOrgId,
      actualOrgId,
    });
  }
}

export class OrganizationSuspendedError extends ForbiddenException {
  constructor(organizationId: string) {
    super({
      code: TENANT_ERROR_CODES.ORG_SUSPENDED,
      message: 'Organization is suspended',
      organizationId,
    });
  }
}
```

- [ ] **Step 5.3: Run typecheck**

```bash
cd apps/backend && npm run typecheck
```

Expected: no errors.

- [ ] **Step 5.4: Commit**

```bash
git add apps/backend/src/common/tenant/tenant.constants.ts apps/backend/src/common/tenant/tenant.errors.ts
git commit -m "feat(saas-01): tenant constants + error types"
```

---

## Task 6 — `TenantContextService` (wraps ClsService)

**Files:**
- Create: `apps/backend/src/common/tenant/tenant-context.service.ts`
- Create: `apps/backend/src/common/tenant/tenant-context.service.spec.ts`

- [ ] **Step 6.1: Write the failing test first**

Create `apps/backend/src/common/tenant/tenant-context.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { ClsModule, ClsService } from 'nestjs-cls';
import { TenantContextService, TenantContext } from './tenant-context.service';

describe('TenantContextService', () => {
  let cls: ClsService;
  let svc: TenantContextService;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      imports: [ClsModule.forRoot({ global: true, middleware: { mount: false } })],
      providers: [TenantContextService],
    }).compile();

    cls = mod.get(ClsService);
    svc = mod.get(TenantContextService);
  });

  const ctx: TenantContext = {
    organizationId: 'org-1',
    membershipId: 'mem-1',
    id: 'user-1',
    role: 'ADMIN',
    isSuperAdmin: false,
  };

  it('returns undefined when context is not set', () => {
    cls.run(() => {
      expect(svc.get()).toBeUndefined();
      expect(svc.getOrganizationId()).toBeUndefined();
    });
  });

  it('stores and reads context within a CLS run', () => {
    cls.run(() => {
      svc.set(ctx);
      expect(svc.get()).toEqual(ctx);
      expect(svc.getOrganizationId()).toBe('org-1');
      expect(svc.getMembershipId()).toBe('mem-1');
    });
  });

  it('isolates context per run', async () => {
    await Promise.all([
      cls.run(async () => {
        svc.set({ ...ctx, organizationId: 'org-A' });
        await new Promise((r) => setTimeout(r, 10));
        expect(svc.getOrganizationId()).toBe('org-A');
      }),
      cls.run(async () => {
        svc.set({ ...ctx, organizationId: 'org-B' });
        await new Promise((r) => setTimeout(r, 10));
        expect(svc.getOrganizationId()).toBe('org-B');
      }),
    ]);
  });

  it('requireOrganizationId throws when missing', () => {
    cls.run(() => {
      expect(() => svc.requireOrganizationId()).toThrow(/tenant context not set/i);
    });
  });

  it('requireOrganizationId returns the id when set', () => {
    cls.run(() => {
      svc.set(ctx);
      expect(svc.requireOrganizationId()).toBe('org-1');
    });
  });
});
```

- [ ] **Step 6.2: Run the test — confirm it fails**

```bash
cd apps/backend && npx jest src/common/tenant/tenant-context.service.spec.ts
```

Expected: failure, because `tenant-context.service.ts` does not exist.

- [ ] **Step 6.3: Implement the service**

Create `apps/backend/src/common/tenant/tenant-context.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { TENANT_CLS_KEY } from './tenant.constants';

export interface TenantContext {
  organizationId: string;
  membershipId: string;
  /** User id — named `id` to match the shape `JwtStrategy.validate()` already
   *  attaches to `req.user` (see `jwt.strategy.ts`). Renaming to `userId`
   *  would force a cascade rewrite of every guard and handler. */
  id: string;
  role: string;
  isSuperAdmin: boolean;
}

@Injectable()
export class TenantContextService {
  constructor(private readonly cls: ClsService) {}

  set(ctx: TenantContext): void {
    this.cls.set(TENANT_CLS_KEY, ctx);
  }

  get(): TenantContext | undefined {
    return this.cls.get<TenantContext | undefined>(TENANT_CLS_KEY);
  }

  getOrganizationId(): string | undefined {
    return this.get()?.organizationId;
  }

  getMembershipId(): string | undefined {
    return this.get()?.membershipId;
  }

  requireOrganizationId(): string {
    const id = this.getOrganizationId();
    if (!id) throw new Error('Tenant context not set — no organizationId available');
    return id;
  }

  isSuperAdmin(): boolean {
    return this.get()?.isSuperAdmin === true;
  }

  clear(): void {
    this.cls.set(TENANT_CLS_KEY, undefined);
  }
}
```

- [ ] **Step 6.4: Run the test — confirm it passes**

```bash
cd apps/backend && npx jest src/common/tenant/tenant-context.service.spec.ts
```

Expected: all 5 specs pass.

- [ ] **Step 6.5: Commit**

```bash
git add apps/backend/src/common/tenant/tenant-context.service.ts apps/backend/src/common/tenant/tenant-context.service.spec.ts
git commit -m "feat(saas-01): TenantContextService wrapping nestjs-cls"
```

---

## Task 7 — `TenantModule` + global registration

**Files:**
- Create: `apps/backend/src/common/tenant/tenant.module.ts`
- Create: `apps/backend/src/common/tenant/index.ts`
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 7.1: Create the module**

Create `apps/backend/src/common/tenant/tenant.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';

@Global()
@Module({
  providers: [TenantContextService],
  exports: [TenantContextService],
})
export class TenantModule {}
```

- [ ] **Step 7.2: Barrel export**

Create `apps/backend/src/common/tenant/index.ts`:

```ts
export * from './tenant.module';
export * from './tenant-context.service';
export * from './tenant.constants';
export * from './tenant.errors';
```

- [ ] **Step 7.3: Register `ClsModule` + `TenantModule` in `AppModule`**

Open `apps/backend/src/app.module.ts`. Add these imports at the top:

```ts
import { ClsModule } from 'nestjs-cls';
import { TenantModule } from './common/tenant';
```

Inside `@Module({ imports: [...] })`, add **at the very top of the imports list** so CLS wraps everything:

```ts
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    TenantModule,
```

- [ ] **Step 7.4: Verify boot**

```bash
cd apps/backend && npm run typecheck && npm run test -- --testPathPattern='tenant'
```

Expected: typecheck passes; tenant-context tests still pass.

- [ ] **Step 7.5: Commit**

```bash
git add apps/backend/src/common/tenant/tenant.module.ts apps/backend/src/common/tenant/index.ts apps/backend/src/app.module.ts
git commit -m "feat(saas-01): register ClsModule + global TenantModule"
```

---

## Task 8 — Extend JWT payload type + `JwtStrategy`

**Context check (already confirmed before plan execution):** the `JwtPayload` interface lives **inline** in `apps/backend/src/modules/identity/shared/token.service.ts` (exported alongside `TokenPair` and `TokenService`). There is **no** `src/common/auth/jwt-payload.interface.ts`. This task edits `token.service.ts` directly. The strategy attaches the user to `req.user` with the field name `id` (not `userId`) — we keep that and only add tenant fields alongside.

**Files:**
- Modify: `apps/backend/src/modules/identity/shared/token.service.ts`
- Modify: `apps/backend/src/modules/identity/jwt.strategy.ts`
- Modify: `apps/backend/src/modules/identity/jwt.strategy.spec.ts`

- [ ] **Step 8.1: Extend the inline `JwtPayload` in `token.service.ts`**

Open `apps/backend/src/modules/identity/shared/token.service.ts`. The existing interface looks like:

```ts
export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  customRoleId: string | null;
  permissions: Array<{ action: string; subject: string }>;
  features: string[];
}
```

Add three optional fields (do not remove anything):

```ts
export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  customRoleId: string | null;
  permissions: Array<{ action: string; subject: string }>;
  features: string[];
  // SaaS-01 — optional during rollout; Plan 02 makes them required.
  organizationId?: string;
  membershipId?: string;
  isSuperAdmin?: boolean;
}
```

(Task 9 will wire `issueTokenPair` to actually include those fields when called with `tenantClaims`. This step is just the type.)

- [ ] **Step 8.2: Update `JwtStrategy.validate()`**

Open `apps/backend/src/modules/identity/jwt.strategy.ts`. The existing method returns an object whose user id field is `id`. Do **not** rename `id` to `userId` — every guard and handler in the codebase reads `req.user.id`. Instead, add the three tenant fields alongside:

```ts
async validate(payload: JwtPayload) {
  const user = await this.prisma.user.findUnique({
    where: { id: payload.sub },
    include: { customRole: { include: { permissions: true } } },
  });

  if (!user || !user.isActive) throw new UnauthorizedException('User not found or inactive');

  const ability = this.casl.buildForUser(user);

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    customRoleId: user.customRoleId,
    permissions: ability.rules.flatMap((r) => {
      const actions = Array.isArray(r.action) ? r.action : [r.action];
      return actions.map((a) => ({ action: String(a), subject: String(r.subject) }));
    }),
    features: payload.features ?? [],
    // SaaS-01 — tenant claims passed through from JWT. Undefined in off/legacy tokens.
    organizationId: payload.organizationId,
    membershipId: payload.membershipId,
    isSuperAdmin: payload.isSuperAdmin === true || user.role === 'SUPER_ADMIN',
  };
}
```

Note: `isSuperAdmin` falls back to the DB role check so the flag is correct even for legacy tokens issued before SaaS-01.

- [ ] **Step 8.3: Update strategy spec**

Append to `apps/backend/src/modules/identity/jwt.strategy.spec.ts` inside the existing describe block:

```ts
it('propagates organizationId and membershipId when present in payload', async () => {
  // Assumes the existing spec sets up `prisma.user.findUnique` + `casl` mocks.
  // Reuse the same mock user with role: 'ADMIN' / isActive: true.
  const result = await strategy.validate({
    sub: 'user-1',
    email: 'a@b.c',
    role: 'ADMIN',
    customRoleId: null,
    permissions: [],
    features: [],
    organizationId: 'org-1',
    membershipId: 'mem-1',
  } as any);
  expect(result.organizationId).toBe('org-1');
  expect(result.membershipId).toBe('mem-1');
  expect(result.isSuperAdmin).toBe(false);
});

it('treats missing tenant claims as undefined (backward compat)', async () => {
  const result = await strategy.validate({
    sub: 'user-1',
    email: 'a@b.c',
    role: 'ADMIN',
    customRoleId: null,
    permissions: [],
    features: [],
  } as any);
  expect(result.organizationId).toBeUndefined();
  expect(result.membershipId).toBeUndefined();
  expect(result.isSuperAdmin).toBe(false);
});

it('marks isSuperAdmin true when the DB user has role SUPER_ADMIN', async () => {
  // The spec must override the prisma mock for this test so findUnique
  // returns a user with role: 'SUPER_ADMIN'. Pattern:
  //   (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ ...baseUser, role: 'SUPER_ADMIN' });
  (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
    id: 'u1', isActive: true, email: 'a@b.c', role: 'SUPER_ADMIN',
    customRoleId: null, customRole: null,
  });
  const result = await strategy.validate({
    sub: 'u1', email: 'a@b.c', role: 'SUPER_ADMIN',
    customRoleId: null, permissions: [], features: [],
  } as any);
  expect(result.isSuperAdmin).toBe(true);
});
```

If the existing spec's mock variable is not named `prisma`, adapt the last test to match. (Read the top of the existing spec first.)

- [ ] **Step 8.4: Run the strategy test**

```bash
cd apps/backend && npx jest jwt.strategy.spec.ts
```

Expected: all tests pass, including the 3 new ones.

- [ ] **Step 8.5: Commit**

```bash
git add apps/backend/src/modules/identity/shared/token.service.ts apps/backend/src/modules/identity/jwt.strategy.ts apps/backend/src/modules/identity/jwt.strategy.spec.ts
git commit -m "feat(saas-01): extend JwtPayload with optional organizationId/membershipId/isSuperAdmin"
```

---

## Task 9 — Login handler resolves active membership + TokenService includes claims

**Context check (already confirmed before plan execution):** `LoginHandler` does **not** sign JWTs directly — it delegates to `TokenService.issueTokenPair(user)` in `src/modules/identity/shared/token.service.ts`. To include tenant claims without duplicating JWT logic, we:
1. Resolve the active `Membership` in `LoginHandler`.
2. Pass the resolved `{ organizationId, membershipId, isSuperAdmin }` as an optional second argument to `TokenService.issueTokenPair`.
3. `TokenService` merges those into the signed payload when provided.

This keeps signing in one place and keeps the handler's job (authentication + membership lookup) explicit.

**Files:**
- Modify: `apps/backend/src/modules/identity/shared/token.service.ts`
- Modify: `apps/backend/src/modules/identity/shared/token.service.spec.ts` (if present — append cases)
- Modify: `apps/backend/src/modules/identity/login/login.handler.ts`
- Modify: `apps/backend/src/modules/identity/login/login.handler.spec.ts`

- [ ] **Step 9.1: Read the existing `TokenService` + `LoginHandler`**

```bash
cd apps/backend && cat src/modules/identity/shared/token.service.ts src/modules/identity/login/login.handler.ts
```

Confirm: `LoginHandler` calls `this.tokens.issueTokenPair(user)`; `TokenService.issueTokenPair` signs the JWT via `this.jwt.sign(payload, ...)`. The payload is built from `user` fields.

- [ ] **Step 9.2: Extend `TokenService.issueTokenPair` with an optional `tenantClaims` param**

Open `apps/backend/src/modules/identity/shared/token.service.ts`. Add a `TenantClaims` type above the class and accept it as a second arg:

```ts
export interface TenantClaims {
  organizationId: string;
  membershipId?: string;
  isSuperAdmin?: boolean;
}

// ... inside the class:
async issueTokenPair(
  user: {
    id: string;
    email: string;
    role: string;
    customRoleId: string | null;
    customRole: { permissions: Array<{ action: string; subject: string }> } | null;
  },
  tenantClaims?: TenantClaims,
): Promise<TokenPair> {
  const permissions = user.customRole?.permissions ?? [];
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    customRoleId: user.customRoleId,
    permissions,
    features: [],
    // SaaS-01 — tenant claims are opt-in; legacy callers that pass no second
    // arg produce exactly the same token as before this change.
    ...(tenantClaims?.organizationId ? { organizationId: tenantClaims.organizationId } : {}),
    ...(tenantClaims?.membershipId ? { membershipId: tenantClaims.membershipId } : {}),
    ...(tenantClaims?.isSuperAdmin ? { isSuperAdmin: true } : {}),
  };
  // ... rest of the method unchanged (signs accessToken, creates refresh row, returns pair)
}
```

Do not remove or reorder any existing field in `payload`. The three new lines are pure additions guarded by the optional arg.

- [ ] **Step 9.3: Write the failing test for `LoginHandler`**

Append to `apps/backend/src/modules/identity/login/login.handler.spec.ts` (adapt the setup factory names to whatever the existing file uses):

```ts
describe('LoginHandler — SaaS-01 tenant claims', () => {
  it('passes the active membership to TokenService.issueTokenPair', async () => {
    // Given a user with a backfilled membership under the default org,
    // the handler must look it up and forward it as tenantClaims.
    const membership = {
      id: 'mem-1',
      userId: 'user-1',
      organizationId: '00000000-0000-0000-0000-000000000001',
      role: 'ADMIN',
      isActive: true,
    };
    (prisma.membership.findFirst as jest.Mock).mockResolvedValueOnce(membership);

    await handler.execute({ email: 'admin@example.com', password: 'Passw0rd!' });

    expect(tokens.issueTokenPair).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.any(String) }),
      {
        organizationId: '00000000-0000-0000-0000-000000000001',
        membershipId: 'mem-1',
        isSuperAdmin: false,
      },
    );
  });

  it('falls back to DEFAULT_ORGANIZATION_ID when user has no membership row', async () => {
    (prisma.membership.findFirst as jest.Mock).mockResolvedValueOnce(null);
    await handler.execute({ email: 'legacy@example.com', password: 'Passw0rd!' });
    expect(tokens.issueTokenPair).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        organizationId: '00000000-0000-0000-0000-000000000001',
        membershipId: undefined,
      }),
    );
  });

  it('marks isSuperAdmin true when user.role is SUPER_ADMIN', async () => {
    // Adapt the user fixture in your existing `beforeEach` to override role.
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'u1', isActive: true, email: 'sa@example.com', role: 'SUPER_ADMIN',
      passwordHash: 'hashed', customRoleId: null, customRole: null,
    });
    (prisma.membership.findFirst as jest.Mock).mockResolvedValueOnce(null);
    await handler.execute({ email: 'sa@example.com', password: 'Passw0rd!' });
    expect(tokens.issueTokenPair).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ isSuperAdmin: true }),
    );
  });
});
```

Spec prerequisites (add if not already present in the existing setup):
- `prisma.membership = { findFirst: jest.fn() }` in the mock prisma object
- `tokens = { issueTokenPair: jest.fn().mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' }) }` as the TokenService mock
- Make sure the default `beforeEach` stub for `prisma.membership.findFirst` returns `null` to avoid cross-test leakage.

- [ ] **Step 9.4: Run the test — confirm it fails**

```bash
cd apps/backend && npx jest login.handler.spec.ts
```

Expected: the three new cases fail (handler does not yet call `membership.findFirst` nor pass `tenantClaims`).

- [ ] **Step 9.5: Implement in `LoginHandler`**

Edit `apps/backend/src/modules/identity/login/login.handler.ts`. After the password check succeeds and before `this.tokens.issueTokenPair`, resolve membership:

```ts
import { DEFAULT_ORGANIZATION_ID } from '../../../common/tenant';

// ... inside execute(), after `if (!valid) throw ...`:
const membership = await this.prisma.membership.findFirst({
  where: { userId: user.id, isActive: true },
  orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  select: { id: true, organizationId: true },
});

return this.tokens.issueTokenPair(user, {
  organizationId: membership?.organizationId ?? DEFAULT_ORGANIZATION_ID,
  membershipId: membership?.id,
  isSuperAdmin: user.role === 'SUPER_ADMIN',
});
```

Keep all existing error handling and the original method signature.

- [ ] **Step 9.6: Rerun the login tests**

```bash
cd apps/backend && npx jest login.handler.spec.ts
```

Expected: all tests pass, including the three new ones.

- [ ] **Step 9.7: Commit**

```bash
git add apps/backend/src/modules/identity/shared/token.service.ts apps/backend/src/modules/identity/login/login.handler.ts apps/backend/src/modules/identity/login/login.handler.spec.ts
git commit -m "feat(saas-01): LoginHandler resolves active membership; TokenService emits tenant claims"
```

---

## Task 10 — `TenantResolverMiddleware`

**Files:**
- Create: `apps/backend/src/common/tenant/tenant-resolver.middleware.ts`
- Create: `apps/backend/src/common/tenant/tenant-resolver.middleware.spec.ts`
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 10.1: Write the failing test**

Create `apps/backend/src/common/tenant/tenant-resolver.middleware.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { ClsModule, ClsService } from 'nestjs-cls';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TenantContextService } from './tenant-context.service';
import { TenantResolverMiddleware } from './tenant-resolver.middleware';
import { TenantResolutionError } from './tenant.errors';
import { DEFAULT_ORGANIZATION_ID } from './tenant.constants';

describe('TenantResolverMiddleware', () => {
  let cls: ClsService;
  let ctx: TenantContextService;

  const build = async (envOverrides: Record<string, string> = {}) => {
    const mod = await Test.createTestingModule({
      imports: [
        ClsModule.forRoot({ global: true, middleware: { mount: false } }),
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ TENANT_ENFORCEMENT: 'off', DEFAULT_ORGANIZATION_ID, ...envOverrides })],
        }),
      ],
      providers: [TenantContextService, TenantResolverMiddleware],
    }).compile();
    cls = mod.get(ClsService);
    ctx = mod.get(TenantContextService);
    return mod.get(TenantResolverMiddleware);
  };

  const req = (overrides: Partial<{ user: any; headers: any; hostname: string }> = {}) => ({
    user: undefined,
    headers: {},
    hostname: 'localhost',
    ...overrides,
  }) as any;

  it('off mode: does not set context, does not throw when unresolved', async () => {
    const mw = await build({ TENANT_ENFORCEMENT: 'off' });
    await new Promise<void>((done) => {
      cls.run(() => mw.use(req(), {} as any, () => {
        expect(ctx.get()).toBeUndefined();
        done();
      }));
    });
  });

  it('permissive mode: falls back to default org when unresolved', async () => {
    const mw = await build({ TENANT_ENFORCEMENT: 'permissive' });
    await new Promise<void>((done) => {
      cls.run(() => mw.use(req(), {} as any, () => {
        expect(ctx.getOrganizationId()).toBe(DEFAULT_ORGANIZATION_ID);
        done();
      }));
    });
  });

  it('permissive mode: prefers JWT claim over default', async () => {
    const mw = await build({ TENANT_ENFORCEMENT: 'permissive' });
    await new Promise<void>((done) => {
      cls.run(() =>
        mw.use(
          req({ user: { id: 'u1', organizationId: 'org-jwt', membershipId: 'm1', role: 'ADMIN' } }),
          {} as any,
          () => {
            expect(ctx.getOrganizationId()).toBe('org-jwt');
            done();
          },
        ),
      );
    });
  });

  it('strict mode: throws when no source resolves an org', async () => {
    const mw = await build({ TENANT_ENFORCEMENT: 'strict' });
    expect(() =>
      cls.run(() => mw.use(req(), {} as any, () => undefined)),
    ).toThrow(TenantResolutionError);
  });

  it('strict mode: accepts explicit header when super-admin', async () => {
    const mw = await build({ TENANT_ENFORCEMENT: 'strict' });
    await new Promise<void>((done) => {
      cls.run(() =>
        mw.use(
          req({
            user: { id: 'u1', role: 'SUPER_ADMIN', isSuperAdmin: true },
            headers: { 'x-org-id': 'org-header' },
          }),
          {} as any,
          () => {
            expect(ctx.getOrganizationId()).toBe('org-header');
            done();
          },
        ),
      );
    });
  });

  it('strict mode: ignores x-org-id from non-super-admin (security)', async () => {
    const mw = await build({ TENANT_ENFORCEMENT: 'strict' });
    await new Promise<void>((done) => {
      cls.run(() =>
        mw.use(
          req({
            user: { id: 'u1', organizationId: 'org-jwt', role: 'ADMIN' },
            headers: { 'x-org-id': 'org-attacker' },
          }),
          {} as any,
          () => {
            expect(ctx.getOrganizationId()).toBe('org-jwt'); // JWT wins
            done();
          },
        ),
      );
    });
  });
});
```

- [ ] **Step 10.2: Run the test — confirm it fails**

```bash
cd apps/backend && npx jest tenant-resolver.middleware.spec.ts
```

Expected: failure because file does not exist.

- [ ] **Step 10.3: Implement the middleware**

Create `apps/backend/src/common/tenant/tenant-resolver.middleware.ts`:

```ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { TenantContextService } from './tenant-context.service';
import { DEFAULT_ORGANIZATION_ID, TenantEnforcementMode } from './tenant.constants';
import { TenantResolutionError } from './tenant.errors';

interface AuthenticatedRequest extends Request {
  user?: {
    // Matches the shape attached by JwtStrategy.validate() — field is `id`,
    // not `userId`. Every guard/handler in the codebase already reads `id`.
    id?: string;
    organizationId?: string;
    membershipId?: string;
    role?: string;
    isSuperAdmin?: boolean;
  };
}

@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly config: ConfigService,
  ) {}

  use(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
    const mode = this.config.get<TenantEnforcementMode>('TENANT_ENFORCEMENT', 'off');

    if (mode === 'off') {
      return next();
    }

    // Priority:
    //   1. JWT claim (authenticated users)
    //   2. X-Org-Id header (super-admins only — never trusted from regular users)
    //   3. Subdomain resolver (added in Plan 09)
    //   4. DEFAULT_ORGANIZATION_ID (permissive mode only)
    const fromJwt = req.user?.organizationId;
    const fromHeader =
      req.user?.isSuperAdmin === true
        ? (req.headers['x-org-id'] as string | undefined)
        : undefined;
    const fromDefault =
      mode === 'permissive'
        ? this.config.get<string>('DEFAULT_ORGANIZATION_ID', DEFAULT_ORGANIZATION_ID)
        : undefined;

    const organizationId = fromJwt ?? fromHeader ?? fromDefault;

    if (!organizationId) {
      throw new TenantResolutionError(
        'Unable to resolve tenant — no JWT claim, no valid header, strict mode active',
      );
    }

    this.ctx.set({
      organizationId,
      membershipId: req.user?.membershipId ?? '',
      id: req.user?.id ?? '',
      role: req.user?.role ?? '',
      isSuperAdmin: req.user?.isSuperAdmin === true,
    });

    next();
  }
}
```

- [ ] **Step 10.4: Run the test — confirm it passes**

```bash
cd apps/backend && npx jest tenant-resolver.middleware.spec.ts
```

Expected: all 6 specs pass.

- [ ] **Step 10.5: Wire the middleware globally**

Open `apps/backend/src/app.module.ts`. Add:

```ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TenantResolverMiddleware } from './common/tenant/tenant-resolver.middleware';
// ... other imports

export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Apply after Passport populates req.user. Wildcard covers all routes;
    // unauthenticated routes simply skip enforcement in 'off' mode.
    consumer.apply(TenantResolverMiddleware).forRoutes('*');
  }
}
```

If `AppModule` already implements `NestModule` with a `configure` method, merge — don't replace.

- [ ] **Step 10.6: Provide the middleware**

In the same `AppModule`, ensure `TenantResolverMiddleware` is listed in `providers: [...]` (NestJS injects middleware from the DI container):

```ts
providers: [
  // ... existing
  TenantResolverMiddleware,
],
```

- [ ] **Step 10.7: Run full backend test suite**

```bash
cd apps/backend && npm run test
```

Expected: all tests pass. No regressions.

- [ ] **Step 10.8: Commit**

```bash
git add apps/backend/src/common/tenant/tenant-resolver.middleware.ts apps/backend/src/common/tenant/tenant-resolver.middleware.spec.ts apps/backend/src/app.module.ts
git commit -m "feat(saas-01): TenantResolverMiddleware (JWT > X-Org-Id > default)"
```

---

## Task 11 — Prisma tenant-scoping extension (dormant)

**Files:**
- Create: `apps/backend/src/common/tenant/tenant-scoping.extension.ts`
- Create: `apps/backend/src/common/tenant/tenant-scoping.extension.spec.ts`
- Modify: `apps/backend/src/infrastructure/database/prisma.service.ts`

- [ ] **Step 11.1: Write the failing test**

Create `apps/backend/src/common/tenant/tenant-scoping.extension.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { ClsModule, ClsService } from 'nestjs-cls';
import { ConfigModule } from '@nestjs/config';
import { TenantContextService } from './tenant-context.service';
import { buildTenantScopingExtension, TenantScopedModelRegistry } from './tenant-scoping.extension';

describe('tenant-scoping extension', () => {
  let cls: ClsService;
  let ctx: TenantContextService;

  const buildCtx = async (enforcement: string) => {
    const mod = await Test.createTestingModule({
      imports: [
        ClsModule.forRoot({ global: true, middleware: { mount: false } }),
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ TENANT_ENFORCEMENT: enforcement })],
        }),
      ],
      providers: [TenantContextService],
    }).compile();
    cls = mod.get(ClsService);
    ctx = mod.get(TenantContextService);
  };

  it('returns identity no-op when TENANT_ENFORCEMENT=off', async () => {
    await buildCtx('off');
    const ext = buildTenantScopingExtension(ctx, 'off', new Set());
    expect(ext.query).toBeUndefined();
  });

  it('registers a query hook when TENANT_ENFORCEMENT!=off', async () => {
    await buildCtx('permissive');
    const ext = buildTenantScopingExtension(ctx, 'permissive', new Set(['User']));
    expect(ext.query?.$allModels).toBeDefined();
  });

  it('scopes findMany by injecting organizationId when model is registered', async () => {
    await buildCtx('permissive');
    const ext = buildTenantScopingExtension(ctx, 'permissive', new Set(['User']));
    const hook = ext.query!.$allModels.$allOperations!;

    cls.run(async () => {
      ctx.set({
        organizationId: 'org-1',
        membershipId: 'm1',
        id: 'u1',
        role: 'ADMIN',
        isSuperAdmin: false,
      });
      const query = jest.fn().mockResolvedValue([]);
      await hook({ model: 'User', operation: 'findMany', args: { where: { id: 'x' } }, query } as any);
      expect(query).toHaveBeenCalledWith({
        where: { id: 'x', organizationId: 'org-1' },
      });
    });
  });

  it('does not scope unregistered models', async () => {
    await buildCtx('permissive');
    const ext = buildTenantScopingExtension(ctx, 'permissive', new Set(['User']));
    const hook = ext.query!.$allModels.$allOperations!;

    cls.run(async () => {
      ctx.set({
        organizationId: 'org-1',
        membershipId: 'm1',
        id: 'u1',
        role: 'ADMIN',
        isSuperAdmin: false,
      });
      const query = jest.fn().mockResolvedValue([]);
      await hook({ model: 'OtpCode', operation: 'findMany', args: { where: {} }, query } as any);
      expect(query).toHaveBeenCalledWith({ where: {} });
    });
  });

  it('bypasses scoping for super-admin context', async () => {
    await buildCtx('permissive');
    const ext = buildTenantScopingExtension(ctx, 'permissive', new Set(['User']));
    const hook = ext.query!.$allModels.$allOperations!;

    cls.run(async () => {
      ctx.set({
        organizationId: 'org-1',
        membershipId: 'm1',
        id: 'u1',
        role: 'SUPER_ADMIN',
        isSuperAdmin: true,
      });
      const query = jest.fn().mockResolvedValue([]);
      await hook({ model: 'User', operation: 'findMany', args: { where: {} }, query } as any);
      expect(query).toHaveBeenCalledWith({ where: {} });
    });
  });
});
```

- [ ] **Step 11.2: Run the test — confirm it fails**

```bash
cd apps/backend && npx jest tenant-scoping.extension.spec.ts
```

Expected: failure because file does not exist.

- [ ] **Step 11.3: Implement the extension factory**

Create `apps/backend/src/common/tenant/tenant-scoping.extension.ts`:

```ts
import { Prisma } from '@prisma/client';
import { TenantContextService } from './tenant-context.service';
import { TenantEnforcementMode } from './tenant.constants';

/**
 * Set of Prisma model names that carry `organizationId` and must be scoped.
 * Empty in Plan 01 — populated per-cluster in Plan 02 as each cluster's
 * schema gains the column. Until then the extension is a registered-but-no-op
 * hook: safe to mount, behavior-neutral.
 */
export type TenantScopedModelRegistry = Set<string>;

const SCOPED_OPERATIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
]);

/**
 * Build a Prisma Client extension that auto-injects `organizationId` into
 * every `where` clause for registered models. Dormant when mode === 'off'.
 */
export function buildTenantScopingExtension(
  ctx: TenantContextService,
  mode: TenantEnforcementMode,
  scopedModels: TenantScopedModelRegistry,
): Prisma.Extension {
  if (mode === 'off') {
    // Return an extension with no query hook — behavior-neutral.
    return { name: 'tenant-scoping:dormant' };
  }

  return {
    name: 'tenant-scoping:active',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !scopedModels.has(model)) return query(args);
          if (!SCOPED_OPERATIONS.has(operation)) return query(args);

          const current = ctx.get();
          // Super-admins see everything.
          if (current?.isSuperAdmin) return query(args);
          // No tenant context (e.g., system jobs pre-context) — skip scoping.
          // Plan 02 tightens this: cluster rollout enables strict-mode crash.
          if (!current?.organizationId) return query(args);

          const existing = (args as { where?: Record<string, unknown> }).where ?? {};
          const scoped = { ...existing, organizationId: current.organizationId };
          return query({ ...(args as object), where: scoped });
        },
      },
    },
  } as Prisma.Extension;
}
```

- [ ] **Step 11.4: Apply the extension in `PrismaService`**

**Prisma 7 note:** `PrismaClient.$extends(...)` returns a `new` client (the "extended client") — the original `this` is **not** mutated. The old `Object.assign(this, extended)` pattern (used in some Prisma 5 guides) is unreliable in Prisma 7 because the extended client uses different proxy internals. We use a Proxy-based delegation pattern instead: `PrismaService` still `extends PrismaClient` (so DI and types are unchanged for every existing caller), but the constructor stores the extended client in a private field and returns a Proxy that delegates reads to that extended client, while preserving the `PrismaClient` prototype.

When `TENANT_ENFORCEMENT=off` the extension is `{ name: 'tenant-scoping:dormant' }` (no query hook), so the extended client is behavior-identical to the base client. Performance impact with an empty `SCOPED_MODELS` set is negligible in permissive mode (one `Set.has()` lookup per query).

Open `apps/backend/src/infrastructure/database/prisma.service.ts`. Replace its contents with:

```ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  buildTenantScopingExtension,
  TenantScopedModelRegistry,
} from '../../common/tenant/tenant-scoping.extension';
import { TenantEnforcementMode } from '../../common/tenant/tenant.constants';

/**
 * Plan 02 populates this set cluster-by-cluster. Empty here is intentional —
 * every model is treated as un-scoped, matching current single-tenant behavior.
 */
const SCOPED_MODELS: TenantScopedModelRegistry = new Set<string>();

/**
 * PrismaService wraps the extended Prisma Client via a Proxy.
 *
 * Why a Proxy instead of `Object.assign(this, extended)`?
 * - In Prisma 7, `$extends` returns a different runtime client whose model
 *   accessors use internal proxy traps. Copying those traps onto `this` with
 *   Object.assign silently drops fields and produces subtle bugs at query time.
 * - A Proxy preserves the full extended client (including its traps) while
 *   keeping `PrismaService` a `PrismaClient` subclass for DI and types.
 * - Callers that read `prisma.user.findMany(...)` transparently hit the
 *   extended client's hooks, which is exactly what we want.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly extended: PrismaClient;

  constructor(
    private readonly config: ConfigService,
    private readonly tenantCtx: TenantContextService,
  ) {
    super({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    const mode = this.config.get<TenantEnforcementMode>('TENANT_ENFORCEMENT', 'off');
    // `$extends` returns an opaque extended-client type. Cast to PrismaClient
    // for storage; at runtime it exposes the same surface plus our hooks.
    this.extended = this.$extends(
      buildTenantScopingExtension(tenantCtx, mode, SCOPED_MODELS),
    ) as unknown as PrismaClient;

    // Proxy: reads go to the extended client for model accessors ($user, etc)
    // and $ methods ($queryRaw, $transaction); connection lifecycle stays on
    // the base class (we don't want $connect/$disconnect to hit the extended
    // client's internal instance).
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (prop === 'onModuleInit' || prop === 'onModuleDestroy' ||
            prop === 'logger' || prop === 'config' || prop === 'tenantCtx' ||
            prop === 'extended' || prop === '$connect' || prop === '$disconnect') {
          return Reflect.get(target, prop, receiver);
        }
        const fromExtended = Reflect.get(target.extended as object, prop);
        return typeof fromExtended === 'function'
          ? (fromExtended as Function).bind(target.extended)
          : fromExtended ?? Reflect.get(target, prop, receiver);
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log(
      `Prisma connected (tenant mode = ${this.config.get('TENANT_ENFORCEMENT', 'off')})`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }
}
```

- [ ] **Step 11.5: Verify `DatabaseModule` still wires correctly**

`PrismaService` now takes `ConfigService` and `TenantContextService` as constructor dependencies. `ConfigService` is provided globally by `ConfigModule.forRoot({ isGlobal: true })` (already set in `AppModule`), and `TenantContextService` is provided globally by `TenantModule` (registered in Task 7). So no changes to `DatabaseModule` are needed.

Open `apps/backend/src/infrastructure/database/database.module.ts` just to confirm it still reads:

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
```

No edits required. If the existing file does not match, reconcile and commit the reconciliation separately before this task.

- [ ] **Step 11.6: Smoke test — `prisma.organization.findUnique` still works**

Proxy bugs tend to surface on the first real query. Run the existing `PrismaService` spec plus a targeted query:

```bash
cd apps/backend && npx jest src/infrastructure/database/prisma.service.spec.ts
```

Then boot the dev server once and hit `GET /api/v1/health`:

```bash
cd apps/backend && npm run dev
# in another shell:
curl -sS http://localhost:5100/api/v1/health
```

Expected: `{ status: "ok", ... }`. Kill the server with Ctrl+C.

If the Proxy pattern misbehaves (e.g. `TypeError: ... is not a function`), fall back to the alternative: keep `PrismaService` un-extended and introduce a separate `@Injectable() TenantScopedPrisma` service that owns the extended client and is injected only where scoping is needed. Record that decision in `apps/backend/docs/saas-tenancy.md` (Task 14) and update Plan 02 accordingly.

- [ ] **Step 11.7: Run extension tests + full suite**

```bash
cd apps/backend && npx jest tenant-scoping.extension.spec.ts && npm run test
```

Expected: extension tests all pass; full suite still passes (nothing regresses because `SCOPED_MODELS` is empty → no scoping applied to any real query).

- [ ] **Step 11.8: Commit**

```bash
git add apps/backend/src/common/tenant/tenant-scoping.extension.ts apps/backend/src/common/tenant/tenant-scoping.extension.spec.ts apps/backend/src/infrastructure/database/prisma.service.ts
git commit -m "feat(saas-01): dormant Prisma tenant-scoping extension + Proxy-wrapped PrismaService"
```

---

## Task 12 — RLS scaffolding migration + helper

**Files:**
- Create: `apps/backend/prisma/migrations/<TIMESTAMP>_saas01_rls_scaffolding/migration.sql`
- Create: `apps/backend/src/common/tenant/rls.helper.ts`
- Create: `apps/backend/src/common/tenant/rls.helper.spec.ts`

- [ ] **Step 12.1: Create the migration folder**

```bash
cd apps/backend && TS=$(date -u +%Y%m%d%H%M%S) && mkdir -p prisma/migrations/${TS}_saas01_rls_scaffolding
```

- [ ] **Step 12.2: Write RLS scaffolding SQL**

Create `apps/backend/prisma/migrations/<TS>_saas01_rls_scaffolding/migration.sql`:

```sql
-- SaaS-01: RLS scaffolding.
-- We register a session-scoped custom parameter (`app.current_org_id`) that
-- the application will set via `SET LOCAL app.current_org_id = '...'` per
-- transaction once Plan 02 activates enforcement.
--
-- No policies are applied to real tables here — Plan 02 enables them as each
-- cluster gains its `organization_id` column. This migration is a placeholder
-- so the GUC exists on every environment from day one.

DO $$
BEGIN
  -- Ensure gen_random_uuid() is available (used by backfill migrations).
  CREATE EXTENSION IF NOT EXISTS pgcrypto;

  -- Custom parameter: empty default. Set per-transaction by the app.
  -- Prefixed parameters are the supported way to define app-level GUCs in
  -- PostgreSQL (core parameters reject unknown names).
  PERFORM set_config('app.current_org_id', '', false);
END $$;

-- Helper function: returns the current tenant id or NULL if unset.
-- Plan 02 policies reference this to decide row visibility.
CREATE OR REPLACE FUNCTION app_current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_org_id', true), '')::uuid;
$$;

COMMENT ON FUNCTION app_current_org_id() IS
  'Reads app.current_org_id GUC set by TenantRlsInterceptor. Returns NULL when unset (used by Plan 02 policies as a bypass for system jobs).';
```

- [ ] **Step 12.3: Apply the migration**

```bash
cd apps/backend && npx prisma migrate dev
```

Expected: "Database is now in sync with your schema."

- [ ] **Step 12.4: Implement the RLS helper**

Create `apps/backend/src/common/tenant/rls.helper.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TenantContextService } from './tenant-context.service';

/**
 * Sets `app.current_org_id` on the current transaction so RLS policies see
 * the right tenant. Call this at the start of any transaction that touches
 * tenant-scoped tables once Plan 02 enables policies.
 *
 * Usage:
 *   await prisma.$transaction(async (tx) => {
 *     await rls.applyInTransaction(tx);
 *     // ... tenant-scoped queries
 *   });
 */
@Injectable()
export class RlsHelper {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContextService,
  ) {}

  async applyInTransaction(tx: { $executeRawUnsafe: (sql: string) => Promise<unknown> }): Promise<void> {
    const orgId = this.ctx.getOrganizationId();
    if (!orgId) return; // no tenant set — leave GUC empty; Plan 02 policies allow this for system jobs.
    // SET LOCAL applies only to the current transaction. Quote the literal
    // to prevent injection — orgId is trusted (from JWT) but we defend anyway.
    const safe = orgId.replace(/'/g, "''");
    await tx.$executeRawUnsafe(`SET LOCAL app.current_org_id = '${safe}'`);
  }
}
```

- [ ] **Step 12.5: Write a basic spec**

Create `apps/backend/src/common/tenant/rls.helper.spec.ts`:

```ts
import { RlsHelper } from './rls.helper';
import { TenantContextService } from './tenant-context.service';

describe('RlsHelper', () => {
  it('no-ops when tenant context is unset', async () => {
    const ctx = { getOrganizationId: () => undefined } as unknown as TenantContextService;
    const helper = new RlsHelper({} as any, ctx);
    const tx = { $executeRawUnsafe: jest.fn() };
    await helper.applyInTransaction(tx as any);
    expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('emits SET LOCAL when org is set', async () => {
    const ctx = { getOrganizationId: () => 'org-abc' } as unknown as TenantContextService;
    const helper = new RlsHelper({} as any, ctx);
    const tx = { $executeRawUnsafe: jest.fn().mockResolvedValue(undefined) };
    await helper.applyInTransaction(tx as any);
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith("SET LOCAL app.current_org_id = 'org-abc'");
  });

  it('escapes single quotes in the id', async () => {
    const ctx = { getOrganizationId: () => "o'rg" } as unknown as TenantContextService;
    const helper = new RlsHelper({} as any, ctx);
    const tx = { $executeRawUnsafe: jest.fn().mockResolvedValue(undefined) };
    await helper.applyInTransaction(tx as any);
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith("SET LOCAL app.current_org_id = 'o''rg'");
  });
});
```

- [ ] **Step 12.6: Register helper in `TenantModule`**

Edit `apps/backend/src/common/tenant/tenant.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';
import { RlsHelper } from './rls.helper';

@Global()
@Module({
  providers: [TenantContextService, RlsHelper],
  exports: [TenantContextService, RlsHelper],
})
export class TenantModule {}
```

And add `RlsHelper` to `apps/backend/src/common/tenant/index.ts`:

```ts
export * from './rls.helper';
```

- [ ] **Step 12.7: Run tests**

```bash
cd apps/backend && npx jest rls.helper.spec.ts
```

Expected: all 3 specs pass.

- [ ] **Step 12.8: Commit**

```bash
git add apps/backend/prisma/migrations/*_saas01_rls_scaffolding apps/backend/src/common/tenant/rls.helper.ts apps/backend/src/common/tenant/rls.helper.spec.ts apps/backend/src/common/tenant/tenant.module.ts apps/backend/src/common/tenant/index.ts
git commit -m "feat(saas-01): RLS GUC + app_current_org_id() helper function + RlsHelper service"
```

---

## Task 13 — Isolation test harness + foundation e2e

**Files:**
- Create: `apps/backend/test/tenant-isolation/isolation-harness.ts`
- Create: `apps/backend/test/tenant-isolation/foundation.e2e-spec.ts`

- [ ] **Step 13.1: Create the harness**

Create `apps/backend/test/tenant-isolation/isolation-harness.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { TenantContextService, TenantContext } from '../../src/common/tenant';

export interface IsolationHarness {
  app: INestApplication;
  prisma: PrismaService;
  cls: ClsService;
  ctx: TenantContextService;
  createOrg: (slug: string, nameAr: string) => Promise<{ id: string }>;
  runAs: <T>(context: Partial<TenantContext>, fn: () => Promise<T>) => Promise<T>;
  close: () => Promise<void>;
}

/**
 * Boots a real AppModule against the dev/test database. Intended for
 * cross-tenant isolation proofs — NOT for fast unit tests.
 */
export async function bootHarness(): Promise<IsolationHarness> {
  const mod: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = mod.createNestApplication();
  await app.init();

  const prisma = app.get(PrismaService);
  const cls = app.get(ClsService);
  const ctx = app.get(TenantContextService);

  const createOrg = async (slug: string, nameAr: string) => {
    const row = await prisma.organization.upsert({
      where: { slug },
      update: {},
      create: { slug, nameAr, status: 'ACTIVE' as any },
      select: { id: true },
    });
    return row;
  };

  const runAs = <T>(partial: Partial<TenantContext>, fn: () => Promise<T>): Promise<T> =>
    cls.run(() => {
      ctx.set({
        organizationId: partial.organizationId ?? '',
        membershipId: partial.membershipId ?? '',
        id: partial.id ?? '',
        role: partial.role ?? 'ADMIN',
        isSuperAdmin: partial.isSuperAdmin === true,
      });
      return fn();
    });

  return {
    app,
    prisma,
    cls,
    ctx,
    createOrg,
    runAs,
    close: async () => {
      await app.close();
    },
  };
}
```

- [ ] **Step 13.2: Create the foundation e2e spec**

Create `apps/backend/test/tenant-isolation/foundation.e2e-spec.ts`:

```ts
import { bootHarness, IsolationHarness } from './isolation-harness';
import { DEFAULT_ORGANIZATION_ID } from '../../src/common/tenant';

describe('SaaS-01 — foundation isolation', () => {
  let h: IsolationHarness;

  beforeAll(async () => {
    h = await bootHarness();
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  it('default organization row exists with well-known UUID', async () => {
    const row = await h.prisma.organization.findUnique({
      where: { id: DEFAULT_ORGANIZATION_ID },
    });
    expect(row).not.toBeNull();
    expect(row?.slug).toBe('default');
  });

  it('every existing user has at least one active membership', async () => {
    const users = await h.prisma.user.findMany({ select: { id: true } });
    if (users.length === 0) return; // nothing to assert on an empty db
    const memberships = await h.prisma.membership.findMany({
      where: { userId: { in: users.map((u) => u.id) }, isActive: true },
      select: { userId: true },
    });
    const withMembership = new Set(memberships.map((m) => m.userId));
    const missing = users.filter((u) => !withMembership.has(u.id));
    expect(missing).toEqual([]);
  });

  it('tenant context propagates through a CLS run', async () => {
    const a = await h.createOrg('iso-a', 'منظمة أ');
    await h.runAs({ organizationId: a.id }, async () => {
      expect(h.ctx.getOrganizationId()).toBe(a.id);
    });
    expect(h.ctx.getOrganizationId()).toBeUndefined();
  });

  it('parallel CLS runs do not leak context between tenants', async () => {
    const a = await h.createOrg('iso-par-a', 'منظمة متوازية أ');
    const b = await h.createOrg('iso-par-b', 'منظمة متوازية ب');

    const results = await Promise.all([
      h.runAs({ organizationId: a.id }, async () => {
        await new Promise((r) => setTimeout(r, 20));
        return h.ctx.getOrganizationId();
      }),
      h.runAs({ organizationId: b.id }, async () => {
        await new Promise((r) => setTimeout(r, 20));
        return h.ctx.getOrganizationId();
      }),
    ]);

    expect(results).toEqual([a.id, b.id]);
  });

  it('app_current_org_id() SQL helper returns NULL when GUC is empty', async () => {
    const [row] = await h.prisma.$queryRaw<Array<{ id: string | null }>>`
      SELECT app_current_org_id()::text AS id
    `;
    expect(row.id).toBeNull();
  });

  it('app_current_org_id() returns the set value when GUC is populated', async () => {
    const a = await h.createOrg('iso-rls', 'منظمة RLS');
    await h.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_org_id = '${a.id}'`);
      const [row] = await tx.$queryRaw<Array<{ id: string | null }>>`
        SELECT app_current_org_id()::text AS id
      `;
      expect(row.id).toBe(a.id);
    });
  });
});
```

- [ ] **Step 13.3: Register the e2e config path**

Check that `apps/backend/test/jest-e2e.json` (or equivalent) has a `testRegex` or `rootDir` that includes `test/tenant-isolation/*.e2e-spec.ts`. If the existing regex is `.e2e-spec.ts$` the new file is picked up automatically — nothing to do. Otherwise, extend the `testRegex` array.

```bash
cd apps/backend && cat test/jest-e2e.json
```

If needed, edit to ensure `tenant-isolation/*.e2e-spec.ts` is matched.

- [ ] **Step 13.4: Ensure the database is seeded + migrated**

```bash
cd apps/backend && npx prisma migrate deploy
```

- [ ] **Step 13.5: Run the e2e**

```bash
cd apps/backend && npm run test:e2e -- --testPathPattern='tenant-isolation'
```

Expected: all 6 specs pass.

- [ ] **Step 13.6: Commit**

```bash
git add apps/backend/test/tenant-isolation
git commit -m "test(saas-01): tenant isolation harness + foundation e2e"
```

---

## Task 14 — Engineer-facing documentation

**Files:**
- Create: `apps/backend/docs/saas-tenancy.md`
- Modify: `apps/backend/CLAUDE.md`

- [ ] **Step 14.1: Write the tenancy guide**

Create `apps/backend/docs/saas-tenancy.md`:

````markdown
# CareKit Multi-Tenancy — Engineering Guide

This backend is transitioning from single-tenant to multi-tenant SaaS. The transition is **in progress** — not every cluster is scoped yet. Use this document to understand what's enforced today, what isn't, and how to contribute new tenant-aware code correctly.

## Model at a glance

```
Organization (tenant)
  ↑
  └─ Membership (userId, organizationId, role, isActive)
       ↑
       └─ User
```

A `User` may belong to multiple `Organization`s via `Membership`. The JWT carries `organizationId` + `membershipId` for the membership active in that session.

## The `TENANT_ENFORCEMENT` flag

Three modes:

| Mode | Meaning |
|---|---|
| `off` (default) | No tenant resolution. The Prisma scoping extension is a no-op. RLS policies are installed but unused. System behaves as single-tenant. |
| `permissive` | Middleware resolves an org from JWT → X-Org-Id (super-admin only) → `DEFAULT_ORGANIZATION_ID`. Handlers can assume a tenant is always set. |
| `strict` | As permissive, but missing resolution throws `TenantResolutionError`. |

Production target after Plan 10 is `strict`. Every phase after Plan 01 runs in `permissive` until the last cluster is migrated.

## Writing a tenant-scoped query (once Plan 02 enables your cluster)

```ts
import { TenantContextService } from 'src/common/tenant';

@Injectable()
export class MyHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: MyCommand) {
    const orgId = this.tenant.requireOrganizationId();
    return this.prisma.booking.findMany({
      where: { organizationId: orgId, status: 'CONFIRMED' },
    });
  }
}
```

Notes:
- Always pass `organizationId` explicitly in `where`. The Prisma extension injects it as a safety net, but relying on the extension alone hides the intent.
- The extension skips `$queryRaw` — for raw SQL, you must either join on `organization_id` yourself or use `RlsHelper.applyInTransaction` and rely on Plan 02 policies.

## Writing raw SQL (`$queryRaw`, `$executeRawUnsafe`)

Two options, both safe:

### Option A — explicit predicate
```ts
await this.prisma.$queryRaw`
  SELECT * FROM "Booking" WHERE "organizationId" = ${orgId}
`;
```

### Option B — RLS
```ts
await this.prisma.$transaction(async (tx) => {
  await this.rls.applyInTransaction(tx);
  return tx.$queryRaw`SELECT * FROM "Booking"`; // policy filters automatically
});
```

## Adding a new cluster to the scoping registry (Plan 02 only)

1. Add `organizationId String` column to every tenant-scoped model in that cluster's `.prisma` file.
2. Generate + apply migration + backfill.
3. Add each model name to the `SCOPED_MODELS` set in `infrastructure/database/prisma.service.ts`.
4. Enable RLS policy for each table in a new migration.
5. Add cross-tenant tests under `test/tenant-isolation/<cluster>.e2e-spec.ts`.

## Isolation test pattern

Every new cluster must have isolation tests following this shape:

```ts
it('reading org A booking from org B context is forbidden', async () => {
  const a = await h.createOrg('a', 'أ');
  const b = await h.createOrg('b', 'ب');
  const bookingA = await h.runAs({ organizationId: a.id }, () =>
    h.prisma.booking.create({ data: { /* ... */ } }),
  );
  const foundFromB = await h.runAs({ organizationId: b.id }, () =>
    h.prisma.booking.findUnique({ where: { id: bookingA.id } }),
  );
  expect(foundFromB).toBeNull(); // scoped out
});
```

## Red flags during code review

- `prisma.X.findMany({ where: { /* no organizationId */ } })` in a tenant-scoped cluster — the extension saves you, but write it explicitly.
- `$queryRaw` without an `organizationId` predicate and without an RLS transaction wrapper.
- Cross-cluster event payloads missing `organizationId`.
- Super-admin-only endpoints that forget to set `isSuperAdmin: true` in JWT claims.
- Background jobs that don't bootstrap the tenant context before running handlers.
````

- [ ] **Step 14.2: Update backend CLAUDE.md**

In `apps/backend/CLAUDE.md`, find the line `Single-organization mode. The backend serves one clinic per deployment — there is no tenantId. Queries are global; do not reintroduce multi-tenant scoping.` (under "Conventions that catch new contributors") and replace it with:

```markdown
- **Multi-tenancy (transitional).** The backend is migrating to multi-tenant SaaS. As of Plan 01, `Organization` + `Membership` exist and the `TenantContextService` carries tenant identity through CLS. The `TENANT_ENFORCEMENT` env flag defaults to `off` — single-tenant behavior is unchanged at runtime. Cluster-by-cluster rollout begins in Plan 02. See [docs/saas-tenancy.md](./docs/saas-tenancy.md) before adding new queries.
```

- [ ] **Step 14.3: Commit**

```bash
git add apps/backend/docs/saas-tenancy.md apps/backend/CLAUDE.md
git commit -m "docs(saas-01): engineer-facing tenancy guide + update backend CLAUDE.md"
```

---

## Task 15 — Final verification

**Files:**
- None (verification only)

- [ ] **Step 15.1: Full typecheck**

```bash
cd apps/backend && npm run typecheck
```

Expected: no errors.

- [ ] **Step 15.2: Full unit test suite**

```bash
cd apps/backend && npm run test
```

Expected: all existing tests pass (no regressions) + 14+ new tests pass.

- [ ] **Step 15.3: E2E suite**

```bash
cd apps/backend && npm run test:e2e
```

Expected: all e2e pass including `tenant-isolation/foundation.e2e-spec.ts`.

- [ ] **Step 15.4: Boot the server locally with flag off**

```bash
cd apps/backend && npm run dev
```

Expected: "Prisma connected (tenant mode = off)" in log. Hit `GET http://localhost:5100/api/v1/health` — 200 OK. Kill with Ctrl+C.

- [ ] **Step 15.5: Boot the server with flag permissive**

```bash
cd apps/backend && TENANT_ENFORCEMENT=permissive npm run dev
```

Expected: "Prisma connected (tenant mode = permissive)". Hit a protected endpoint with a valid token — the token issued by `login` should contain `organizationId`. Kill with Ctrl+C.

- [ ] **Step 15.6: Git log review**

```bash
git log --oneline origin/main..HEAD
```

Expected: ~14 commits, each prefixed `feat(saas-01):` / `test(saas-01):` / `chore(saas-01):` / `docs(saas-01):`.

- [ ] **Step 15.7: Open PR**

```bash
git push -u origin feat/saas-01-multi-tenancy-foundation
gh pr create --title "feat(saas-01): multi-tenancy foundation — Organization + Membership + tenant context" --body "$(cat <<'EOF'
## Summary
First plan of the SaaS transformation. Introduces tenant primitives without changing single-tenant runtime behavior.

- `Organization` + `Membership` Prisma models + migrations
- Default organization seed (`00000000-0000-0000-0000-000000000001`)
- Backfill: one membership per existing user
- `TenantContextService` (nestjs-cls wrapper)
- `TenantResolverMiddleware` (JWT → X-Org-Id → default, flag-gated)
- Dormant Prisma scoping extension (no-op while `TENANT_ENFORCEMENT=off`)
- RLS scaffolding (GUC + `app_current_org_id()` helper)
- JWT claims extended with optional `organizationId` + `membershipId`
- Isolation test harness + foundation e2e

## Test plan
- [x] Unit tests (14 new, 0 regressions)
- [x] E2E tenant-isolation/foundation.e2e-spec.ts (6 cases)
- [x] Boot server with flag off → behavior unchanged
- [x] Boot server with flag permissive → login issues JWT with orgId

## Safety
- `TENANT_ENFORCEMENT=off` is the default — production deploys unchanged.
- No existing query is modified. No schema field is renamed or removed.
- All migrations are append-only (CLAUDE.md rule).

## Next
Plan 02 — cluster-by-cluster rollout: adds `organizationId` to each tenant-scoped table and registers each model in the scoping extension.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 15.8: Done**

Plan 01 complete. All invariants hold: `TENANT_ENFORCEMENT=off` leaves runtime unchanged; new primitives exist and tested; isolation harness ready for Plan 02.

---

## Amendments (applied 2026-04-21 before execution)

Verified the plan against the live codebase before running Task 1 and amended it in place to match reality:

1. **JwtPayload location** — Plan originally pointed at `src/common/auth/jwt-payload.interface.ts`. That file doesn't exist. The interface is inline in `src/modules/identity/shared/token.service.ts`. Task 8 now edits it there.
2. **`req.user` field name** — Plan originally assumed `userId`. `JwtStrategy.validate()` already returns `{ id, email, role, ... }` and every guard in the codebase reads `req.user.id`. Renaming would force a cascade rewrite. The `TenantContext`, middleware, and harness now use `id`.
3. **Token signing site** — Plan originally had `LoginHandler` call `jwtService.signAsync(...)` directly. In reality `LoginHandler` delegates to `TokenService.issueTokenPair(user)`, which owns signing and refresh-token rotation. Task 9 now extends `TokenService` with an optional `tenantClaims` param and has `LoginHandler` resolve membership + pass it through.
4. **Prisma 7 `$extends` wiring** — Plan originally used `Object.assign(this, extended)` after `$extends`. That pattern is unreliable in Prisma 7 (model accessors use internal proxy traps). Task 11 now uses a `Proxy` that delegates reads to the extended client while keeping `PrismaService extends PrismaClient` for DI. A fallback path (separate `TenantScopedPrisma` service) is documented if the Proxy misbehaves.

All 4 amendments are additive to the codebase — no existing guard, handler, or query shape changes. `TENANT_ENFORCEMENT=off` still leaves runtime behavior identical to main.

---

## Self-review checklist (completed before commit of this plan)

- [x] **Spec coverage:** every primitive in the SaaS-01 scope (Organization, Membership, TenantContext, middleware, Prisma extension, RLS, harness, docs) has a task. Nothing deferred that belongs in Plan 01.
- [x] **No placeholders:** every step shows exact paths, exact commands, exact code. No "TBD" or "implement similarly".
- [x] **Type consistency:** `TenantContext` shape (organizationId / membershipId / id / role / isSuperAdmin) is identical in service, middleware test, harness, and e2e. `MembershipRole` enum matches Prisma model matches backfill SQL mapping. `DEFAULT_ORGANIZATION_ID` UUID is the same in constants, seed SQL, env default, and e2e assertion.
- [x] **Commit cadence:** each task ends with a commit. 14 commits total before the PR.
- [x] **Reversible:** every task is independently revertable. Schema changes are additive only.
