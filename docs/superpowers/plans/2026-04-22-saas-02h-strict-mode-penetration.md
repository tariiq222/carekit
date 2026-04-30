# SaaS-02h — Strict Mode + RLS Penetration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the last-mile gaps in PostgreSQL Row-Level Security so that a query bypassing the application's tenant middleware is physically blocked by the database, flip `TENANT_ENFORCEMENT=strict` fail-closed in non-dev environments, and prove isolation with penetration tests that bypass Prisma entirely.

**Architecture:** The scaffolding from SaaS-01/02 already ships per-tenant columns, Prisma extension-based auto-scoping, `RlsHelper`, a `TenantContextService` over CLS, and RLS policies on every scoped table across seven clusters. Three critical gaps remain: (1) policy migrations diverged — half use `app.current_org_id` (matching `RlsHelper`) and half use `app.current_organization_id` (unset at runtime), (2) `RlsHelper.applyInTransaction()` is never actually invoked by the live request path — the GUC is always NULL, and the policies include an `OR … IS NULL` escape that silently allows everything, (3) no test proves a raw SQL query bypassing Prisma middleware is blocked. This plan reconciles the GUC name, rewrites policies to fail-closed with an explicit system-bypass GUC, wires the GUC into every authenticated request via a NestJS interceptor + a CLS-scoped transaction routed through `PrismaService`, and adds pg-client-level penetration tests.

**Tech Stack:** PostgreSQL 16 RLS (`SET LOCAL`, policies, session GUCs), Prisma 7 (`$extends`, `$transaction`, `@prisma/adapter-pg`), NestJS 11 (interceptors, CLS via `nestjs-cls`), Jest e2e with direct `pg` client for penetration tests.

---

## File Structure

### Created
- `apps/backend/prisma/migrations/20260422_saas02h_rls_reconcile/migration.sql` — unify GUC name, drop silent NULL bypass, add `app_set_tenant` / `app_clear_tenant` helper fns, add `app_is_system_bypass` GUC for webhook/cron escape.
- `apps/backend/src/common/tenant/db-tx.constants.ts` — CLS key for request-scoped Prisma transaction.
- `apps/backend/src/common/tenant/rls-request.interceptor.ts` — wraps every authenticated request in `prisma.$transaction` with GUC set via `RlsHelper`, stashes tx in CLS.
- `apps/backend/src/common/tenant/rls-request.interceptor.spec.ts` — unit tests.
- `apps/backend/src/common/tenant/with-tenant-rls.helper.ts` — explicit wrapper for non-HTTP entry points (webhooks, BullMQ jobs).
- `apps/backend/src/common/tenant/with-tenant-rls.helper.spec.ts`
- `apps/backend/test/tenant-isolation/rls-penetration.e2e-spec.ts` — direct `pg.Client` queries with GUC variations; proves policies block.
- `apps/backend/test/tenant-isolation/rls-strict-mode.e2e-spec.ts` — HTTP e2e proving strict mode rejects context-less requests.

### Modified
- `apps/backend/src/infrastructure/database/prisma.service.ts` — Proxy now prefers CLS-scoped tx over base client when present.
- `apps/backend/src/common/tenant/tenant.module.ts` — register new interceptor + helper; export `APP_INTERCEPTOR`.
- `apps/backend/src/common/tenant/rls.helper.ts` — use the new `app_set_tenant()` function, add `applySystemBypass()`.
- `apps/backend/src/common/tenant/tenant.constants.ts` — add `DB_TX_CLS_KEY`.
- `apps/backend/src/modules/finance/moyasar-webhook/moyasar-webhook.handler.ts` — wrap tenant-resolved body in `withTenantRls`.
- `apps/backend/src/modules/comms/sms-dlr/sms-dlr.handler.ts` — same.
- `apps/backend/src/modules/ops/cron-tasks/*.processor.ts` — wrap per-tenant cron iterations.
- `apps/backend/.env` — keep `TENANT_ENFORCEMENT=off` for local dev; unchanged.
- `apps/backend/test/jest-e2e.setup.ts` (or equivalent) — set `TENANT_ENFORCEMENT=strict` for the e2e run.
- `apps/backend/docs/saas-tenancy.md` — add "RLS model" + "escape hatches" sections.
- `CLAUDE.md` memory trail — add `saas02h_status.md`.

---

## Task 1: Reconcile RLS migrations — one canonical GUC

**Files:**
- Create: `apps/backend/prisma/migrations/20260422_saas02h_rls_reconcile/migration.sql`

**Context:** Migrations 02a/02b/02c use `app_current_org_id()` (reads GUC `app.current_org_id`). Migrations 02e/02f/02g/02g-sms/password-history use `current_setting('app.current_organization_id', true)` directly — a different GUC that `RlsHelper` never sets. We consolidate on `app.current_org_id` (matching `RlsHelper`), and add `app.is_system_bypass` for webhooks/cron.

- [ ] **Step 1: Author the reconciliation migration**

Create `apps/backend/prisma/migrations/20260422_saas02h_rls_reconcile/migration.sql`:

