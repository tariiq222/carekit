# SaaS-05b — Super-admin App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a brand-new Next.js 15 app at `apps/admin/` (served on `admin.carekit.app`) used by CareKit super-admin employees to manage all tenant organizations, impersonate users for support, suspend accounts, view platform-wide metrics, manage Plans + Verticals, and inspect cross-tenant billing. Adds a new backend audience `src/api/admin/`, a `SuperAdminGuard`, an impersonation flow with full audit trail, and an activity-log view for every destructive super-admin action.

**Architecture:** Separate app — NOT a sub-route of `apps/dashboard/`. Tenants never download super-admin JS. Auth is SHARED with the dashboard (`POST /api/v1/auth/login`), but the admin UI only accepts JWTs whose claim `isSuperAdmin=true`. Impersonation issues a short-lived "shadow" JWT bearing the target `organizationId` + `targetUserId` + the originating super-admin's id; every request carried out under an impersonation session is tagged with `impersonationSessionId` and written to the audit log. Admin app depends on `@carekit/ui` (Plan 05a), `@carekit/api-client`, and `@carekit/shared`.

**Tech Stack:** Next.js 15 App Router, React 19, TanStack Query v5, shadcn primitives from `@carekit/ui`, Tailwind 4, next-intl, Zod + React Hook Form. Backend additions: NestJS 11, Prisma 7, nestjs-cls, Jest + Supertest (e2e).

---

## Critical lessons from prior plans — READ BEFORE STARTING

Lessons inherited from the SaaS-0x series (from `docs/superpowers/plans/2026-04-21-saas-transformation-index.md`):

1. **Grep ALL callsites** before modifying any service/guard/handler. `AuthService.login` in particular is called from `auth.controller.ts` AND from CLI seeders. Plans miss callsites.
2. **`$transaction` callback form bypasses the Proxy** — `tx` inside `async (tx) => {}` is raw. Any impersonation audit write inside a transaction must set `organizationId` explicitly.
3. **Extension covers `where` not `data`** — impersonation table creates must spell out every scoping field explicitly.
4. **Prisma extension + new models** — after adding `ImpersonationSession` and `SuperAdminActionLog`, register them in `SCOPED_MODELS` only if they carry an `organizationId` (they do). Otherwise leave them platform-global.
5. **`TENANT_ENFORCEMENT=off` must keep working during rollout.** The new admin controllers are organization-agnostic (they read across all orgs); they must use the un-scoped `BasePrismaService` access path, not the Proxy-scoped one.
6. **Divergence-before-commit** — if any task finds reality doesn't match the plan, STOP, document, propose amendment, resume only after confirmation.
7. **Prisma extension Proxy** — admin endpoints that read across tenants must use `prisma.$allTenants()` escape hatch (added in Task 4) rather than bypassing the Proxy ad-hoc.

---

## Scope

### In-scope

1. Schema additions: `User.isSuperAdmin` Boolean, `ImpersonationSession`, `SuperAdminActionLog`.
2. Backend audience: `src/api/admin/` with 6 controllers (organizations, users, plans, verticals, impersonation, metrics).
3. Handler cluster: `src/modules/platform/admin/` with vertical-slice handlers.
4. `SuperAdminGuard` replacing `CaslGuard` on admin routes.
5. Impersonation issuance + audit-log middleware.
6. New Next.js app `apps/admin/` on port 5104 with App Router, RTL-first, consuming `@carekit/ui`.
7. Docker Compose entry + Nginx route for `admin.carekit.app`.
8. Root `CLAUDE.md` Structure tree updated; new `apps/admin/CLAUDE.md`.
9. E2E isolation: a regular tenant user cannot hit ANY admin endpoint (403 on every route).

### Explicitly deferred

- Advanced analytics dashboards (churn cohorts, retention curves) — MVP just shows totals.
- Super-admin SSO (Google Workspace) — MVP uses standard email/password against same `POST /api/v1/auth/login` with `isSuperAdmin=true` claim returned in JWT.
- Per-tenant database statistics / per-org storage costs — later plan.
- Multi-region admin-site — single region only.

### Owner-approval gate (MUST obtain before executing Task 7)

The impersonation flow is security-sensitive. Before coding:
1. Post the impersonation design (Task 7.0) to the owner for approval.
2. Obtain written acknowledgment that the short-lived JWT scheme, audit-log schema, and UI "Impersonating as … (end session)" banner meet the owner's expectations.
3. Only then proceed to Task 7.1. If the owner requests changes, update this plan with an Amendments section before continuing.

---

## File Structure

### New files (backend)

| File | Responsibility |
|---|---|
| `apps/backend/prisma/schema/identity.prisma` (modify) | Add `User.isSuperAdmin Boolean @default(false)` |
| `apps/backend/prisma/schema/platform.prisma` (modify or create) | Add `ImpersonationSession` + `SuperAdminActionLog` models |
| `apps/backend/prisma/migrations/<ts>_saas_05b_super_admin/migration.sql` | Migration for the three schema changes |
| `apps/backend/src/common/guards/super-admin.guard.ts` | Guard checking `isSuperAdmin=true` claim |
| `apps/backend/src/common/guards/super-admin.guard.spec.ts` | Unit tests for the guard |
| `apps/backend/src/api/admin/admin.module.ts` | NestJS module tying together controllers + handlers |
| `apps/backend/src/api/admin/organizations.controller.ts` | List / suspend / reinstate / detail orgs |
| `apps/backend/src/api/admin/users.controller.ts` | Cross-tenant user search, password reset |
| `apps/backend/src/api/admin/plans.controller.ts` | CRUD on Plan (from plan 04) |
| `apps/backend/src/api/admin/verticals.controller.ts` | CRUD on Vertical (from plan 03) |
| `apps/backend/src/api/admin/impersonation.controller.ts` | Start / stop impersonation, list active sessions |
| `apps/backend/src/api/admin/metrics.controller.ts` | Platform-wide counts, revenue, churn |
| `apps/backend/src/modules/platform/admin/` | Vertical-slice handlers (see Handler list below) |
| `apps/backend/src/infrastructure/database/prisma.service.ts` (modify) | Add `$allTenants()` escape hatch + register new models in `SCOPED_MODELS` |
| `apps/backend/test/e2e/admin/super-admin.e2e-spec.ts` | Full super-admin happy-path + 403-for-non-admin suite |

### New files (frontend — `apps/admin/`)

