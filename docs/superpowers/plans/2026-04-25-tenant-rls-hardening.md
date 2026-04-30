# Tenant RLS Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close two tenant-isolation gaps: (1) remove the unguarded `$allTenantsUnsafe` backdoor on `PrismaService`, and (2) harden every existing RLS policy with a single normalized GUC helper plus a `WITH CHECK` clause, so writes cannot create rows owned by another tenant.

**Architecture:** One new immutable Prisma migration drops + recreates every `tenant_isolation*` policy on the 52 scoped tables. All policies use `app_current_org_id()` (single source of truth, defined in `saas01_rls_scaffolding`) and add a `WITH CHECK` clause mirroring `USING`. The `RlsHelper` is simplified to set only `app.current_org_id` (the legacy `app.current_organization_id` GUC is fully retired). `$allTenantsUnsafe` is removed from `PrismaService` (grep confirmed zero call sites in `apps/backend/src`).

**Tech Stack:** NestJS 11, Prisma 7 (PostgreSQL + pgvector), nestjs-cls, Jest. Owner-only review tier (auth/tenant infra).

---

## File Structure

**Created:**
- `apps/backend/prisma/migrations/20260425120000_saas_rls_hardening/migration.sql` — DROP + CREATE every existing `tenant_isolation*` policy with normalized helper + `WITH CHECK`.
- `apps/backend/test/e2e/security/rls-with-check.e2e-spec.ts` — penetration test that an INSERT with a foreign `organizationId` is rejected by RLS even when the app extension is bypassed.

**Modified:**
- `apps/backend/src/infrastructure/database/prisma.service.ts` — remove `$allTenantsUnsafe` getter and its Proxy whitelist entry.
- `apps/backend/src/infrastructure/database/prisma.service.spec.ts` (or the closest existing spec) — add a test asserting `prisma.$allTenantsUnsafe` is `undefined` after the proxy.
- `apps/backend/src/common/tenant/rls.helper.ts` — drop the duplicate `SET LOCAL app.current_organization_id` statement; keep only `app.current_org_id`.
- `apps/backend/src/common/tenant/rls.helper.spec.ts` — update spies to assert exactly one `SET LOCAL` is issued.

**Untouched (immutable):**
- All previous migrations under `apps/backend/prisma/migrations/` — never edit existing migrations (CLAUDE.md golden rule).

---

### Task 1: Remove `$allTenantsUnsafe` backdoor

**Why:** Zero call sites in `apps/backend/src` (verified via `grep -rn "allTenantsUnsafe" apps/backend/src --include="*.ts"` returns only the definition in `prisma.service.ts`). Pure dead code that bypasses both the tenant-scoping extension and provides no audit trail. Safe-by-removal.

**Files:**
- Modify: `apps/backend/src/infrastructure/database/prisma.service.ts:158` (Proxy whitelist) and `:192-194` (getter).
- Test: `apps/backend/src/infrastructure/database/prisma.service.spec.ts` (or create one if missing).

- [ ] **Step 1: Confirm zero callers**

Run:
```bash
cd apps/backend && grep -rn "allTenantsUnsafe" src --include="*.ts" | grep -v "prisma.service.ts"
```
Expected: empty output. If any line is returned, **stop** and surface to the user — this plan assumes zero callers.

- [ ] **Step 2: Write the failing test**

Locate the existing `prisma.service` test file. If none exists at `apps/backend/src/infrastructure/database/prisma.service.spec.ts`, create it:

```ts
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from './prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

describe('PrismaService — $allTenantsUnsafe removed', () => {
  it('does not expose $allTenantsUnsafe', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PrismaService,
        { provide: ConfigService, useValue: { get: () => 'off' } },
        { provide: ClsService, useValue: { get: () => undefined } },
        { provide: TenantContextService, useValue: { getOrganizationId: () => undefined } },
      ],
    }).compile();
    const prisma = moduleRef.get(PrismaService);
    expect((prisma as unknown as Record<string, unknown>).$allTenantsUnsafe).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npx jest src/infrastructure/database/prisma.service.spec.ts -t "does not expose"`