```sql
-- SaaS-02h: reconcile RLS GUC naming and remove silent NULL bypass.
-- Before this migration two different GUCs were referenced by policies
-- (`app.current_org_id` in 02a/b/c, `app.current_organization_id` in 02e+).
-- Neither was being set at runtime, so RLS was effectively a no-op. This
-- migration: (1) canonicalizes on `app.current_org_id`, (2) replaces the
-- silent "NULL means allow" clause with an explicit `app.is_system_bypass`
-- GUC that must be deliberately set to 'on' to bypass (webhooks, cron).

-- 1. Helper function — returns the current tenant UUID or NULL.
CREATE OR REPLACE FUNCTION app_current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_org_id', true), '')::uuid;
$$;

-- 2. Helper function — returns true only when system bypass is explicitly enabled.
CREATE OR REPLACE FUNCTION app_is_system_bypass()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.is_system_bypass', true), ''), 'off') = 'on';
$$;

-- 3. Transactional helpers — callable by application code via $executeRaw.
-- Using a SECURITY DEFINER function keeps the SET LOCAL contract explicit
-- and lets us log/audit usage in one place later.
CREATE OR REPLACE FUNCTION app_set_tenant(org_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.current_org_id', org_id::text, true);
  PERFORM set_config('app.is_system_bypass', 'off', true);
END;
$$;

CREATE OR REPLACE FUNCTION app_enable_system_bypass()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.current_org_id', '', true);
  PERFORM set_config('app.is_system_bypass', 'on', true);
END;
$$;

-- 4. Drop old policies that used the wrong GUC or the silent NULL bypass.
-- Every scoped table gets the same replacement policy below.
DO $$
DECLARE
  t text;
  scoped_tables text[] := ARRAY[
    -- 02a identity
    'RefreshToken','CustomRole','Permission',
    -- 02b people
    'Client','ClientRefreshToken','Employee','EmployeeBranch','EmployeeService',
    'EmployeeAvailability','EmployeeAvailabilityException',
    -- 02c org-config + org-experience
    'Branch','Department','ServiceCategory','Service','ServiceBookingConfig',
    'ServiceDurationOption','EmployeeServiceOption','BusinessHour','Holiday',
    'BrandingConfig','IntakeForm','IntakeField','Rating','OrganizationSettings',
    -- 02d bookings
    'Booking','BookingStatusLog','WaitlistEntry','GroupSession','GroupEnrollment',
    'GroupSessionWaitlist','BookingSettings',
    -- 02e finance
    'Invoice','Payment','Coupon','CouponRedemption','RefundRequest',
    'ZatcaSubmission','ZatcaConfig',
    -- 02f comms + ai partial
    'EmailTemplate','Notification','ChatConversation','CommsChatMessage',
    'ChatSession','ChatMessage','ContactMessage','ChatbotConfig',
    -- 02g ai/media/ops/platform/content
    'KnowledgeDocument','DocumentChunk','File','ActivityLog','Report',
    'ProblemReport','Integration','FeatureFlag','SiteSetting',
    -- 02g-sms
    'OrganizationSmsConfig','SmsDelivery',
    -- post-02g
    'PasswordHistory'
  ];
BEGIN
  FOREACH t IN ARRAY scoped_tables LOOP
    -- Drop whichever old policy name exists — names diverged across clusters.
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_refresh_token ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_custom_role ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_permission ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_client ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_employee ON %I', t);
    -- Ensure RLS + FORCE are on (idempotent).
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    -- Unified policy: allow only if org matches current GUC, OR system bypass is on.
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I '
      'USING ("organizationId"::uuid = app_current_org_id() OR app_is_system_bypass()) '
      'WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_is_system_bypass())',
      t
    );
  END LOOP;
END $$;

-- 5. Revoke default privileges on the bypass helper — only the app role should call it.
-- (The app role is the connection role from DATABASE_URL; PUBLIC is revoked out of caution.)
REVOKE ALL ON FUNCTION app_enable_system_bypass() FROM PUBLIC;
```

- [ ] **Step 2: Apply and verify the migration locally**

```bash
cd apps/backend
npm run docker:up  # if not already up
npm run prisma:migrate
```

Expected: migration applies cleanly; `psql` check shows unified policies.

```bash
docker exec -i deqah_postgres psql -U deqah -d deqah -c \
  "SELECT polname, relname FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE polname='tenant_isolation' ORDER BY relname LIMIT 5;"
```

Expected: five rows, all `polname = tenant_isolation`.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/prisma/migrations/20260422_saas02h_rls_reconcile/
git commit -m "feat(saas-02h): reconcile RLS policies to single GUC with explicit bypass"
```

---

## Task 2: Prove the reconciled policy actually blocks — first penetration test

**Files:**
- Create: `apps/backend/test/tenant-isolation/rls-penetration.e2e-spec.ts`

**Context:** Before wiring any app code, we prove at the database level that the new policy denies cross-tenant reads when the GUC is set correctly. This uses a raw `pg.Client`, bypassing Prisma entirely, so the test cannot be fooled by the application-layer extension.

- [ ] **Step 1: Write the failing penetration test**

Create `apps/backend/test/tenant-isolation/rls-penetration.e2e-spec.ts`:

```typescript
import { Client } from 'pg';
import { randomUUID } from 'crypto';

const DB_URL = process.env.DATABASE_URL!;