| File | Responsibility |
|---|---|
| `apps/admin/package.json` | Workspace manifest, port 5104 |
| `apps/admin/next.config.mjs` | Next config; transpilePackages for `@carekit/ui` |
| `apps/admin/tsconfig.json` | TS config with `@carekit/ui` alias |
| `apps/admin/middleware.ts` | Session validation: redirect non-super-admin to `dashboard.carekit.app` |
| `apps/admin/app/layout.tsx` | Root layout; RTL-first; brand bar + user menu |
| `apps/admin/app/(admin)/layout.tsx` | Admin shell: sidebar + impersonation banner slot |
| `apps/admin/app/(admin)/page.tsx` | Home dashboard (metrics cards) |
| `apps/admin/app/(admin)/organizations/page.tsx` | Orgs list + filters (skeleton below) |
| `apps/admin/app/(admin)/organizations/[id]/page.tsx` | Org detail + impersonate + suspend |
| `apps/admin/app/(admin)/users/page.tsx` | User search across orgs |
| `apps/admin/app/(admin)/plans/page.tsx` | Plans CRUD |
| `apps/admin/app/(admin)/verticals/page.tsx` | Verticals CRUD |
| `apps/admin/app/(admin)/metrics/page.tsx` | Platform metrics |
| `apps/admin/app/(admin)/audit-log/page.tsx` | Full super-admin activity log |
| `apps/admin/app/(admin)/impersonation-sessions/page.tsx` | Active + historical impersonation sessions |
| `apps/admin/app/login/page.tsx` | Shared login; rejects non-super-admins |
| `apps/admin/components/impersonation-banner.tsx` | Red banner: "Impersonating {user}@{org} — End session" |
| `apps/admin/components/sidebar-config.ts` | Admin sidebar items |
| `apps/admin/hooks/use-organizations.ts`, `use-users.ts`, `use-plans.ts`, `use-verticals.ts`, `use-impersonation.ts`, `use-metrics.ts` | TanStack Query hooks |
| `apps/admin/lib/api/*.ts` | Typed fetch wrappers via `@carekit/api-client` |
| `apps/admin/lib/schemas/*.ts` | Zod schemas |
| `apps/admin/CLAUDE.md` | Super-admin conventions |

### Modified files

| File | Change |
|---|---|
| `package.json` (root) | Add `apps/admin` to `workspaces` |
| `turbo.json` | Add `apps/admin` to pipeline |
| `CLAUDE.md` (root) | Structure tree: add `apps/admin/`; Commands section: add `npm run dev:admin` |
| `docker/docker-compose.yml` | Add `admin` service on port 5104 |
| `docker/nginx/*.conf` | Route `admin.carekit.app` → `:5104` |
| `apps/backend/src/app.module.ts` | Import `AdminModule` |
| `apps/backend/src/api/dashboard/auth/auth.controller.ts` | `/login` response must include `isSuperAdmin` claim in the token |

### Handler list (`src/modules/platform/admin/`)

```
list-organizations/          list-organizations.handler.ts + .spec.ts
get-organization/            get-organization.handler.ts + .spec.ts
suspend-organization/        suspend-organization.handler.ts + .spec.ts
reinstate-organization/      reinstate-organization.handler.ts + .spec.ts
search-users/                search-users.handler.ts + .spec.ts
reset-user-password/         reset-user-password.handler.ts + .spec.ts
start-impersonation/         start-impersonation.handler.ts + .spec.ts
end-impersonation/           end-impersonation.handler.ts + .spec.ts
list-impersonation-sessions/ list-impersonation-sessions.handler.ts + .spec.ts
get-platform-metrics/        get-platform-metrics.handler.ts + .spec.ts
list-audit-log/              list-audit-log.handler.ts + .spec.ts
```

(Plans and Verticals CRUD handlers already exist from plans 03/04. 05b only adds admin-audience controllers that delegate to those handlers under `SuperAdminGuard`.)

---

## Task 0 — Owner approval gate

- [ ] **Step 0.1: Read Plan 04 (Billing) and Plan 03 (Verticals) outputs**

Confirm `Plan` and `Vertical` models exist. If not, this plan cannot complete tasks touching their CRUD endpoints — flag and await the plans that add them.

- [ ] **Step 0.2: Post impersonation design summary to owner**

Paste the following to the owner chat and wait for explicit written approval:

```
## Impersonation flow (requires approval — Plan 05b)

1. Super-admin clicks "Impersonate" on org detail page.
2. Required fields: reason (textarea, min 10 chars), target user (defaults to org owner).
3. Backend issues a short-lived JWT (15-min TTL) with claims:
   - sub: <target user id>
   - organizationId: <target org id>
   - impersonatedBy: <super-admin user id>
   - impersonationSessionId: <uuid>
   - isSuperAdmin: false   (explicit: impersonation drops super-admin power)
4. Super-admin is redirected to the tenant dashboard with that JWT.
5. The dashboard displays a persistent red banner: "Impersonating
   {user.name} @ {org.name} — End session".
6. Every API request made under this JWT is logged in SuperAdminActionLog
   with the impersonationSessionId.
7. "End session" calls POST /api/v1/admin/impersonation/:id/end,
   which (a) marks the session endedAt, (b) revokes the short-lived JWT,
   (c) redirects back to admin.
8. Session auto-ends after 15 min if not ended manually.

## SuperAdminActionLog schema
- id, superAdminUserId, actionType (SUSPEND_ORG / IMPERSONATE_START / IMPERSONATE_END / RESET_PASSWORD / PLAN_CREATE / PLAN_UPDATE / PLAN_DELETE / VERTICAL_CREATE / VERTICAL_UPDATE / VERTICAL_DELETE)
- organizationId (nullable — platform-scope actions have none)
- impersonationSessionId (nullable)
- reason (text)
- metadata (jsonb)
- ipAddress, userAgent
- createdAt
```

Do NOT proceed past Task 0 without a written "approved" from the owner. If the owner requests changes, append an `## Amendments applied during execution` section to this plan and incorporate them before Task 1.

---

## Task 1 — Schema additions

### 1A: Add `isSuperAdmin` to User

- [ ] **Step 1A.1: Check current identity.prisma**

```bash
grep -n "model User\|isSuperAdmin" apps/backend/prisma/schema/identity.prisma
```

If `isSuperAdmin` is already present, skip to 1B. Otherwise continue.

- [ ] **Step 1A.2: Add field**

Edit `apps/backend/prisma/schema/identity.prisma`. Inside `model User { ... }`, add after the `email` field:

```prisma
  isSuperAdmin Boolean @default(false) // SaaS-05b: CareKit employees only
```

Add an index:

```prisma
  @@index([isSuperAdmin])
```

### 1B: Add `ImpersonationSession` model

- [ ] **Step 1B.1: Locate schema file**

```bash
ls apps/backend/prisma/schema/
```

If `platform.prisma` exists, append. Otherwise create it.

- [ ] **Step 1B.2: Add model**