Expected: FAIL — getter still returns `basePrisma`, so the value is defined.

- [ ] **Step 4: Remove the getter and its Proxy entry**

In `apps/backend/src/infrastructure/database/prisma.service.ts`:

Delete lines 192-194:
```ts
  get $allTenantsUnsafe(): PrismaClient {
    return this.basePrisma;
  }
```

Delete line 158 from the Proxy whitelist:
```ts
          prop === '$allTenantsUnsafe' ||
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npx jest src/infrastructure/database/prisma.service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Run the full backend unit suite to confirm nothing else regressed**

Run: `cd apps/backend && npm run test`
Expected: all tests green (1171+ unit tests as of 2026-04-22).

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/infrastructure/database/prisma.service.ts apps/backend/src/infrastructure/database/prisma.service.spec.ts
git commit -m "refactor(backend): remove unguarded \$allTenantsUnsafe backdoor

Zero call sites; \$allTenants (CLS-guarded) is the supported super-admin path."
```

---

### Task 2: Normalize `RlsHelper` on a single GUC

**Why:** `RlsHelper` currently sets two GUCs (`app.current_org_id` *and* `app.current_organization_id`) because 02a–02c policies read the first while 02e–02g policies read the second. The plan normalizes everything onto `app_current_org_id()` (defined in `saas01_rls_scaffolding`), so the second GUC is no longer needed. Removing the duplicate `SET LOCAL` happens **in this task** but the policy migration that lets us remove it lands in Task 3 — so we sequence the two commits carefully and keep `app.current_organization_id` set in a temporary compat block until Task 3's migration is applied.

**Files:**
- Modify: `apps/backend/src/common/tenant/rls.helper.ts:33-34`
- Test: `apps/backend/src/common/tenant/rls.helper.spec.ts`

- [ ] **Step 1: Update the failing test first**

Open `apps/backend/src/common/tenant/rls.helper.spec.ts` and locate the test that asserts both GUCs are set. Replace its assertion block with:

```ts
it('sets only app.current_org_id', async () => {
  const ctx = { getOrganizationId: () => 'org-1' } as unknown as TenantContextService;
  const helper = new RlsHelper({} as PrismaService, ctx);
  const calls: string[] = [];
  await helper.applyInTransaction({
    $executeRawUnsafe: async (sql: string) => {
      calls.push(sql);
    },
  });
  expect(calls).toEqual([`SET LOCAL app.current_org_id = 'org-1'`]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && npx jest src/common/tenant/rls.helper.spec.ts -t "sets only"`
Expected: FAIL — currently two `SET LOCAL` statements are issued.

- [ ] **Step 3: Update `rls.helper.ts`**

Replace lines 28-35 of `apps/backend/src/common/tenant/rls.helper.ts` with:

```ts
    // SET LOCAL applies only to the current transaction. Quote the literal
    // to prevent injection — orgId is trusted (from JWT) but we defend anyway.
    // All policies read `app_current_org_id()` (defined in saas01_rls_scaffolding),
    // which is backed by `app.current_org_id`. The legacy `app.current_organization_id`
    // GUC was retired in saas_rls_hardening (2026-04-25).
    const safe = orgId.replace(/'/g, "''");
    await tx.$executeRawUnsafe(`SET LOCAL app.current_org_id = '${safe}'`);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && npx jest src/common/tenant/rls.helper.spec.ts`
Expected: PASS.

- [ ] **Step 5: Sequencing note — do NOT commit yet**

This change must land **after** the migration in Task 3 is applied, otherwise 02e–02g policies (which still read `app.current_organization_id` directly) will return zero rows for everyone in dev. Hold the commit until Task 3 Step 5 is green.

---

### Task 3: New migration — drop + recreate every `tenant_isolation*` policy with `WITH CHECK` and unified helper