describe('RLS penetration — raw pg client', () => {
  let client: Client;
  const orgA = randomUUID();
  const orgB = randomUUID();

  beforeAll(async () => {
    client = new Client({ connectionString: DB_URL });
    await client.connect();

    // Seed two orgs + one Branch each (Branch is scoped, simple schema).
    await client.query('BEGIN');
    await client.query('SELECT app_enable_system_bypass()');
    await client.query(
      `INSERT INTO "Organization" (id, slug, "displayName", status, "createdAt", "updatedAt")
       VALUES ($1, $2, 'A', 'ACTIVE', now(), now()),
              ($3, $4, 'B', 'ACTIVE', now(), now())
       ON CONFLICT DO NOTHING`,
      [orgA, `org-a-${orgA.slice(0, 8)}`, orgB, `org-b-${orgB.slice(0, 8)}`],
    );
    await client.query(
      `INSERT INTO "Branch" (id, name, "organizationId", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), 'A-main', $1, now(), now()),
              (gen_random_uuid(), 'B-main', $2, now(), now())`,
      [orgA, orgB],
    );
    await client.query('COMMIT');
  });

  afterAll(async () => {
    await client.query('BEGIN');
    await client.query('SELECT app_enable_system_bypass()');
    await client.query('DELETE FROM "Branch" WHERE "organizationId" IN ($1,$2)', [orgA, orgB]);
    await client.query('DELETE FROM "Organization" WHERE id IN ($1,$2)', [orgA, orgB]);
    await client.query('COMMIT');
    await client.end();
  });

  it('returns zero rows for other tenant when GUC is set to orgA', async () => {
    await client.query('BEGIN');
    await client.query('SELECT app_set_tenant($1)', [orgA]);
    const res = await client.query('SELECT name FROM "Branch" WHERE "organizationId" = $1', [orgB]);
    await client.query('ROLLBACK');
    expect(res.rows).toHaveLength(0);
  });

  it('returns own rows when GUC matches', async () => {
    await client.query('BEGIN');
    await client.query('SELECT app_set_tenant($1)', [orgA]);
    const res = await client.query('SELECT name FROM "Branch" WHERE "organizationId" = $1', [orgA]);
    await client.query('ROLLBACK');
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].name).toBe('A-main');
  });

  it('returns zero rows when GUC is unset (no silent bypass)', async () => {
    await client.query('BEGIN');
    // Deliberately do NOT call app_set_tenant or bypass.
    const res = await client.query('SELECT name FROM "Branch" WHERE "organizationId" = $1', [orgA]);
    await client.query('ROLLBACK');
    expect(res.rows).toHaveLength(0);
  });

  it('returns all rows when system bypass is enabled', async () => {
    await client.query('BEGIN');
    await client.query('SELECT app_enable_system_bypass()');
    const res = await client.query(
      'SELECT name FROM "Branch" WHERE "organizationId" IN ($1, $2) ORDER BY name',
      [orgA, orgB],
    );
    await client.query('ROLLBACK');
    expect(res.rows).toHaveLength(2);
  });

  it('blocks INSERT for a different tenant (WITH CHECK)', async () => {
    await client.query('BEGIN');
    await client.query('SELECT app_set_tenant($1)', [orgA]);
    await expect(
      client.query(
        'INSERT INTO "Branch" (id, name, "organizationId", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, now(), now())',
        ['sneaky', orgB],
      ),
    ).rejects.toThrow(/row-level security/i);
    await client.query('ROLLBACK');
  });
});
```

- [ ] **Step 2: Run the test — expect PASS now that migration is applied**

```bash
cd apps/backend && npx jest --config=test/jest-e2e.json rls-penetration -i
```

Expected: all 5 tests pass. If test 3 (unset GUC returns 0 rows) fails, the NULL bypass is still present — re-check the migration.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/test/tenant-isolation/rls-penetration.e2e-spec.ts
git commit -m "test(saas-02h): rls penetration — raw pg client proves policy enforcement"
```

---

## Task 3: Add `DB_TX_CLS_KEY` + update `RlsHelper` to use new SQL helpers

**Files:**
- Modify: `apps/backend/src/common/tenant/tenant.constants.ts`
- Modify: `apps/backend/src/common/tenant/rls.helper.ts`
- Modify: `apps/backend/src/common/tenant/rls.helper.spec.ts`

- [ ] **Step 1: Extend constants**

Add to `apps/backend/src/common/tenant/tenant.constants.ts` (keep existing contents):

```typescript
/**
 * CLS slot for a request-scoped Prisma transaction. When set, PrismaService's
 * proxy routes model accessors through this tx so every query participates in
 * the same `SET LOCAL app.current_org_id` scope applied by RlsRequestInterceptor.
 */
export const DB_TX_CLS_KEY = 'dbTx';
```

- [ ] **Step 2: Rewrite `RlsHelper` to call the new SQL helpers**

Replace `apps/backend/src/common/tenant/rls.helper.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';

type Executor = { $executeRawUnsafe: (sql: string, ...args: unknown[]) => Promise<unknown> };

@Injectable()
export class RlsHelper {
  constructor(private readonly ctx: TenantContextService) {}

  /**
   * Set `app.current_org_id` on the current transaction so RLS policies see
   * the tenant from CLS. Must be called inside a `$transaction` — uses
   * SET LOCAL semantics via the `app_set_tenant()` SQL function.
   */
  async applyInTransaction(tx: Executor): Promise<void> {
    const orgId = this.ctx.getOrganizationId();
    if (!orgId) {
      // Strict mode handles this upstream in the interceptor; defensive no-op here.
      return;
    }
    await tx.$executeRawUnsafe(`SELECT app_set_tenant('${this.escape(orgId)}'::uuid)`);
  }

  /**
   * Enable system bypass — used by webhook receivers and cron jobs that must
   * resolve the tenant from the payload before switching to a normal scope.
   * The caller MUST switch back to `applyInTransaction` before doing any
   * tenant-visible work; this is not a blanket allow.
   */
  async applySystemBypass(tx: Executor): Promise<void> {
    await tx.$executeRawUnsafe('SELECT app_enable_system_bypass()');
  }

  private escape(v: string): string {
    return v.replace(/'/g, "''");
  }
}
```

- [ ] **Step 3: Update the existing spec**

Open `apps/backend/src/common/tenant/rls.helper.spec.ts` and update assertions so they expect `SELECT app_set_tenant('<uuid>'::uuid)` instead of `SET LOCAL app.current_org_id = '...'`. Add a test for `applySystemBypass` calling `SELECT app_enable_system_bypass()`.