Append to `apps/backend/prisma/schema/platform.prisma`:

```prisma
model ImpersonationSession {
  id                  String    @id @default(uuid())
  superAdminUserId    String
  targetOrganizationId String
  targetUserId        String
  reason              String    @db.Text
  startedAt           DateTime  @default(now())
  endedAt             DateTime?
  ipAddress           String?
  userAgent           String?   @db.Text
  jwtJti              String    @unique   // for revocation
  autoExpiredAt       DateTime               // startedAt + 15 min

  createdAt DateTime @default(now())

  @@index([superAdminUserId])
  @@index([targetOrganizationId])
  @@index([endedAt]) // to list active sessions
}

model SuperAdminActionLog {
  id                      String    @id @default(uuid())
  superAdminUserId        String
  actionType              SuperAdminActionType
  organizationId          String?
  impersonationSessionId  String?
  reason                  String    @db.Text
  metadata                Json      @default("{}")
  ipAddress               String?
  userAgent               String?   @db.Text

  createdAt DateTime @default(now())

  @@index([superAdminUserId])
  @@index([actionType])
  @@index([organizationId])
  @@index([createdAt])
}

enum SuperAdminActionType {
  SUSPEND_ORG
  REINSTATE_ORG
  IMPERSONATE_START
  IMPERSONATE_END
  RESET_PASSWORD
  PLAN_CREATE
  PLAN_UPDATE
  PLAN_DELETE
  VERTICAL_CREATE
  VERTICAL_UPDATE
  VERTICAL_DELETE
}
```

- [ ] **Step 1B.3: Add `suspendedAt` + `suspendedReason` to Organization**

Edit the `Organization` model (likely in `apps/backend/prisma/schema/organizations.prisma`):

```prisma
  suspendedAt      DateTime?
  suspendedReason  String?   @db.Text
```

- [ ] **Step 1B.4: Validate schema**

```bash
cd apps/backend && npx prisma validate
```

Expected: no errors.

### 1C: Migration

- [ ] **Step 1C.1: Attempt auto-generate**

```bash
cd apps/backend && npx prisma migrate dev --name saas_05b_super_admin --create-only
```

If pgvector conflicts, write manually following the 02d lesson.

- [ ] **Step 1C.2: Inspect migration SQL; verify it:**
  - Adds `isSuperAdmin` with `DEFAULT false` (non-null)
  - Creates `ImpersonationSession` table + indexes
  - Creates `SuperAdminActionLog` table + enum type + indexes
  - Adds `suspendedAt` + `suspendedReason` nullable columns to `Organization`

- [ ] **Step 1C.3: Apply migration**

```bash
cd apps/backend && npx prisma migrate dev
```

- [ ] **Step 1C.4: Commit**

```bash
git add apps/backend/prisma/schema/ apps/backend/prisma/migrations/
git commit -m "feat(saas-05b): schema for super-admin, impersonation, audit log"
```

---

## Task 2 — Seed super-admin user

- [ ] **Step 2.1: Add seed entry**

Edit `apps/backend/prisma/seed.ts`. Add an environment-variable-driven super-admin user:

```ts
const SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@carekit.app';
const SUPER_ADMIN_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD;
if (!SUPER_ADMIN_PASSWORD) {
  throw new Error('SEED_SUPER_ADMIN_PASSWORD is required to seed super-admin user');
}

await prisma.user.upsert({
  where: { email: SUPER_ADMIN_EMAIL },
  update: { isSuperAdmin: true },
  create: {
    email: SUPER_ADMIN_EMAIL,
    password: await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12),
    firstName: 'Platform',
    lastName: 'Admin',
    isSuperAdmin: true,
    // Membership-less: super-admins don't belong to any org
  },
});
```

- [ ] **Step 2.2: Run seed**

```bash
cd apps/backend && SEED_SUPER_ADMIN_PASSWORD='<pick-strong-password>' npm run seed
```

- [ ] **Step 2.3: Commit**

```bash
git add apps/backend/prisma/seed.ts
git commit -m "feat(saas-05b): seed super-admin user via env vars"
```

---

## Task 3 — SuperAdminGuard

- [ ] **Step 3.1: Write failing test**

Create `apps/backend/src/common/guards/super-admin.guard.spec.ts`:

```ts
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SuperAdminGuard } from './super-admin.guard';

function ctx(user: any): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as any;
}

describe('SuperAdminGuard', () => {
  const guard = new SuperAdminGuard();

  it('allows when user.isSuperAdmin=true', () => {
    expect(guard.canActivate(ctx({ id: 'u1', isSuperAdmin: true }))).toBe(true);
  });

  it('rejects when user.isSuperAdmin=false', () => {
    expect(() => guard.canActivate(ctx({ id: 'u1', isSuperAdmin: false })))
      .toThrow(ForbiddenException);
  });

  it('rejects when user missing', () => {
    expect(() => guard.canActivate(ctx(undefined))).toThrow(ForbiddenException);
  });

  it('rejects during impersonation (isSuperAdmin is false in shadow JWT)', () => {
    expect(() => guard.canActivate(ctx({
      id: 'u-target', isSuperAdmin: false, impersonatedBy: 'u-admin',
    }))).toThrow(ForbiddenException);
  });
});
```

- [ ] **Step 3.2: Run the test — expect failure**

```bash
cd apps/backend && npx jest common/guards/super-admin.guard --no-coverage
```

Expected: fails (guard doesn't exist).

- [ ] **Step 3.3: Implement the guard**

Create `apps/backend/src/common/guards/super-admin.guard.ts`:

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user?.isSuperAdmin) {
      throw new ForbiddenException('super_admin_required');
    }
    return true;
  }
}
```

- [ ] **Step 3.4: Run test — expect pass**

```bash
cd apps/backend && npx jest common/guards/super-admin.guard --no-coverage
```

- [ ] **Step 3.5: Commit**

```bash
git add apps/backend/src/common/guards/super-admin.guard.ts apps/backend/src/common/guards/super-admin.guard.spec.ts
git commit -m "feat(saas-05b): SuperAdminGuard with unit tests"
```

---

## Task 4 — Cross-tenant Prisma escape hatch

Admin endpoints read across ALL orgs. The Proxy-based Prisma extension automatically injects `organizationId` from CLS — that's wrong for admin queries. Add an explicit escape hatch.

- [ ] **Step 4.1: Extend PrismaService**

Edit `apps/backend/src/infrastructure/database/prisma.service.ts`. Add:

```ts
/**
 * Escape hatch for super-admin endpoints that legitimately span tenants.
 * Returns the raw Prisma client (no tenant scoping). Callers MUST be guarded
 * by SuperAdminGuard and MUST log the access via SuperAdminActionLog.
 */