**Why:** Three defects across the existing policies:
1. **Two GUC names in flight.** 02a/02b/02c use `app_current_org_id()` (which reads `app.current_org_id`); 02e/02f/02g/02g-sms read `current_setting('app.current_organization_id', true)` directly. Single source of truth is safer.
2. **No `WITH CHECK` clause anywhere.** Postgres RLS without `WITH CHECK` only filters reads; INSERT/UPDATE can write rows owned by another tenant if any code path bypasses the app-level extension.
3. **`OR app_current_org_id() IS NULL` bypass in 02a/02b/02c.** When no GUC is set the policy makes ALL rows visible. Today this is reachable by any code path that runs outside `cls.run()` + `RlsHelper.applyInTransaction()`. We KEEP this bypass for now (super-admin/cron paths depend on it) but will revisit in a follow-up plan that uses a Postgres role with `BYPASSRLS` instead — flagged in the plan footer. **In-scope here:** keep the bypass shape but apply it consistently across ALL 52 scoped tables (including 02e–02g which currently lack it), and add `WITH CHECK` so writes cannot escape.

**Files:**
- Create: `apps/backend/prisma/migrations/20260425120000_saas_rls_hardening/migration.sql`

- [ ] **Step 1: Inventory the policies to replace**

Run:
```bash
cd apps/backend && grep -rE "CREATE POLICY|tenant_isolation" prisma/migrations/*/migration.sql | grep -v "saas_02h" | grep -v "saas01_rls_scaffolding"
```

Expected output: every `CREATE POLICY tenant_isolation*` statement across 02a, 02b, 02c, 02d, 02e, 02f, 02g, 02g-sms. Capture the exact policy names + table names — they become the DROP list in Step 2. (The 02h migration only adds the `deqah_rls_probe` role; it creates no policies.)

If the count of distinct (table, policy) pairs is not 52, **stop** and reconcile against `SCOPED_MODELS` in `apps/backend/src/infrastructure/database/prisma.service.ts:22-92` before continuing.

- [ ] **Step 2: Write the migration file**

Create `apps/backend/prisma/migrations/20260425120000_saas_rls_hardening/migration.sql` with the structure below. Substitute the full table list from Step 1's inventory in place of `<TABLE>` — every scoped table gets the same three statements (DROP, CREATE USING, CREATE WITH CHECK is folded into one CREATE):