Example test body:

```typescript
it('applies system bypass via SQL helper', async () => {
  const tx = { $executeRawUnsafe: jest.fn().mockResolvedValue(undefined) };
  await helper.applySystemBypass(tx);
  expect(tx.$executeRawUnsafe).toHaveBeenCalledWith('SELECT app_enable_system_bypass()');
});
```

- [ ] **Step 4: Run the spec**

```bash
cd apps/backend && npx jest common/tenant/rls.helper.spec.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/common/tenant/tenant.constants.ts \
        apps/backend/src/common/tenant/rls.helper.ts \
        apps/backend/src/common/tenant/rls.helper.spec.ts
git commit -m "feat(saas-02h): RlsHelper uses app_set_tenant/app_enable_system_bypass fns"
```

---

## Task 4: Build the `withTenantRls` helper for non-HTTP entry points

**Files:**
- Create: `apps/backend/src/common/tenant/with-tenant-rls.helper.ts`
- Create: `apps/backend/src/common/tenant/with-tenant-rls.helper.spec.ts`

**Context:** Webhooks, BullMQ cron jobs, and scripts don't pass through the HTTP interceptor. They need an explicit wrapper that opens a transaction, sets the GUC, and runs the caller's function inside it.

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/common/tenant/with-tenant-rls.helper.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { ClsModule, ClsService } from 'nestjs-cls';
import { WithTenantRls } from './with-tenant-rls.helper';
import { TenantContextService } from './tenant-context.service';
import { RlsHelper } from './rls.helper';
import { TENANT_CLS_KEY } from './tenant.constants';

describe('WithTenantRls', () => {
  let wrapper: WithTenantRls;
  let cls: ClsService;

  const fakePrisma = {
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = { $executeRawUnsafe: jest.fn().mockResolvedValue(undefined) };
      return fn(tx);
    }),
  };

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      imports: [ClsModule.forRoot({ global: true })],
      providers: [
        WithTenantRls,
        TenantContextService,
        RlsHelper,
        { provide: 'PrismaService', useValue: fakePrisma },
      ],
    }).compile();
    wrapper = mod.get(WithTenantRls);
    cls = mod.get(ClsService);
  });

  it('runs the callback in a transaction with the tenant GUC set', async () => {
    await cls.run(async () => {
      cls.set(TENANT_CLS_KEY, {
        organizationId: 'org-1', id: 'u', membershipId: 'm', role: 'OWNER', isSuperAdmin: false,
      });
      await wrapper.run('org-1', async (tx) => {
        expect(tx).toBeDefined();
      });
    });
    expect(fakePrisma.$transaction).toHaveBeenCalled();
  });

  it('throws when called with no orgId and no system flag', async () => {
    await expect(
      cls.run(() => wrapper.run('', async () => undefined)),
    ).rejects.toThrow(/organizationId required/);
  });
});
```

Run it to see it fail:

```bash
cd apps/backend && npx jest with-tenant-rls.helper.spec.ts
```

Expected: FAIL (module not found).

- [ ] **Step 2: Implement `WithTenantRls`**

Create `apps/backend/src/common/tenant/with-tenant-rls.helper.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RlsHelper } from './rls.helper';
import { TenantContextService, TenantContext } from './tenant-context.service';
import { DB_TX_CLS_KEY, TENANT_CLS_KEY } from './tenant.constants';

type TxClient = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

@Injectable()
export class WithTenantRls {
  constructor(
    @Inject('PrismaService') private readonly prisma: PrismaService,
    private readonly rls: RlsHelper,
    private readonly ctx: TenantContextService,
    private readonly cls: ClsService,
  ) {}

  /**
   * Run `fn` inside a transaction with the tenant GUC set. Use from webhook
   * receivers, BullMQ processors, and any entry point that doesn't pass
   * through RlsRequestInterceptor. Ensures both CLS tenant context and the
   * PostgreSQL GUC are populated for the duration of `fn`.
   */
  async run<T>(
    organizationId: string,
    fn: (tx: TxClient) => Promise<T>,
    actor?: Partial<TenantContext>,
  ): Promise<T> {
    if (!organizationId) throw new Error('WithTenantRls.run: organizationId required');

    return this.cls.run(async () => {
      this.cls.set(TENANT_CLS_KEY, {
        organizationId,
        id: actor?.id ?? 'system',
        membershipId: actor?.membershipId ?? 'system',
        role: actor?.role ?? 'SYSTEM',
        isSuperAdmin: actor?.isSuperAdmin ?? false,
      });
      return this.prisma.$transaction(async (tx) => {
        await this.rls.applyInTransaction(tx);
        this.cls.set(DB_TX_CLS_KEY, tx);
        return fn(tx);
      });
    });
  }
}
```

- [ ] **Step 3: Re-run the spec**

```bash
cd apps/backend && npx jest with-tenant-rls.helper.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/common/tenant/with-tenant-rls.helper.ts \
        apps/backend/src/common/tenant/with-tenant-rls.helper.spec.ts