public get $allTenants(): PrismaClient {
  return this.rawClient;
}
```

(`rawClient` is the un-proxied client kept internally. If the current code doesn't expose it, refactor to hold both `this.rawClient` and `this.scopedClient` internally, with the default Nest DI injecting `scopedClient` via its existing `get client()` accessor.)

- [ ] **Step 4.2: Test it**

Write a unit spec that verifies `$allTenants.booking.findMany({})` does NOT inject `organizationId` in the WHERE clause (use a Prisma mock via `vitest-mock-extended` or the existing test harness in `prisma.service.spec.ts`).

- [ ] **Step 4.3: Commit**

```bash
git add apps/backend/src/infrastructure/database/prisma.service.ts apps/backend/src/infrastructure/database/prisma.service.spec.ts
git commit -m "feat(saas-05b): \$allTenants escape hatch on PrismaService"
```

---

## Task 5 — Admin audience: Organizations

### 5A: list-organizations handler

- [ ] **Step 5A.1: Write failing test**

Create `apps/backend/src/modules/platform/admin/list-organizations/list-organizations.handler.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { ListOrganizationsHandler } from './list-organizations.handler';
import { PrismaService } from '../../../../infrastructure/database';

describe('ListOrganizationsHandler', () => {
  let handler: ListOrganizationsHandler;
  let prisma: { $allTenants: { organization: { findMany: jest.Mock; count: jest.Mock } } };

  beforeEach(async () => {
    prisma = {
      $allTenants: { organization: { findMany: jest.fn(), count: jest.fn() } },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ListOrganizationsHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    handler = moduleRef.get(ListOrganizationsHandler);
  });

  it('returns paginated orgs across all tenants', async () => {
    prisma.$allTenants.organization.findMany.mockResolvedValue([
      { id: 'o1', slug: 'a', nameAr: 'A', suspendedAt: null },
      { id: 'o2', slug: 'b', nameAr: 'B', suspendedAt: new Date() },
    ]);
    prisma.$allTenants.organization.count.mockResolvedValue(2);

    const result = await handler.execute({ page: 1, perPage: 20 });
    expect(result.items).toHaveLength(2);
    expect(result.meta.total).toBe(2);
    expect(prisma.$allTenants.organization.findMany).toHaveBeenCalled();
  });

  it('filters by search term on slug/nameAr/nameEn', async () => {
    prisma.$allTenants.organization.findMany.mockResolvedValue([]);
    prisma.$allTenants.organization.count.mockResolvedValue(0);
    await handler.execute({ page: 1, perPage: 20, search: 'clinic' });
    expect(prisma.$allTenants.organization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array),
        }),
      }),
    );
  });
});
```

- [ ] **Step 5A.2: Run — expect fail.**

```bash
cd apps/backend && npx jest modules/platform/admin/list-organizations --no-coverage
```

- [ ] **Step 5A.3: Implement handler**

Create `list-organizations.handler.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';

export interface ListOrganizationsQuery {
  page: number;
  perPage: number;
  search?: string;
  suspended?: boolean;
}