```sql
-- saas-rls-hardening: normalize all tenant_isolation policies onto app_current_org_id()
-- and add WITH CHECK so writes cannot create cross-tenant rows.
-- Issued: 2026-04-25. Owner-only review tier (CLAUDE.md security tier).

-- ---- identity (02a) -------------------------------------------------------
DROP POLICY IF EXISTS tenant_isolation_refresh_token  ON "RefreshToken";
DROP POLICY IF EXISTS tenant_isolation_custom_role    ON "CustomRole";
DROP POLICY IF EXISTS tenant_isolation_permission     ON "Permission";

CREATE POLICY tenant_isolation_refresh_token ON "RefreshToken"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);
CREATE POLICY tenant_isolation_custom_role ON "CustomRole"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);
CREATE POLICY tenant_isolation_permission ON "Permission"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

-- ---- people (02b) ---------------------------------------------------------
-- Repeat the DROP IF EXISTS + CREATE POLICY ... USING ... WITH CHECK ... pattern for:
--   Client, ClientRefreshToken, PasswordHistory, Employee, EmployeeBranch,
--   EmployeeService, EmployeeAvailability, EmployeeAvailabilityException
-- Use the policy names from the 02b migration (tenant_isolation_client, etc.).

-- ---- org-config + org-experience (02c) ------------------------------------
-- Tables: Branch, Department, ServiceCategory, Service, ServiceBookingConfig,
-- ServiceDurationOption, EmployeeServiceOption, BusinessHour, Holiday,
-- BrandingConfig, IntakeForm, IntakeField, Rating, OrganizationSettings.
-- Use the policy names from the 02c migration.

-- ---- bookings (02d) -------------------------------------------------------
-- Tables: Booking, BookingStatusLog, WaitlistEntry, GroupSession,
-- GroupEnrollment, GroupSessionWaitlist, BookingSettings.

-- ---- finance (02e) — currently uses `current_setting(...)` directly -------
-- Tables: Invoice, Payment, Coupon, CouponRedemption, RefundRequest,
-- ZatcaSubmission, ZatcaConfig.
-- IMPORTANT: drop policies named "tenant_isolation" (02e used the bare name, not the suffixed form).
DROP POLICY IF EXISTS "tenant_isolation" ON "Invoice";
DROP POLICY IF EXISTS "tenant_isolation" ON "Payment";
DROP POLICY IF EXISTS "tenant_isolation" ON "Coupon";
DROP POLICY IF EXISTS "tenant_isolation" ON "CouponRedemption";
DROP POLICY IF EXISTS "tenant_isolation" ON "RefundRequest";
DROP POLICY IF EXISTS "tenant_isolation" ON "ZatcaSubmission";
DROP POLICY IF EXISTS "tenant_isolation" ON "ZatcaConfig";
CREATE POLICY tenant_isolation_invoice ON "Invoice"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);
-- ... repeat for Payment, Coupon, CouponRedemption, RefundRequest, ZatcaSubmission, ZatcaConfig

-- ---- comms + ai (02f) ----------------------------------------------------
-- Tables: EmailTemplate, Notification, ChatConversation, CommsChatMessage,
-- ChatSession, ChatMessage, ContactMessage, ChatbotConfig, FcmToken.
-- Same DROP + CREATE USING + WITH CHECK pattern.

-- ---- AI/media/ops/platform/content (02g) — uses bare "tenant_isolation" name
DROP POLICY IF EXISTS "tenant_isolation" ON "KnowledgeDocument";
DROP POLICY IF EXISTS "tenant_isolation" ON "DocumentChunk";
DROP POLICY IF EXISTS "tenant_isolation" ON "File";
DROP POLICY IF EXISTS "tenant_isolation" ON "ActivityLog";
DROP POLICY IF EXISTS "tenant_isolation" ON "Report";
DROP POLICY IF EXISTS "tenant_isolation" ON "ProblemReport";
DROP POLICY IF EXISTS "tenant_isolation" ON "Integration";
DROP POLICY IF EXISTS "tenant_isolation" ON "FeatureFlag";
DROP POLICY IF EXISTS "tenant_isolation" ON "SiteSetting";
CREATE POLICY tenant_isolation_knowledge_document ON "KnowledgeDocument"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);
-- ... repeat for the remaining eight 02g tables.

-- ---- 02g-sms -------------------------------------------------------------
-- Tables: OrganizationSmsConfig, SmsDelivery.

-- ---- 04 billing ----------------------------------------------------------
-- Tables: Subscription, UsageRecord, Membership.
-- (Plan and SubscriptionInvoice are platform-level — NOT scoped, do not include.)
```

**Important:** the snippet above is a template. Step 1 produced the authoritative inventory — fill in every (table, policy) pair from that list. Do **not** ship a partial migration. The Self-Review at the end of this plan will catch missing entries.

- [ ] **Step 3: Apply the migration locally**

Run:
```bash
cd apps/backend && npm run prisma:migrate
```
Expected: migration `20260425120000_saas_rls_hardening` reports applied; no errors.

- [ ] **Step 4: Verify policies via psql**

Run:
```bash
docker exec -i deqah-postgres psql -U deqah -d deqah -c \
  "SELECT tablename, policyname, qual, with_check FROM pg_policies WHERE policyname LIKE 'tenant_isolation%' ORDER BY tablename, policyname;"
```
Expected: every row has identical `qual` and `with_check` columns of the form `(("organizationId")::uuid = app_current_org_id()) OR (app_current_org_id() IS NULL)`. If any row has `with_check = NULL`, the migration missed that table — fix and re-run.

- [ ] **Step 5: Now commit Task 2's `RlsHelper` change**

The 02e–02g policies now read `app_current_org_id()` (no longer `app.current_organization_id`), so dropping the second `SET LOCAL` is safe.