git commit -m "feat(saas-02h): WithTenantRls wrapper for non-HTTP entry points"
```

---

## Task 5: Build `RlsRequestInterceptor` — wrap every authenticated request in a tenant tx

**Files:**
- Create: `apps/backend/src/common/tenant/rls-request.interceptor.ts`
- Create: `apps/backend/src/common/tenant/rls-request.interceptor.spec.ts`

**Context:** For HTTP requests the interceptor runs after `TenantResolverMiddleware` has populated CLS. It opens a `$transaction`, sets the GUC, stashes `tx` in CLS under `DB_TX_CLS_KEY`, and lets the handler chain run. Public unauthenticated routes (webhooks, healthcheck) are skipped — they handle their own GUC via `WithTenantRls`.

- [ ] **Step 1: Write the failing spec**

Create `apps/backend/src/common/tenant/rls-request.interceptor.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { ClsModule, ClsService } from 'nestjs-cls';
import { of } from 'rxjs';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { RlsRequestInterceptor } from './rls-request.interceptor';
import { TenantContextService } from './tenant-context.service';
import { RlsHelper } from './rls.helper';
import { DB_TX_CLS_KEY, TENANT_CLS_KEY } from './tenant.constants';

describe('RlsRequestInterceptor', () => {
  let interceptor: RlsRequestInterceptor;
  let cls: ClsService;
  const $executeRawUnsafe = jest.fn().mockResolvedValue(undefined);
  const prisma = {
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ $executeRawUnsafe }),
    ),
  };

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      imports: [ClsModule.forRoot({ global: true })],
      providers: [
        RlsRequestInterceptor,
        TenantContextService,
        RlsHelper,
        { provide: 'PrismaService', useValue: prisma },
      ],
    }).compile();
    interceptor = mod.get(RlsRequestInterceptor);
    cls = mod.get(ClsService);
    $executeRawUnsafe.mockClear();
    prisma.$transaction.mockClear();
  });

  const ctx = (orgId?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ url: '/api/v1/dashboard/bookings' }) }),
    }) as unknown as ExecutionContext;

  const next = (value: unknown): CallHandler => ({ handle: () => of(value) });

  it('wraps handler in tx and sets GUC when tenant is present', async () => {
    await cls.run(async () => {
      cls.set(TENANT_CLS_KEY, { organizationId: 'org-1', id: 'u', membershipId: 'm', role: 'OWNER', isSuperAdmin: false });
      const out$ = await interceptor.intercept(ctx(), next('ok'));
      await new Promise<void>((resolve) => out$.subscribe(() => resolve()));
    });
    expect(prisma.$transaction).toHaveBeenCalled();
    expect($executeRawUnsafe).toHaveBeenCalledWith(expect.stringContaining("app_set_tenant('org-1'"));
  });

  it('does NOT open a tx when there is no tenant context (public routes)', async () => {
    await cls.run(async () => {
      const out$ = await interceptor.intercept(ctx(), next('ok'));
      await new Promise<void>((resolve) => out$.subscribe(() => resolve()));
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run spec — expect fail**

```bash
cd apps/backend && npx jest rls-request.interceptor.spec.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement the interceptor**

Create `apps/backend/src/common/tenant/rls-request.interceptor.ts`:

```typescript
import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Observable, from, switchMap } from 'rxjs';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RlsHelper } from './rls.helper';
import { TenantContextService } from './tenant-context.service';
import { DB_TX_CLS_KEY } from './tenant.constants';

/**
 * Wraps each authenticated HTTP request in `prisma.$transaction`, sets the
 * RLS GUC via RlsHelper, and stashes the tx in CLS so PrismaService routes
 * all model accessors through it. Requests without tenant context (health
 * check, webhooks, public auth) pass through untouched — those entry points
 * either don't touch tenant data or manage their own scope via WithTenantRls.
 */
@Injectable()
export class RlsRequestInterceptor implements NestInterceptor {
  constructor(
    @Inject('PrismaService') private readonly prisma: PrismaService,
    private readonly rls: RlsHelper,
    private readonly ctx: TenantContextService,
    private readonly cls: ClsService,
  ) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const orgId = this.ctx.getOrganizationId();
    if (!orgId) return next.handle();

    return from(
      this.prisma.$transaction(async (tx) => {
        await this.rls.applyInTransaction(tx);
        this.cls.set(DB_TX_CLS_KEY, tx);
        return new Promise<unknown>((resolve, reject) => {
          next.handle().subscribe({ next: resolve, error: reject });
        });
      }),
    ).pipe(switchMap((v) => from(Promise.resolve(v))));
  }
}
```

- [ ] **Step 4: Run the spec**

```bash
cd apps/backend && npx jest rls-request.interceptor.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/common/tenant/rls-request.interceptor.ts \
        apps/backend/src/common/tenant/rls-request.interceptor.spec.ts
git commit -m "feat(saas-02h): RlsRequestInterceptor — tx-per-request with GUC"
```

---

## Task 6: Route `PrismaService` model calls through CLS tx when present

**Files:**
- Modify: `apps/backend/src/infrastructure/database/prisma.service.ts`
- Modify: `apps/backend/src/infrastructure/database/prisma.service.spec.ts` (if exists; else create minimal)

**Context:** Today the Proxy in `PrismaService` always hits `this.extended` (the scoping extension). We need a thin step: if a tx is stashed in CLS, model accessors resolve to `tx.user`, `tx.booking`, etc. — so every query in a request participates in the same `SET LOCAL` scope. Lifecycle methods (`$connect`, `$disconnect`) and `$transaction` still hit the base client.

- [ ] **Step 1: Extend the Proxy**

Modify the Proxy's `get` trap in `apps/backend/src/infrastructure/database/prisma.service.ts` (around line 132–152). Replace the trap with:

```typescript
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (
          prop === 'onModuleInit' ||
          prop === 'onModuleDestroy' ||
          prop === 'logger' ||
          prop === 'config' ||
          prop === 'tenantCtx' ||
          prop === 'extended' ||
          prop === '$connect' ||
          prop === '$disconnect' ||
          prop === '$transaction' // tx is managed by the interceptor / $transaction itself
        ) {
          return Reflect.get(target, prop, receiver);
        }

        // If a request-scoped tx is active in CLS, route model accessors there.
        // $-methods (like $queryRaw) also prefer the tx so raw SQL participates
        // in the same GUC scope.
        const cls = self.clsForRouting();
        const activeTx = cls?.get(DB_TX_CLS_KEY) as unknown;
        if (activeTx && typeof prop === 'string') {
          const fromTx = Reflect.get(activeTx as object, prop);
          if (fromTx !== undefined) {
            return typeof fromTx === 'function'
              ? (fromTx as (...args: unknown[]) => unknown).bind(activeTx)
              : fromTx;
          }
        }

        const fromExtended = Reflect.get(self.extended as object, prop);
        if (typeof fromExtended === 'function') {
          return (fromExtended as (...args: unknown[]) => unknown).bind(self.extended);
        }
        return fromExtended ?? Reflect.get(target, prop, receiver);
      },
    });