@Injectable()
export class ListOrganizationsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(q: ListOrganizationsQuery) {
    const where: any = {};
    if (q.search) {
      where.OR = [
        { slug: { contains: q.search, mode: 'insensitive' } },
        { nameAr: { contains: q.search, mode: 'insensitive' } },
        { nameEn: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    if (q.suspended === true) where.suspendedAt = { not: null };
    if (q.suspended === false) where.suspendedAt = null;

    const [items, total] = await Promise.all([
      this.prisma.$allTenants.organization.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
      this.prisma.$allTenants.organization.count({ where }),
    ]);

    return { items, meta: { page: q.page, perPage: q.perPage, total, totalPages: Math.ceil(total / q.perPage) } };
  }
}
```

- [ ] **Step 5A.4: Run — expect pass.**

### 5B: suspend-organization handler

- [ ] **Step 5B.1: Write failing test** (must record a `SuperAdminActionLog` entry with `actionType=SUSPEND_ORG`; must set `suspendedAt` + `suspendedReason` on the org; must reject if already suspended).

- [ ] **Step 5B.2: Run — fail.**

- [ ] **Step 5B.3: Implement handler** — uses `prisma.$allTenants.organization.update` + creates `SuperAdminActionLog` inside a single `$transaction(async tx => {...})`. Because `tx` bypasses the Proxy, both calls already use the raw client (which is what we want).

- [ ] **Step 5B.4: Run — pass.**

### 5C: reinstate-organization handler

Mirror of 5B with `suspendedAt: null` + `actionType=REINSTATE_ORG`.

### 5D: get-organization handler

Returns a single org + aggregated stats (member count, booking count last 30 days, MRR).

### 5E: Controller

- [ ] **Step 5E.1: Create organizations.controller.ts**

Create `apps/backend/src/api/admin/organizations.controller.ts`:

```ts
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { ListOrganizationsHandler } from '../../modules/platform/admin/list-organizations/list-organizations.handler';
import { GetOrganizationHandler } from '../../modules/platform/admin/get-organization/get-organization.handler';
import { SuspendOrganizationHandler } from '../../modules/platform/admin/suspend-organization/suspend-organization.handler';
import { ReinstateOrganizationHandler } from '../../modules/platform/admin/reinstate-organization/reinstate-organization.handler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SuspendOrganizationDto } from './dto/suspend-organization.dto';

@Controller('api/v1/admin/organizations')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminOrganizationsController {
  constructor(
    private readonly list: ListOrganizationsHandler,
    private readonly get: GetOrganizationHandler,
    private readonly suspend: SuspendOrganizationHandler,
    private readonly reinstate: ReinstateOrganizationHandler,
  ) {}

  @Get()
  async index(@Query() q: any) {
    return this.list.execute({
      page: Number(q.page ?? 1),
      perPage: Math.min(Number(q.perPage ?? 20), 100),
      search: q.search,
      suspended: q.suspended === 'true' ? true : q.suspended === 'false' ? false : undefined,
    });
  }

  @Get(':id')
  async show(@Param('id') id: string) { return this.get.execute({ id }); }

  @Post(':id/suspend')
  async suspendOrg(
    @Param('id') id: string,
    @Body() dto: SuspendOrganizationDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.suspend.execute({ organizationId: id, superAdminUserId: user.id, reason: dto.reason });
  }

  @Post(':id/reinstate')
  async reinstateOrg(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.reinstate.execute({ organizationId: id, superAdminUserId: user.id });
  }
}
```

- [ ] **Step 5E.2: Create DTOs + run full modules/platform/admin jest suite**

```bash
cd apps/backend && npx jest modules/platform/admin --no-coverage
```

- [ ] **Step 5E.3: Commit**

```bash
git add apps/backend/src/modules/platform/admin/list-organizations \
        apps/backend/src/modules/platform/admin/get-organization \
        apps/backend/src/modules/platform/admin/suspend-organization \
        apps/backend/src/modules/platform/admin/reinstate-organization \
        apps/backend/src/api/admin/organizations.controller.ts \
        apps/backend/src/api/admin/dto/suspend-organization.dto.ts
git commit -m "feat(saas-05b): admin organizations controller + handlers"
```

---

## Task 6 — Admin audience: Users, Plans, Verticals, Metrics

### 6A: Users controller (search-users + reset-user-password handlers)

Same TDD pattern as Task 5: write failing spec, implement, run, commit. Endpoints:
- `GET /api/v1/admin/users?search=<term>&organizationId=<id>` — cross-tenant search via `$allTenants`.
- `POST /api/v1/admin/users/:id/reset-password` — sets a new password, emails the user a reset link via the existing email module, logs `RESET_PASSWORD`.

### 6B: Plans controller

Delegates to existing Plan CRUD handlers from Plan 04. Admin-audience thin wrappers:
- `GET /api/v1/admin/plans` — list all plans.
- `POST /api/v1/admin/plans` — create. Logs `PLAN_CREATE`.
- `PATCH /api/v1/admin/plans/:id` — update. Logs `PLAN_UPDATE`.
- `DELETE /api/v1/admin/plans/:id` — soft-delete (can't hard-delete a plan referenced by subscriptions). Logs `PLAN_DELETE`.

### 6C: Verticals controller

Same shape as 6B, delegating to Plan 03's Vertical CRUD handlers.

### 6D: Metrics controller

Handler: `get-platform-metrics.handler.ts`. Returns:
```ts
{
  organizations: { total, active, suspended, newThisMonth },
  users: { total, activeLast30Days },
  bookings: { totalLast30Days, completedLast30Days },
  revenue: { mrr, arr, newMrrThisMonth, churnedMrrThisMonth },
  subscriptions: { byPlan: { [planId]: count }, byStatus: { [status]: count } },
}
```

Uses `$allTenants` to `count` + `groupBy` across orgs. Cache for 5 minutes via `@nestjs/cache-manager` (Redis) to avoid hammering the DB.

### 6E: Audit-log controller

Handler: `list-audit-log.handler.ts`. Returns paginated `SuperAdminActionLog` with filters (`actionType`, `superAdminUserId`, `organizationId`, date range). No mutations — read-only for accountability.

### 6F: Commit each sub-task independently

```bash
git add apps/backend/src/modules/platform/admin/search-users apps/backend/src/modules/platform/admin/reset-user-password apps/backend/src/api/admin/users.controller.ts
git commit -m "feat(saas-05b): admin users controller"

git add apps/backend/src/api/admin/plans.controller.ts
git commit -m "feat(saas-05b): admin plans controller"

# … etc per sub-task
```

---

## Task 7 — Impersonation flow (security-sensitive)

### 7.0: Design re-confirmation

- [ ] **Step 7.0.1: Re-read Task 0 owner approval**

Confirm the written approval is on file. If the approval is older than 14 days, re-verify with the owner before proceeding.

### 7A: start-impersonation handler

- [ ] **Step 7A.1: Write failing test**

Covers:
1. Creates `ImpersonationSession` row with correct fields.
2. Creates `SuperAdminActionLog` with `actionType=IMPERSONATE_START`.
3. Issues JWT with 15-min TTL carrying `sub`, `organizationId`, `impersonatedBy`, `impersonationSessionId`, `isSuperAdmin: false`, `jti`.
4. Stores the JWT `jti` on the session row (for revocation).
5. Rejects if the super-admin already has an active impersonation session.
6. Rejects if the target org is suspended (with an override flag `allowSuspended: true` the owner can set).
7. All three writes happen in one `$transaction(async tx => {...})`.

- [ ] **Step 7A.2: Run — fail.**

- [ ] **Step 7A.3: Implement handler**

```ts
@Injectable()
export class StartImpersonationHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async execute(cmd: {
    superAdminUserId: string;
    targetOrganizationId: string;
    targetUserId: string;
    reason: string;
    ipAddress?: string;
    userAgent?: string;
    allowSuspended?: boolean;
  }) {
    if (cmd.reason.trim().length < 10) {
      throw new BadRequestException('impersonation_reason_too_short');
    }

    // Single-active-session guard
    const existing = await this.prisma.$allTenants.impersonationSession.findFirst({
      where: { superAdminUserId: cmd.superAdminUserId, endedAt: null },
    });
    if (existing) throw new ConflictException('impersonation_already_active');

    const org = await this.prisma.$allTenants.organization.findUnique({
      where: { id: cmd.targetOrganizationId },
    });
    if (!org) throw new NotFoundException('organization_not_found');
    if (org.suspendedAt && !cmd.allowSuspended) {
      throw new BadRequestException('target_organization_suspended');
    }

    const user = await this.prisma.$allTenants.user.findUnique({ where: { id: cmd.targetUserId } });
    if (!user) throw new NotFoundException('target_user_not_found');

    const sessionId = crypto.randomUUID();
    const jti = crypto.randomUUID();
    const ttlSeconds = 15 * 60;
    const autoExpiredAt = new Date(Date.now() + ttlSeconds * 1000);

    const shadowJwt = await this.jwt.signAsync({
      sub: cmd.targetUserId,
      organizationId: cmd.targetOrganizationId,
      impersonatedBy: cmd.superAdminUserId,
      impersonationSessionId: sessionId,
      isSuperAdmin: false,
      jti,
    }, { expiresIn: ttlSeconds });

    await this.prisma.$transaction(async (tx) => {
      await tx.impersonationSession.create({
        data: {
          id: sessionId,
          superAdminUserId: cmd.superAdminUserId,
          targetOrganizationId: cmd.targetOrganizationId,
          targetUserId: cmd.targetUserId,
          reason: cmd.reason,
          ipAddress: cmd.ipAddress,
          userAgent: cmd.userAgent,
          jwtJti: jti,
          autoExpiredAt,
        },
      });
      await tx.superAdminActionLog.create({
        data: {
          superAdminUserId: cmd.superAdminUserId,
          actionType: 'IMPERSONATE_START',
          organizationId: cmd.targetOrganizationId,
          impersonationSessionId: sessionId,
          reason: cmd.reason,
          ipAddress: cmd.ipAddress,
          userAgent: cmd.userAgent,
        },
      });
    });

    return { sessionId, token: shadowJwt, expiresAt: autoExpiredAt };
  }
}
```

- [ ] **Step 7A.4: Run — pass.**

### 7B: end-impersonation handler

- [ ] **Step 7B.1: Write failing test** — covers:
  1. Sets `endedAt` on the session.
  2. Adds `jti` to the JWT revocation set (Redis `blacklist:jti:<jti>` with TTL = remaining lifetime).
  3. Creates `SuperAdminActionLog` entry `IMPERSONATE_END`.
  4. Rejects if session already ended.

- [ ] **Step 7B.2: Run — fail. Implement. Run — pass.**

### 7C: JWT verification — honor impersonation session

- [ ] **Step 7C.1: Modify JwtAuthGuard**

In `apps/backend/src/common/guards/jwt-auth.guard.ts` (or wherever `JwtStrategy.validate` lives), add:

```ts
if (payload.impersonationSessionId) {
  // verify session still active
  const session = await this.prisma.$allTenants.impersonationSession.findUnique({
    where: { id: payload.impersonationSessionId },
  });
  if (!session || session.endedAt) {
    throw new UnauthorizedException('impersonation_session_ended');
  }
  // check jti not revoked
  const revoked = await this.redis.exists(`blacklist:jti:${payload.jti}`);
  if (revoked) throw new UnauthorizedException('impersonation_token_revoked');
  req.impersonation = session;
}
```

- [ ] **Step 7C.2: Write request-scoped audit interceptor**

Create `apps/backend/src/common/interceptors/impersonation-audit.interceptor.ts`. Every mutating request (`POST`/`PATCH`/`PUT`/`DELETE`) made under an impersonation session creates a `SuperAdminActionLog` entry with `actionType` derived from the route. (For MVP, a generic `IMPERSONATED_ACTION` with route + method in metadata is acceptable; extend later.)

Wire it as a global interceptor, gated on `req.impersonation` being present.

### 7D: BullMQ sweeper — expire sessions

- [ ] **Step 7D.1: Create `expire-impersonation-sessions.task.ts`**

Runs every minute. For each session where `autoExpiredAt < now() AND endedAt IS NULL`, calls `EndImpersonationHandler` with `reason: 'auto-expired'`.

### 7E: Impersonation controller

```ts
@Controller('api/v1/admin/impersonation')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class ImpersonationController {
  constructor(
    private readonly start: StartImpersonationHandler,
    private readonly end: EndImpersonationHandler,
    private readonly list: ListImpersonationSessionsHandler,
  ) {}

  @Post()
  async create(
    @Body() dto: StartImpersonationDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    return this.start.execute({
      superAdminUserId: user.id,
      targetOrganizationId: dto.organizationId,
      targetUserId: dto.userId,
      reason: dto.reason,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
  }

  @Post(':sessionId/end')
  async endSession(@Param('sessionId') id: string, @CurrentUser() user: { id: string }) {
    return this.end.execute({ sessionId: id, superAdminUserId: user.id, reason: 'manual-end' });
  }

  @Get()
  async indexSessions(@Query() q: any) { return this.list.execute(q); }
}
```

### 7F: Commit

```bash
git add apps/backend/src/modules/platform/admin/start-impersonation \
        apps/backend/src/modules/platform/admin/end-impersonation \
        apps/backend/src/modules/platform/admin/list-impersonation-sessions \
        apps/backend/src/api/admin/impersonation.controller.ts \
        apps/backend/src/api/admin/dto/start-impersonation.dto.ts \
        apps/backend/src/common/interceptors/impersonation-audit.interceptor.ts \
        apps/backend/src/common/guards/jwt-auth.guard.ts \
        apps/backend/src/modules/platform/admin/expire-impersonation-sessions.task.ts
git commit -m "feat(saas-05b): impersonation flow with audit trail + 15-min TTL"
```

---

## Task 8 — AdminModule registration

- [ ] **Step 8.1: Create `admin.module.ts`**

Create `apps/backend/src/api/admin/admin.module.ts` importing all 6 controllers + all 11 handler providers.

- [ ] **Step 8.2: Register in AppModule**

Edit `apps/backend/src/app.module.ts`:

```ts
imports: [
  // ...
  AdminModule,
],
```

- [ ] **Step 8.3: Update auth controller to include `isSuperAdmin` claim**

Edit `apps/backend/src/api/dashboard/auth/auth.controller.ts` (and the underlying `LoginHandler` / `TokenService.issueTokenPair`). When building the JWT payload, include:

```ts
{
  sub: user.id,
  organizationId: membership?.organizationId ?? null,
  isSuperAdmin: user.isSuperAdmin,
  // ...
}
```

And in the login response body, include `isSuperAdmin: user.isSuperAdmin` so the frontend can redirect properly.

- [ ] **Step 8.4: Typecheck + full test run**

```bash
cd apps/backend && npm run typecheck && npm run test
```

- [ ] **Step 8.5: Commit**

```bash
git add apps/backend/src/api/admin/admin.module.ts apps/backend/src/app.module.ts apps/backend/src/api/dashboard/auth/
git commit -m "feat(saas-05b): register AdminModule + include isSuperAdmin in JWT"
```

---

## Task 9 — E2E isolation spec

- [ ] **Step 9.1: Create `test/e2e/admin/super-admin.e2e-spec.ts`**

Covers:

1. **Happy path for super-admin:**
   - Seed super-admin + two orgs (A, B) + a regular tenant user.
   - Login as super-admin → get JWT with `isSuperAdmin=true`.
   - `GET /api/v1/admin/organizations` returns both orgs.
   - `POST /api/v1/admin/organizations/:A/suspend` with `reason="delinquent payment"` succeeds.
   - Verify `SuperAdminActionLog` contains `SUSPEND_ORG` entry.
   - `POST /api/v1/admin/impersonation` with `{organizationId: B, userId: <tenant-user>, reason: "support ticket #123"}` returns a shadow JWT.
   - Hit `GET /api/v1/dashboard/bookings` with the shadow JWT — succeeds, sees B's bookings, audit log gains entry.
   - `POST /api/v1/admin/impersonation/:sessionId/end` — session ends.
   - Using shadow JWT after `end` → 401.

2. **Non-super-admin forbidden on every admin route:**
   - Seed a regular tenant user (isSuperAdmin=false).
   - Login → get a normal JWT.
   - For each admin route (iterate the 6 controllers), assert 403.

3. **Super-admin can't have two active impersonation sessions.**

4. **Expired impersonation JWT is rejected** (fake time advance by 16 min via `jest.useFakeTimers`).

- [ ] **Step 9.2: Run**

```bash
cd apps/backend && npx jest test/e2e/admin/super-admin --config test/jest-e2e.json
```

- [ ] **Step 9.3: Commit**

```bash
git add apps/backend/test/e2e/admin/
git commit -m "test(saas-05b): super-admin + impersonation e2e suite"
```

---

## Task 10 — Scaffold `apps/admin/` Next.js app

- [ ] **Step 10.1: Create package.json + workspace registration**

Create `apps/admin/package.json`:

```json
{
  "name": "@carekit/admin",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 5104 --turbopack",
    "build": "next build",
    "start": "next start -p 5104",
    "typecheck": "tsc --noEmit",
    "lint": "next lint",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tanstack/react-query": "^5.59.0",
    "next-intl": "^3.21.0",
    "zod": "^3.23.8",
    "react-hook-form": "^7.53.0",
    "@hookform/resolvers": "^3.9.0",
    "@carekit/api-client": "*",
    "@carekit/shared": "*",
    "@carekit/ui": "*",
    "lucide-react": "^0.456.0",
    "date-fns": "^4.1.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "eslint": "^9.14.0",
    "eslint-config-next": "^15.0.0",
    "vitest": "^4.1.4",
    "@testing-library/react": "^16.1.0",
    "tailwindcss": "^4.0.0"
  }
}
```

Edit root `package.json`:

```json
"workspaces": [
  "apps/backend",
  "apps/dashboard",
  "apps/admin",
  "apps/website",
  "packages/shared",
  "packages/api-client",
  "packages/ui"
]
```

- [ ] **Step 10.2: Create tsconfig, next.config, middleware**

`apps/admin/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "module": "esnext",
    "moduleResolution": "bundler",
    "paths": {
      "@/*": ["./*"],
      "@carekit/ui": ["../../packages/ui/src/index.ts"],
      "@carekit/ui/*": ["../../packages/ui/src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`apps/admin/next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@carekit/ui', '@carekit/shared', '@carekit/api-client'],
};
export default nextConfig;
```

`apps/admin/middleware.ts` — reads the session cookie + JWT; if not `isSuperAdmin`, redirects to `https://dashboard.carekit.app`.

- [ ] **Step 10.3: Install**

```bash
cd /Users/tariq/code/carekit && npm install
```

- [ ] **Step 10.4: Commit**

```bash
git add apps/admin package.json package-lock.json
git commit -m "feat(saas-05b): scaffold apps/admin Next.js app"
```

---

## Task 11 — Admin app pages (3 representative skeletons)

Build the 9 admin routes. Below are the 3 representative page skeletons the plan codifies verbatim; replicate the pattern for the other 6 (users, plans, verticals, metrics, audit-log, impersonation-sessions).

### 11A: app/(admin)/layout.tsx — admin shell

```tsx
import { ImpersonationBanner } from '@/components/impersonation-banner';
import { AdminSidebar } from '@/components/admin-sidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" dir="rtl">
      <AdminSidebar />
      <div className="flex-1">
        <ImpersonationBanner />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
```

### 11B: app/(admin)/organizations/page.tsx — list page following root page-anatomy law

- [ ] **Step 11B.1: Create page** (≤150 lines — orchestration only):

```tsx
'use client';
import { useState } from 'react';
import { useOrganizations } from '@/hooks/use-organizations';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { PageHeader } from '@/components/page-header';
import { OrgStatsGrid } from '@/components/features/organizations/org-stats-grid';
import { OrgFilterBar } from '@/components/features/organizations/org-filter-bar';
import { OrgTable } from '@/components/features/organizations/org-table';
import { Pagination } from '@/components/pagination';

export default function OrganizationsPage() {
  const [filters, setFilters] = useState({ page: 1, perPage: 20, search: '', suspended: undefined as boolean | undefined });
  const { data, isLoading, error } = useOrganizations(filters);

  return (
    <>
      <Breadcrumbs items={[{ label: 'Admin', href: '/' }, { label: 'Organizations' }]} />
      <PageHeader
        title="Organizations"
        description="Manage all tenant organizations on the CareKit platform"
        actions={[
          { label: 'Export', variant: 'outline', onClick: () => {/* …*/} },
          { label: '+ Add', variant: 'default', onClick: () => {/* …*/}, primary: true },
        ]}
      />
      {error && <ErrorBanner error={error} />}
      <OrgStatsGrid />
      <OrgFilterBar value={filters} onChange={setFilters} />
      <OrgTable items={data?.items ?? []} isLoading={isLoading} />
      {data?.meta && data.meta.totalPages > 1 && (
        <Pagination meta={data.meta} onPageChange={(p) => setFilters({ ...filters, page: p })} />
      )}
    </>
  );
}
```

### 11C: app/(admin)/organizations/[id]/page.tsx — detail + impersonate

```tsx
'use client';
import { useParams } from 'next/navigation';
import { Button, Card, Dialog } from '@carekit/ui';
import { useOrganization } from '@/hooks/use-organizations';
import { useImpersonation } from '@/hooks/use-impersonation';
import { ImpersonateDialog } from '@/components/features/organizations/impersonate-dialog';
import { SuspendDialog } from '@/components/features/organizations/suspend-dialog';

export default function OrgDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: org } = useOrganization(id);
  if (!org) return null;

  return (
    <div className="space-y-6">
      <Card>
        <h1 className="text-2xl">{org.nameAr}</h1>
        <p className="text-muted-foreground">{org.slug}.carekit.app</p>
        <div className="mt-4 flex gap-2">
          <ImpersonateDialog organizationId={org.id} />
          <SuspendDialog organizationId={org.id} suspended={!!org.suspendedAt} />
        </div>
      </Card>
      {/* members / bookings / MRR / recent activity sections */}
    </div>
  );
}
```

The `<ImpersonateDialog>` renders: target user select, reason textarea (min 10 chars), confirm button. On submit calls `POST /api/v1/admin/impersonation`, stores the returned JWT in an HttpOnly cookie via a server action, and navigates the user to `https://dashboard.carekit.app?impersonation-session=<id>`.

- [ ] **Step 11D: Commit the 3 representative page skeletons + hooks + sidebar**

```bash
git add apps/admin
git commit -m "feat(saas-05b): admin app shell + organizations pages"
```

- [ ] **Step 11E: Build remaining 6 pages (users, plans, verticals, metrics, audit-log, impersonation-sessions)**

Each follows the page-anatomy law (Breadcrumbs → PageHeader → StatsGrid → FilterBar → DataTable → Pagination). Commit each page independently:

```bash
# one commit per page, per repo commit rules
```

---

## Task 12 — Infrastructure (Docker + Nginx)

- [ ] **Step 12.1: Add admin service to docker-compose.yml**

Edit `docker/docker-compose.yml`:

```yaml
services:
  # …
  admin:
    build:
      context: ..
      dockerfile: apps/admin/Dockerfile
    ports:
      - "5104:5104"
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:5100
    depends_on:
      - backend
```

- [ ] **Step 12.2: Create `apps/admin/Dockerfile`** — mirror `apps/dashboard/Dockerfile` with port 5104.

- [ ] **Step 12.3: Add Nginx route**

Edit `docker/nginx/nginx.conf` (or the production counterpart):

```nginx
server {
  listen 443 ssl;
  server_name admin.carekit.app;

  location / {
    proxy_pass http://admin:5104;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  location /api/ {
    proxy_pass http://backend:5100;
  }
}
```

- [ ] **Step 12.4: Commit**

```bash
git add docker/ apps/admin/Dockerfile
git commit -m "feat(saas-05b): docker + nginx for admin.carekit.app on :5104"
```

---

## Task 13 — Docs + root CLAUDE.md update

- [ ] **Step 13.1: Create `apps/admin/CLAUDE.md`**

Contents:

```markdown
# CareKit Super-admin App

## Purpose
CareKit employees manage all tenant organizations, impersonate users for support,
suspend accounts, and view platform-wide metrics. Tenants never download this app.

## Hard rules
1. No tenant context. Every endpoint reads ACROSS orgs via `$allTenants`.
2. Every destructive action (suspend, reset-password, impersonate, plan/vertical mutation)
   MUST write a `SuperAdminActionLog` entry.
3. Never expose tenant payment card data (PCI scope); Moyasar token IDs only, and only during explicit impersonation.
4. UI must always show an "Impersonating as X" banner when an impersonation session is active.
5. Auth reuses `POST /api/v1/auth/login`; non-super-admin users are redirected to dashboard.carekit.app.

## Layer rules
Same as apps/dashboard/CLAUDE.md. File-size limits identical. Components from `@carekit/ui`.

## Routes
/                          Platform dashboard (metrics)
/organizations             List + filter all tenants
/organizations/[id]        Detail + impersonate + suspend
/users                     Cross-tenant user search
/plans                     Plan CRUD (billing)
/verticals                 Vertical CRUD
/metrics                   Platform metrics (revenue, churn)
/audit-log                 All SuperAdminActionLog entries
/impersonation-sessions    Active + historical sessions

## Development
```bash
npm run dev:admin          # Next.js dev on :5104
```

## Security posture
- SuperAdminGuard on every route.
- Shadow JWT during impersonation carries `isSuperAdmin: false` — impersonation DROPS super-admin powers.
- Impersonation JWT TTL: 15 minutes, auto-expired by BullMQ sweeper.
- Every request under impersonation logged by `ImpersonationAuditInterceptor`.
```

- [ ] **Step 13.2: Update root CLAUDE.md Structure tree**

Edit `/Users/tariq/code/carekit/CLAUDE.md`. In the Structure section, change:

```
carekit/
├── apps/
│   ├── backend/
│   ├── dashboard/
```

to:

```
carekit/
├── apps/
│   ├── backend/
│   ├── dashboard/
│   ├── admin/             # NEW — super-admin panel (admin.carekit.app, :5104)
```

Also add to the Commands section:

```
npm run dev:admin         # Super-admin on :5104
```

- [ ] **Step 13.3: Commit**

```bash
git add apps/admin/CLAUDE.md CLAUDE.md
git commit -m "docs(saas-05b): admin app conventions + root structure update"
```

---

## Task 14 — Final verification + PR

- [ ] **Step 14.1: Full monorepo test + build**

```bash
cd /Users/tariq/code/carekit && npm run test && npm run build
```

All workspaces green.

- [ ] **Step 14.2: Manual smoke test**

```bash
npm run dev:backend & npm run dev:admin
```

1. Log in at `http://localhost:5104/login` with the seeded super-admin credentials.
2. See organizations list. Suspend one. Confirm banner on that org.
3. Reinstate it.
4. Impersonate the org owner. Verify:
   - Redirected to dashboard.
   - Red impersonation banner visible.
   - Audit-log shows `IMPERSONATE_START`.
5. End session. Verify:
   - Banner disappears.
   - Any further API call with the shadow JWT → 401.
   - Audit-log shows `IMPERSONATE_END`.

Take screenshots into `docs/superpowers/qa/saas-05b-report-<date>.md`.

- [ ] **Step 14.3: Kiwi sync**

Create `data/kiwi/super-admin-<date>.json` with the manual QA results and run:

```bash
npm run kiwi:sync-manual data/kiwi/super-admin-<date>.json
```

- [ ] **Step 14.4: Open PR**

```bash
gh pr create \
  --base main \
  --head feat/saas-05b-super-admin-app \
  --title "feat(saas-05b): super-admin app + impersonation" \
  --body "$(cat <<'EOF'
## Summary
- New app apps/admin/ on admin.carekit.app (:5104)
- Backend audience src/api/admin/ with 6 controllers + 11 handlers
- SuperAdminGuard + ImpersonationAuditInterceptor
- Impersonation flow: 15-min shadow JWT, full audit trail, auto-expiry sweeper
- Schema: User.isSuperAdmin, ImpersonationSession, SuperAdminActionLog, Org.suspendedAt

## Owner-approval gate satisfied
Impersonation design approved on <DATE>.

## Test plan
- [x] Super-admin e2e suite
- [x] Non-admin forbidden on every admin route
- [x] Expired impersonation JWT rejected
- [x] Manual QA: suspend + reinstate + impersonate + end session

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 14.5: Memory file**

Create `/Users/tariq/.claude/projects/-Users-tariq-code-carekit/memory/saas05b_status.md`:

```markdown
---
name: SaaS-05b status
description: Plan 05b (super-admin app) — status and key facts
type: project
---
**Status:** [fill in: PR number, test count, any divergences]

**Scope delivered:** apps/admin on admin.carekit.app; 6 controllers + 11 handlers; SuperAdminGuard; impersonation with audit trail; schema: User.isSuperAdmin + ImpersonationSession + SuperAdminActionLog.

**Security posture:**
- Impersonation shadow JWT carries isSuperAdmin=false
- Every destructive action writes SuperAdminActionLog
- 15-min TTL auto-sweeper
- SuperAdminGuard on every admin route

**Key patterns established:**
- `prisma.$allTenants` escape hatch for cross-tenant reads
- ImpersonationAuditInterceptor tags every mutating request

**Next:** Plan 06 (dashboard terminology + EN i18n)
```

- [ ] **Step 14.6: Update transformation index**

Edit `docs/superpowers/plans/2026-04-21-saas-transformation-index.md`:
- Phase map row 05b → `✅ DONE (<date>)` with PR link.
- Progress log new row with date + PR + summary.
- Status dashboard progress count.

---

## Amendments applied during execution

> _Empty until execution. If reality diverges from any step, stop, document here, and await confirmation before continuing._