```bash
git add apps/backend/src/common/tenant/rls.helper.ts apps/backend/src/common/tenant/rls.helper.spec.ts apps/backend/prisma/migrations/20260425120000_saas_rls_hardening/migration.sql
git commit -m "feat(backend): unify tenant RLS policies on app_current_org_id() + WITH CHECK

- New migration drops + recreates every tenant_isolation* policy with a
  WITH CHECK clause mirroring USING, blocking cross-tenant writes even
  when the app extension is bypassed.
- All 52 policies now read the app_current_org_id() helper; the legacy
  app.current_organization_id GUC is retired and RlsHelper sets only one
  GUC."
```

---

### Task 4: E2E penetration test — `WITH CHECK` blocks cross-tenant writes

**Why:** The new `WITH CHECK` clause is the load-bearing improvement. We need a regression test that proves it works even if a future contributor accidentally uses `$queryRawUnsafe` or `$executeRawUnsafe` (which bypass the Prisma extension's tenant-scoping). This complements the existing penetration suite at `apps/backend/test/e2e/security/`.

**Files:**
- Create: `apps/backend/test/e2e/security/rls-with-check.e2e-spec.ts`

- [ ] **Step 1: Inspect an existing penetration spec to mirror its bootstrap**

Read `apps/backend/test/e2e/security/strict-mode.e2e-spec.ts` (or whichever spec the 02h plan delivered). Note how it:
- bootstraps a Nest app,
- seeds two organizations,
- runs `cls.run()` with `organizationId` set, and
- uses `RlsHelper.applyInTransaction(tx)` inside a `prisma.$transaction`.

Match that structure in the new test.

- [ ] **Step 2: Write the failing test**

Create `apps/backend/test/e2e/security/rls-with-check.e2e-spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { AppModule } from '../../../src/config/app.module';
import { PrismaService } from '../../../src/infrastructure/database/prisma.service';
import { RlsHelper } from '../../../src/common/tenant/rls.helper';
import { TenantContextService } from '../../../src/common/tenant/tenant-context.service';

describe('RLS WITH CHECK — cross-tenant writes blocked', () => {
  let app: TestingModule;
  let prisma: PrismaService;
  let cls: ClsService;
  let rls: RlsHelper;
  let ctx: TenantContextService;

  const ORG_A = '00000000-0000-0000-0000-00000000aaaa';
  const ORG_B = '00000000-0000-0000-0000-00000000bbbb';

  beforeAll(async () => {
    app = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = app.get(PrismaService);
    cls = app.get(ClsService);
    rls = app.get(RlsHelper);
    ctx = app.get(TenantContextService);

    // Seed two orgs (use the bare basePrisma path — these test fixtures run
    // as superuser/migration role so RLS does not block setup).
    await prisma.$executeRawUnsafe(`INSERT INTO "Organization" (id, name, "createdAt", "updatedAt") VALUES ('${ORG_A}', 'A', NOW(), NOW()) ON CONFLICT DO NOTHING`);
    await prisma.$executeRawUnsafe(`INSERT INTO "Organization" (id, name, "createdAt", "updatedAt") VALUES ('${ORG_B}', 'B', NOW(), NOW()) ON CONFLICT DO NOTHING`);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an INSERT whose organizationId belongs to a different tenant', async () => {
    await expect(
      cls.runWith({}, async () => {
        ctx.setOrganizationId(ORG_A);
        await prisma.$transaction(async (tx) => {
          await rls.applyInTransaction(tx);
          // Try to insert a Branch into ORG_B while context says ORG_A.
          // The app extension is bypassed by $executeRawUnsafe; only RLS
          // WITH CHECK can stop this.
          await tx.$executeRawUnsafe(
            `INSERT INTO "Branch" (id, name, "organizationId", "createdAt", "updatedAt") VALUES (gen_random_uuid(), 'evil', '${ORG_B}', NOW(), NOW())`,
          );
        });
      }),
    ).rejects.toThrow(/row violates row-level security/i);
  });

  it('allows an INSERT whose organizationId matches the current tenant', async () => {
    await cls.runWith({}, async () => {
      ctx.setOrganizationId(ORG_A);
      await prisma.$transaction(async (tx) => {
        await rls.applyInTransaction(tx);
        await tx.$executeRawUnsafe(
          `INSERT INTO "Branch" (id, name, "organizationId", "createdAt", "updatedAt") VALUES (gen_random_uuid(), 'good', '${ORG_A}', NOW(), NOW())`,
        );
      });
    });
  });
});
```

If `cls.runWith` / `ctx.setOrganizationId` differ in your version of the codebase, mirror the exact API used by the existing 02h penetration spec from Step 1.

- [ ] **Step 3: Run the test to verify the negative case fails (write rejected)**

Run: `cd apps/backend && npm run test:e2e -- rls-with-check`
Expected: BOTH tests pass — the first because RLS rejects the foreign-org INSERT, the second because the same-org INSERT succeeds.

If the first test passes only because of some other error (e.g. FK violation, nullable column), inspect the thrown error and tighten the matcher. The error message must contain `row violates row-level security`.

- [ ] **Step 4: Run the full E2E security suite**

Run: `cd apps/backend && npm run test:e2e -- security`
Expected: all penetration specs (strict-mode, IDOR, FK injection, raw query backstop, webhook forgery, this new one) green.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/test/e2e/security/rls-with-check.e2e-spec.ts
git commit -m "test(backend): add RLS WITH CHECK penetration spec

Proves cross-tenant writes are rejected at the database level even when
the Prisma tenant-scoping extension is bypassed via raw SQL."
```

---

### Task 5: Final verification + PR

- [ ] **Step 1: Full unit + e2e**

Run:
```bash
cd apps/backend && npm run test && npm run test:e2e
```
Expected: green across the board. Backend baseline as of 2026-04-22 is 1171 unit + the existing security e2e suite.

- [ ] **Step 2: Open PR**

```bash
git push -u origin <branch>
gh pr create --title "Tenant RLS hardening: drop \$allTenantsUnsafe + WITH CHECK on every policy" --body "$(cat <<'EOF'
## Summary
- Removes the unguarded `$allTenantsUnsafe` getter from `PrismaService` (zero call sites in `apps/backend/src` confirmed before deletion).
- New migration `20260425120000_saas_rls_hardening` drops + recreates every `tenant_isolation*` policy with a `WITH CHECK` clause mirroring `USING`, blocking cross-tenant writes even when the Prisma extension is bypassed.
- Normalizes every policy onto `app_current_org_id()` (single source of truth defined in `saas01_rls_scaffolding`); retires the duplicate `app.current_organization_id` GUC and simplifies `RlsHelper` to set only `app.current_org_id`.

## Test plan
- [ ] `npm run test` — backend unit suite passes
- [ ] `npm run test:e2e -- security` — full penetration suite green, including the new `rls-with-check` spec
- [ ] Manual verification via `pg_policies`: every scoped table has `with_check` set (Task 3 Step 4)

## Out of scope (deliberate)
The `OR app_current_org_id() IS NULL` bypass clause is preserved for super-admin / cron contexts. A follow-up plan will replace it with a Postgres role carrying `BYPASSRLS` so that "no GUC set" no longer means "see all rows".

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Out of Scope (follow-up plan)

- Replacing the `OR app_current_org_id() IS NULL` bypass clause with a dedicated `deqah_super_admin` Postgres role that carries `BYPASSRLS`. Today, any code path that runs outside `cls.run()` + `RlsHelper.applyInTransaction()` sees every tenant's rows; the only mitigation is the app-level extension. This is a separate design decision (which super-admin paths actually need to see across tenants? do they all go through `$allTenants`?) and deserves its own brainstorming pass before code lands.
- Adding ESLint rules to forbid `$allTenants` outside `apps/backend/src/modules/platform/admin/` and `apps/backend/src/cron/`. Worth doing once the super-admin path is locked in.