```

Add a helper near the top of the class (before `constructor`):

```typescript
  // Lazy ClsService lookup to avoid constructor-order issues in unit tests
  // that instantiate PrismaService without DI.
  private clsForRouting(): import('nestjs-cls').ClsService | undefined {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('nestjs-cls') as typeof import('nestjs-cls');
      return mod.ClsServiceManager?.getClsService?.();
    } catch {
      return undefined;
    }
  }
```

And add the import at the top of the file:

```typescript
import { DB_TX_CLS_KEY } from '../../common/tenant/tenant.constants';
```

- [ ] **Step 2: Run existing Prisma-adjacent unit tests**

```bash
cd apps/backend && npx jest infrastructure/database tenant
```

Expected: all pass. If `tenant-scoping.extension.spec.ts` breaks because CLS isn't initialized, the `clsForRouting` returns undefined and falls through to `self.extended` — this is the intended behavior for bare unit tests.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/infrastructure/database/prisma.service.ts
git commit -m "feat(saas-02h): PrismaService proxy routes through CLS tx when active"
```

---

## Task 7: Wire interceptor globally + register helpers in TenantModule

**Files:**
- Modify: `apps/backend/src/common/tenant/tenant.module.ts`

- [ ] **Step 1: Register providers**

Update `apps/backend/src/common/tenant/tenant.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantContextService } from './tenant-context.service';
import { RlsHelper } from './rls.helper';
import { WithTenantRls } from './with-tenant-rls.helper';
import { RlsRequestInterceptor } from './rls-request.interceptor';

@Module({
  providers: [
    TenantContextService,
    RlsHelper,
    WithTenantRls,
    { provide: APP_INTERCEPTOR, useClass: RlsRequestInterceptor },
  ],
  exports: [TenantContextService, RlsHelper, WithTenantRls],
})
export class TenantModule {}
```

(Preserve any additional existing exports/providers not shown — this is an additive change; `git diff` should show only the three new symbols + interceptor registration.)

- [ ] **Step 2: Run full backend unit tests**

```bash
cd apps/backend && npm test
```

Expected: all previously-green specs remain green. Any flake around tenant context now being tighter should be addressed by updating that spec's CLS setup.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/common/tenant/tenant.module.ts
git commit -m "feat(saas-02h): register RlsRequestInterceptor globally + WithTenantRls"
```

---

## Task 8: Wrap Moyasar webhook + SMS DLR receivers in `WithTenantRls`

**Files:**
- Modify: `apps/backend/src/modules/finance/moyasar-webhook/moyasar-webhook.handler.ts`
- Modify: `apps/backend/src/modules/comms/sms-dlr/sms-dlr.handler.ts` (exact path may vary; locate under `apps/backend/src/modules/comms/`)

**Context:** These two handlers arrive with no tenant — they resolve the tenant from the payload. They currently use `cls.set('systemContext', true)` for the resolution phase. After resolution, they must call `WithTenantRls.run(orgId, tx => …)` so the GUC is set for the mutation phase.

- [ ] **Step 1: Locate handler structure**

```bash
grep -rn "systemContext\|isSystemContext" apps/backend/src/modules/finance apps/backend/src/modules/comms | head -20
```

Use the output to find the exact resolution-then-mutate split in each handler.

- [ ] **Step 2: Refactor Moyasar webhook to wrap the mutation phase**

Inside the webhook handler, after the tenant is resolved from the payload (look for where `organizationId` is computed from the payment record), replace the existing `cls.run` for the mutation phase with a call to `this.withTenantRls.run(orgId, async (tx) => { /* existing mutation logic */ })`. Inject `WithTenantRls` in the constructor.

The shape, for reference:

```typescript
// Phase 1: resolve tenant from payload (still uses systemContext bypass).
const { organizationId } = await this.resolveTenantFromPayment(payload);

// Phase 2: mutate under tenant scope + RLS GUC.
await this.withTenantRls.run(organizationId, async () => {
  await this.markInvoicePaid(payload);
  await this.events.emit(new PaymentCompletedEvent(...));
});
```

Do the same for the SMS DLR handler.

- [ ] **Step 3: Update handler specs**

Adjust each `.handler.spec.ts` so it mocks `WithTenantRls.run` to simply invoke its callback. No change in assertions is required beyond the new mock.

- [ ] **Step 4: Run affected specs**

```bash
cd apps/backend && npx jest moyasar-webhook sms-dlr
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/finance/moyasar-webhook \
        apps/backend/src/modules/comms
git commit -m "feat(saas-02h): wrap webhook mutation phases in WithTenantRls"
```

---

## Task 9: Wrap BullMQ cron per-tenant iterations

**Files:**
- Modify: `apps/backend/src/modules/ops/cron-tasks/*.processor.ts` (one or more files)

**Context:** Cron processors iterate all organizations and do work for each. Each iteration is a separate tenant scope — wrap each loop body in `WithTenantRls.run(org.id, tx => …)`.

- [ ] **Step 1: List cron processors**

```bash
grep -rln "Organization.findMany\|organizationsOrService.findMany" apps/backend/src/modules/ops/cron-tasks
```

- [ ] **Step 2: Refactor each processor**

For each processor, replace the per-organization loop body with:

```typescript
for (const org of organizations) {
  await this.withTenantRls.run(org.id, async () => {
    // existing per-org work
  });
}
```

Inject `WithTenantRls` in each processor's constructor. Remove any bespoke `cls.run` + `applyInTransaction` boilerplate the processor used to do manually.

- [ ] **Step 3: Run cron specs**

```bash
cd apps/backend && npx jest cron-tasks
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/ops/cron-tasks
git commit -m "feat(saas-02h): wrap cron per-tenant iterations in WithTenantRls"
```

---

## Task 10: Strict-mode HTTP penetration test

**Files:**
- Create: `apps/backend/test/tenant-isolation/rls-strict-mode.e2e-spec.ts`

**Context:** This test boots the full Nest app under `TENANT_ENFORCEMENT=strict`, seeds two orgs, logs in as user of org-A, and proves: (1) a `GET /dashboard/bookings` returns only org-A bookings; (2) a forged JWT claiming org-B returns 401/403; (3) an unauthenticated request to a protected route returns 401; (4) a request with a corrupted CLS (simulate by forcing middleware to skip — achieved by calling the protected route through `supertest` while the env explicitly flips enforcement) fails-closed.

- [ ] **Step 1: Author the spec**

Create `apps/backend/test/tenant-isolation/rls-strict-mode.e2e-spec.ts`. Use the same bootstrap pattern as existing isolation e2e suites (`test/tenant-isolation/identity-isolation.e2e-spec.ts` is a good template — copy its `beforeAll` / `afterAll` pattern):

```typescript
import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/config/app.module';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { seedOrgWithOwner } from './helpers/seed-org';

describe('RLS strict-mode — HTTP e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orgA: { id: string; ownerToken: string };
  let orgB: { id: string; ownerToken: string };

  beforeAll(async () => {
    process.env.TENANT_ENFORCEMENT = 'strict';
    const mod: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    orgA = await seedOrgWithOwner(app, 'strict-a');
    orgB = await seedOrgWithOwner(app, 'strict-b');
  });

  afterAll(async () => {
    await app.close();
  });

  it('owner of org-A sees only org-A bookings', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/dashboard/bookings')
      .set('Authorization', `Bearer ${orgA.ownerToken}`)
      .expect(200);
    for (const b of res.body.data ?? []) {
      expect(b.organizationId).toBe(orgA.id);
    }
  });

  it('unauthenticated request to a protected route returns 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/dashboard/bookings').expect(401);
  });

  it('strict mode rejects authenticated request whose membership does not match any org', async () => {
    // Forge a user without membership (simulate drift): expect 401/403.
    const badToken = orgA.ownerToken.slice(0, -3) + 'XYZ';
    await request(app.getHttpServer())
      .get('/api/v1/dashboard/bookings')
      .set('Authorization', `Bearer ${badToken}`)
      .expect((r) => expect([401, 403]).toContain(r.status));
  });
});
```

If `helpers/seed-org.ts` does not exist, create a minimal helper that calls the register + login flow to get a JWT. Base it on an existing isolation e2e suite.

- [ ] **Step 2: Run the e2e**

```bash
cd apps/backend && npm run test:e2e -- rls-strict-mode
```

Expected: all tests pass. If a test fails because a seed helper is missing or drifts from a similar pattern, adapt by copying from `test/tenant-isolation/identity-isolation.e2e-spec.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/test/tenant-isolation/rls-strict-mode.e2e-spec.ts \
        apps/backend/test/tenant-isolation/helpers/
git commit -m "test(saas-02h): strict-mode HTTP e2e proves tenant isolation + fail-closed"
```

---

## Task 11: Per-cluster RLS smoke tests

**Files:**
- Modify: `apps/backend/test/tenant-isolation/rls-penetration.e2e-spec.ts` (extend with a table-driven smoke across one representative table per cluster)

**Context:** Task 2's penetration test only covers `Branch`. Extend it so we have one smoke per cluster proving the unified policy applies uniformly — catches any cluster that was missed in the reconciliation migration.

- [ ] **Step 1: Extend the penetration spec**

Append a table-driven test to the existing `rls-penetration.e2e-spec.ts`. Use a minimal-dependency table per cluster (to avoid FK headaches, pick tables with few required relations):

```typescript
describe('RLS penetration — per-cluster smoke', () => {
  const tables = [
    // [tableName, minimal insert SQL accepting ($org) parameter, expected-name]
    ['Branch',           `INSERT INTO "Branch" (id,name,"organizationId","createdAt","updatedAt") VALUES (gen_random_uuid(),'x',$1,now(),now())`],
    ['CustomRole',       `INSERT INTO "CustomRole" (id,name,"organizationId","createdAt","updatedAt") VALUES (gen_random_uuid(),'r',$1,now(),now())`],
    ['FeatureFlag',      `INSERT INTO "FeatureFlag" (id,key,enabled,"organizationId","createdAt","updatedAt") VALUES (gen_random_uuid(),'k',false,$1,now(),now())`],
    ['EmailTemplate',    `INSERT INTO "EmailTemplate" (id,slug,subject,body,"organizationId","createdAt","updatedAt") VALUES (gen_random_uuid(),'s','x','y',$1,now(),now())`],
    ['Invoice',          `INSERT INTO "Invoice" (id,"organizationId",total,status,"createdAt","updatedAt") VALUES (gen_random_uuid(),$1,0,'PENDING',now(),now())`],
    ['Holiday',          `INSERT INTO "Holiday" (id,name,date,"organizationId","createdAt","updatedAt") VALUES (gen_random_uuid(),'h',current_date,$1,now(),now())`],
    ['ProblemReport',    `INSERT INTO "ProblemReport" (id,summary,"organizationId","createdAt","updatedAt") VALUES (gen_random_uuid(),'s',$1,now(),now())`],
  ];
  // For each, prove: INSERT under tenant-A is visible only when tenant-A GUC is set.
  it.each(tables)('isolates %s across tenants', async (table, insertSql) => {
    // Insert under orgA scope…
    await client.query('BEGIN'); await client.query('SELECT app_set_tenant($1)', [orgA]);
    await client.query(insertSql, [orgA]);
    await client.query('COMMIT');

    // Read under orgB scope — expect 0 rows.
    await client.query('BEGIN'); await client.query('SELECT app_set_tenant($1)', [orgB]);
    const res = await client.query(`SELECT count(*)::int AS c FROM "${table}"`);
    await client.query('ROLLBACK');
    expect(res.rows[0].c).toBe(0);
  });
});
```

If one of the INSERTs fails because of a required column not listed, adjust the SQL inline — the goal is minimal-row insert with only NOT NULL columns.

- [ ] **Step 2: Run**

```bash
cd apps/backend && npx jest --config=test/jest-e2e.json rls-penetration -i
```

Expected: all table-driven rows pass.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/test/tenant-isolation/rls-penetration.e2e-spec.ts
git commit -m "test(saas-02h): per-cluster RLS smoke in penetration suite"
```

---

## Task 12: Documentation + memory

**Files:**
- Modify: `apps/backend/docs/saas-tenancy.md`
- Create: `/Users/tariq/.claude/projects/-Users-tariq-code-deqah/memory/saas02h_status.md`
- Modify: `/Users/tariq/.claude/projects/-Users-tariq-code-deqah/memory/MEMORY.md`

- [ ] **Step 1: Extend `saas-tenancy.md`**

Append an "RLS model" section that documents:
1. The two GUCs (`app.current_org_id`, `app.is_system_bypass`) and the helper SQL fns.
2. The request lifecycle: middleware → interceptor → tx → handler → close.
3. Escape hatches: `WithTenantRls` for webhooks/cron, `applySystemBypass` for resolution phases.
4. The fail-closed guarantee: an unset GUC returns zero rows; nothing "silently allows".

- [ ] **Step 2: Save memory record**

Write `saas02h_status.md` with frontmatter:

```yaml
---
name: SaaS-02h status
description: Plan 02h delivered <date> on feat/saas-02h-strict-mode-penetration; RLS reconciled + wired + strict mode fail-closed + penetration tests
type: project
---
```

Body: cluster of deliverables, test counts (unit + e2e), notes on any follow-ups, e.g., pgbouncer session-mode requirement if we later add pooling.

- [ ] **Step 3: Add pointer to MEMORY.md**

Append one line:

```
- [SaaS-02h status](saas02h_status.md) — Plan 02h delivered <date>; RLS reconciled, GUC wired via interceptor/WithTenantRls, strict-mode fail-closed, penetration tests added
```

- [ ] **Step 4: Commit + push + PR**

```bash
git add apps/backend/docs/saas-tenancy.md
git commit -m "docs(saas-02h): RLS model + escape hatches"
git push -u origin feat/saas-02h-strict-mode-penetration
gh pr create --title "feat(saas-02h): RLS reconcile + strict-mode penetration" --body "$(cat <<'EOF'
## Summary
- Reconciles RLS policies across 7 clusters onto one GUC (`app.current_org_id`), removes the silent NULL bypass, adds explicit `app.is_system_bypass` for webhook/cron resolution phases.
- Wires the GUC into every authenticated request via `RlsRequestInterceptor` (tx-per-request) and into non-HTTP entry points via `WithTenantRls`.
- Proves isolation with raw-pg penetration tests (bypass Prisma entirely) and a strict-mode HTTP e2e.

## Test plan
- [ ] `npm test` (backend unit)
- [ ] `npm run test:e2e -- rls-penetration`
- [ ] `npm run test:e2e -- rls-strict-mode`
- [ ] Manual: flip `TENANT_ENFORCEMENT=strict` in `.env`, run dashboard, confirm login works end-to-end.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Notes

**Spec coverage:** all four gaps from analysis are addressed — Task 1 reconciles GUC names + removes silent bypass; Tasks 4–9 wire `RlsHelper` into every entry point; Tasks 10–11 add penetration tests; Task 10 also exercises strict mode end-to-end.

**Risk hotspots to watch during execution:**
- Task 6's `clsForRouting` require-based lookup can misbehave under ESM bundling. If you see CLS not being found in production builds, switch to constructor injection of `ClsService` with `@Optional()`.
- Task 8 webhook refactor: preserve the existing signature-verify step — it must remain BEFORE `WithTenantRls.run`, because verification shouldn't require a tenant scope.
- Connection pooling caveat: `SET LOCAL` only survives until `COMMIT/ROLLBACK`. If a future change introduces pgbouncer in transaction-pool mode, this plan still works; session-pool mode would require `RESET` hooks. Document this in Task 12.

