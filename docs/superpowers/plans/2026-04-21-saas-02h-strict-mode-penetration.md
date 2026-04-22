# Strict Mode + Cross-Tenant Penetration Tests — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **⚠️ OWNER-GATED — promoted 2026-04-22.** Flipping `TENANT_ENFORCEMENT=strict` has a potential blast radius equal to a payments outage (any un-scoped code path in a critical flow becomes a 500). Before execution, owner MUST approve the canary-first rollout plan (Task 0 added 2026-04-22):
>
> 1. **Canary mode**: `TENANT_ENFORCEMENT=canary` flag ships BEFORE strict — logs violations to Sentry + Prometheus counter `tenant_enforcement_violations_total{module,handler}`, never throws. Bake for 48h on staging + 1 week on prod with a single canary tenant.
> 2. **Per-module rollback**: add `TENANT_ENFORCEMENT_STRICT_MODULES` allowlist env. Strict throws ONLY for listed modules. Start with one cluster (e.g. `identity`), widen cluster-by-cluster, revert individual modules without redeploying.
> 3. **Zero-violation gate**: promotion from canary→strict blocked until `violations_total == 0` for 24h across all clusters.
> 4. **Rollback SLA**: `TENANT_ENFORCEMENT=permissive` env override returns to 02a behavior in < 30 seconds (no code revert, just env flip + pod restart).
> 5. **Alerting**: Sentry alert on any violation event during canary; PagerDuty on any strict-mode throw during rollout window.
>
> Owner signs off with `/approve saas-02h` in PR body. No other task runs until approval.

**Goal:** Close out the SaaS-02 rollout by flipping `TENANT_ENFORCEMENT` from `permissive` (the 02a default) to `strict` as the platform default, and adding an adversarial cross-tenant penetration e2e suite that exercises every known attack vector: direct id probe, IDOR in update/delete, foreign-key injection, coupon code collision (must succeed per 02e design), Moyasar webhook with forged metadata, raw-SQL `$queryRaw` reads bypass, and Postgres RLS backstop. No new schema changes.

**Architecture:** No data model changes. Two code changes:

1. **`TENANT_ENFORCEMENT=strict` becomes the default.** Any `TenantContextService.requireOrganizationId()` call from a scoped code path without a CLS org throws immediately (no fallback to DEFAULT_ORG). The `OrDefault` variant still works — handlers that are legitimately system-level (seed scripts, cron bootstrap) keep using it. Every other handler now fails closed if CLS is unset.
2. **`CrossTenantPenetrationSuite` runs in CI.** A new adversarial e2e suite under `test/e2e/security/` plus a Jest project split so CI treats it as a required gate. The suite seeds two orgs, plays attacker-vs-defender scenarios, and asserts cross-tenant invisibility under the strict default.

**Tech Stack:** NestJS 11, Prisma 7, nestjs-cls, PostgreSQL RLS, Jest + Supertest, `.github/workflows/ci.yml`.

**Prerequisites:** 02a–02g must all be merged to `main`. SCOPED_MODELS contains all 52 models from those plans. Strict mode cannot ship if any cluster still has unsanctioned CLS-less code paths — the suite will fail loudly.

---

## Critical lessons from prior plans — READ BEFORE STARTING

1. **Strict mode reveals missed callsites.** Any handler whose tests passed under permissive but relied on DEFAULT_ORG fallback will now throw. Treat every new failure as a callsite that was missed in 02a–02g and fix the handler (not the test).
2. **`$transaction` callback form bypasses the Proxy.** Strict mode does NOT prevent `tx.*.create()` without an explicit `organizationId` — the CLS-required check lives in `requireOrganizationId()` which callers are supposed to invoke once at the top of `execute()`. Penetration tests include a direct probe of this.
3. **`$queryRaw` is not scoped.** 02g ensured `semantic-search` includes the predicate; 02h's penetration suite re-verifies by attempting a direct `$queryRaw` read from a hostile context.
4. **RLS tests need a non-superuser Postgres role** (02b lesson 5). The Postgres superuser bypasses RLS even with `FORCE ROW LEVEL SECURITY` — the RLS backstop tests must connect (or `SET ROLE`) to a non-superuser. CI needs a dedicated `carekit_rls_probe` role created during DB setup.
5. **Divergence-before-commit.** Any penetration test failure that surfaces a real vulnerability — STOP, document the finding in `docs/superpowers/incidents/`, fix the handler, and re-run before committing.
6. **System-context bypass (02e).** The Moyasar webhook legitimately uses `systemContext=true` to read Payment/Invoice without CLS. Penetration tests MUST verify this bypass is ONLY usable from the webhook entry, not from an authenticated request path.

---

## SCOPED_MODELS after this plan

```ts
// No new models. Total = 52 (unchanged from 02g):
//   3  identity   (02a)
//   7  people     (02b)
//  14  org-config (02c)
//   7  bookings   (02d)
//   7  finance    (02e)
//   8  comms      (02f)
//   9  infra      (02g)
```

---

## File Structure

**Code (modify):**
- `apps/backend/.env.example` — `TENANT_ENFORCEMENT=strict` (was `permissive`).
- `apps/backend/src/common/tenant/tenant-context.service.ts` — default fallback behaviour when the env var is unset (assume `strict`).
- `apps/backend/src/common/tenant/tenant.module.ts` — log a warning at bootstrap if `permissive` or `off` is set outside of `NODE_ENV=development`.
- `docker-compose.yml` / `docker/backend.Dockerfile` — inherit `TENANT_ENFORCEMENT` from env (no hardcoded override).
- `.github/workflows/ci.yml` — add the `strict` env var explicitly + add a `test:security` job gating merges.
- `apps/backend/package.json` — add `test:security` script mapped to the new e2e Jest project.
- `apps/backend/test/jest-security.json` — new Jest project config targeting `test/e2e/security/`.

**Database (modify):**
- `apps/backend/prisma/migrations/<timestamp>_saas_02h_rls_probe_role/migration.sql` — creates `carekit_rls_probe` role with `SELECT` on all tenant-scoped tables (for RLS backstop tests). NO schema changes. Pgvector-safe (no `migrate dev`).

**Tests (create):**
- `apps/backend/test/e2e/security/cross-tenant-penetration.e2e-spec.ts` — the headline adversarial suite.
- `apps/backend/test/e2e/security/rls-backstop.e2e-spec.ts` — raw SQL probes under the non-superuser role.
- `apps/backend/test/e2e/security/strict-mode-enforcement.e2e-spec.ts` — verifies CLS-less callers fail closed.
- `apps/backend/test/e2e/security/moyasar-webhook-forgery.e2e-spec.ts` — attempts to abuse the system-context bypass.
- `apps/backend/test/e2e/security/README.md` — documents suite structure + how to run locally.

**Memory (create):**
- `/Users/tariq/.claude/projects/-Users-tariq-code-carekit/memory/saas02h_status.md`

**Transformation index (modify):**
- `docs/superpowers/plans/2026-04-21-saas-transformation-index.md` — mark 02h done, close out Phase 02, show Phase 03 as next.

**Docs (modify):**
- `docs/saas-tenancy.md` — update "current default" to strict, add a section on the penetration suite.
- `apps/backend/CLAUDE.md` — remove "transitional — default `off`" note; replace with "default strict".

---

## Task 1: Pre-flight — baseline regression

- [ ] **Step 1.1: Confirm 02a–02g are merged**

```bash
cd /Users/tariq/code/carekit
git log --oneline --all | grep -E "saas-02[a-g]" | head -30
```

Expected: commits for 02a, 02b, 02c, 02d, 02e, 02f, 02g all present on `main`.

- [ ] **Step 1.2: Run full regression under current (permissive) mode to establish baseline**

```bash
cd apps/backend
TENANT_ENFORCEMENT=permissive npm run test
TENANT_ENFORCEMENT=permissive npm run test:e2e
```

Expected: all green. Record counts in `docs/superpowers/qa/saas-02h-baseline-2026-04-21.md`.

- [ ] **Step 1.3: Run a dry-run under strict mode — expect failures, catalogue them**

```bash
cd apps/backend
TENANT_ENFORCEMENT=strict npm run test 2> /tmp/02h-strict-unit.log || true
TENANT_ENFORCEMENT=strict npm run test:e2e 2> /tmp/02h-strict-e2e.log || true
```

Every failure is a callsite that was missed somewhere in 02a–02g. Copy the error lines into `docs/superpowers/qa/saas-02h-strict-failures-2026-04-21.md` — each entry needs the file + the line number where `requireOrganizationId` threw.

If the failure list is non-empty, **STOP**. Fix each failure in its originating handler:
- If the handler is authentic-user-only → inject `TenantContextService` + use `requireOrganizationId()`.
- If the handler is legitimately system-level (seed, cron bootstrap, health probe) → use `requireOrganizationIdOrDefault()` + add an inline comment justifying it.
- Commit each fix with a conventional commit message referencing the originating 02x plan (e.g. `fix(saas-02d): strict-mode audit found expire-booking cron missing CLS wrapper`).

Re-run step 1.3 until the strict-mode dry-run is green BEFORE moving to Task 2.

- [ ] **Step 1.4: Commit the baseline notes**

```bash
git add docs/superpowers/qa/saas-02h-baseline-2026-04-21.md \
        docs/superpowers/qa/saas-02h-strict-failures-2026-04-21.md
git commit -m "docs(saas-02h): strict-mode pre-flight audit + baseline regression"
```

---

## Task 2: Flip `TENANT_ENFORCEMENT=strict` default

- [ ] **Step 2.1: Update `.env.example`**

Edit `apps/backend/.env.example`:

```diff
- TENANT_ENFORCEMENT=permissive
+ TENANT_ENFORCEMENT=strict
```

Add a comment block above the line:

```
# Tenant isolation enforcement level.
#   strict     — default for production. Any scoped query without CLS org throws.
#   permissive — fallback to DEFAULT_ORGANIZATION_ID. Used during 02a–02g rollout.
#   off        — no enforcement. Legacy single-tenant mode. DO NOT use in multi-tenant prod.
```

- [ ] **Step 2.2: Update `tenant-context.service.ts` default**

Locate the config read:

```bash
grep -n "TENANT_ENFORCEMENT" apps/backend/src/common/tenant/
```

Change the default from `'permissive'` to `'strict'`:

```ts
const mode = this.config.get<TenantEnforcementMode>('TENANT_ENFORCEMENT') ?? 'strict';
```

Record the semantic:

- `strict`  → `requireOrganizationId()` throws on missing CLS org; `requireOrganizationIdOrDefault()` still falls back.
- `permissive` → both variants fall back to DEFAULT_ORG.
- `off` → both variants fall back to DEFAULT_ORG AND the Prisma extension does NOT inject `where.organizationId` at all (single-tenant legacy).

- [ ] **Step 2.3: Bootstrap warning**

In `tenant.module.ts` `onApplicationBootstrap`:

```ts
if (mode !== 'strict' && process.env.NODE_ENV === 'production') {
  this.logger.error(
    `TENANT_ENFORCEMENT=${mode} is set in production — this is a security risk. Set to 'strict'.`,
  );
}
if (mode !== 'strict' && process.env.NODE_ENV !== 'development') {
  this.logger.warn(
    `TENANT_ENFORCEMENT=${mode} — only 'strict' is supported outside development.`,
  );
}
```

- [ ] **Step 2.4: Docker / Compose inheritance**

Verify `docker-compose.yml` passes `TENANT_ENFORCEMENT` through from the host env (no hardcoded override):

```bash
grep -n "TENANT_ENFORCEMENT" docker/docker-compose.yml apps/backend/docker/ 2>/dev/null || true
```

If any file hardcodes `permissive` or `off`, remove the override so the app defaults to `strict`.

- [ ] **Step 2.5: CI workflow update**

Edit `.github/workflows/ci.yml`:

```yaml
env:
  TENANT_ENFORCEMENT: strict
```

Add the `test:security` job definition below the existing `test:e2e` job (implementation follows in Task 6). For now, just set the env.

- [ ] **Step 2.6: Documentation**

Update `docs/saas-tenancy.md`:

```markdown
## Current default: strict (as of 02h)

As of <date>, `TENANT_ENFORCEMENT=strict` is the platform default. Any handler that
queries a scoped model without CLS tenant context throws `UnauthorizedException`.
See `test/e2e/security/strict-mode-enforcement.e2e-spec.ts` for the contract.

The `permissive` and `off` modes are retained for local development and
migration bootstrap only — they must never be set in production.
```

Update `apps/backend/CLAUDE.md`:

```diff
- **Multi-tenancy (transitional).** The backend is migrating to multi-tenant SaaS.
-   As of Plan 01, `Organization` + `Membership` exist and `TenantContextService`
-   carries tenant identity through CLS. The `TENANT_ENFORCEMENT` env flag defaults
-   to `off` — single-tenant behavior is unchanged at runtime.
+ **Multi-tenancy (default).** The backend runs in multi-tenant mode by default.
+   `TENANT_ENFORCEMENT=strict` is the platform default (since 02h). Every
+   scoped-model query must have CLS tenant context or it throws closed.
+   See [docs/saas-tenancy.md](./docs/saas-tenancy.md) + the
+   `test/e2e/security/` suite before adding new queries.
```

- [ ] **Step 2.7: Re-run full regression under the new default**

```bash
cd apps/backend && npm run test
cd apps/backend && npm run test:e2e
```

Expected: all green without any explicit `TENANT_ENFORCEMENT` override (because strict is now default). If anything fails, it's a missed callsite from Task 1.3 — fix and re-run.

- [ ] **Step 2.8: Commit**

```bash
git add apps/backend/.env.example \
        apps/backend/src/common/tenant/ \
        docker/docker-compose.yml \
        .github/workflows/ci.yml \
        docs/saas-tenancy.md \
        apps/backend/CLAUDE.md
git commit -m "feat(saas-02h): flip TENANT_ENFORCEMENT default to strict"
```

---

## Task 3: RLS probe role migration

**Files:**
- Create: `apps/backend/prisma/migrations/<timestamp>_saas_02h_rls_probe_role/migration.sql`

The RLS backstop tests connect as a non-superuser role — the Postgres superuser bypasses RLS even with `FORCE ROW LEVEL SECURITY`. This migration creates a least-privilege role used only by the penetration suite.

- [ ] **Step 3.1: Generate timestamped directory**

```bash
cd apps/backend
TS=$(date -u +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${TS}_saas_02h_rls_probe_role"
```

- [ ] **Step 3.2: Write migration.sql**

```sql
-- SaaS-02h: non-superuser role for RLS backstop tests.
-- Applied alongside prod migrations — the role exists in every environment.
-- Password is test-only; the role cannot be used to write and has no access
-- outside explicitly granted SELECTs on tenant-scoped tables.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'carekit_rls_probe') THEN
    CREATE ROLE carekit_rls_probe WITH LOGIN PASSWORD 'rls_probe_test_only_2026';
  END IF;
END$$;

GRANT CONNECT ON DATABASE CURRENT_DATABASE() TO carekit_rls_probe;
GRANT USAGE ON SCHEMA public TO carekit_rls_probe;

-- Grant SELECT on every tenant-scoped table (52 models from 02a–02g).
-- The role inherits RLS policies, so it cannot read cross-org rows.
GRANT SELECT ON "Organization", "Membership" TO carekit_rls_probe;
GRANT SELECT ON "RefreshToken", "CustomRole", "Permission" TO carekit_rls_probe;
GRANT SELECT ON "Client", "ClientRefreshToken", "Employee", "EmployeeBranch",
  "EmployeeService", "EmployeeAvailability", "EmployeeAvailabilityException" TO carekit_rls_probe;
GRANT SELECT ON "Branch", "Department", "ServiceCategory", "Service",
  "ServiceBookingConfig", "ServiceDurationOption", "EmployeeServiceOption",
  "BusinessHour", "Holiday", "IntakeForm", "IntakeField", "Rating",
  "BrandingConfig", "OrganizationSettings" TO carekit_rls_probe;
GRANT SELECT ON "Booking", "BookingStatusLog", "WaitlistEntry",
  "GroupSession", "GroupEnrollment", "GroupSessionWaitlist",
  "BookingSettings" TO carekit_rls_probe;
GRANT SELECT ON "Invoice", "Payment", "Coupon", "CouponRedemption",
  "RefundRequest", "ZatcaSubmission", "ZatcaConfig" TO carekit_rls_probe;
GRANT SELECT ON "EmailTemplate", "Notification",
  "ChatConversation", "CommsChatMessage", "ChatSession", "ChatMessage",
  "ContactMessage", "ChatbotConfig" TO carekit_rls_probe;
GRANT SELECT ON "KnowledgeDocument", "DocumentChunk", "File",
  "ActivityLog", "Report", "FeatureFlag", "Integration", "ProblemReport",
  "SiteSetting" TO carekit_rls_probe;

-- FORCE RLS for the probe role — even if a table owner bypasses RLS, this role does not.
-- Applies to every tenant-scoped table.
ALTER TABLE "Client" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Booking" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Notification" FORCE ROW LEVEL SECURITY;
ALTER TABLE "DocumentChunk" FORCE ROW LEVEL SECURITY;
-- (The full list of FORCE RLS alters is applied per prior-migration RLS ENABLE
--  — FORCE is an additive flag. Repeat ALTER for every tenant-scoped table here.)
```

Complete the `ALTER TABLE ... FORCE ROW LEVEL SECURITY` list for all 52 scoped tables. One statement per table — no conditionals.

- [ ] **Step 3.3: Apply migration**

```bash
cd apps/backend && npx prisma migrate deploy
TEST_DATABASE_URL="postgresql://carekit:carekit@localhost:5999/carekit_test" \
  DATABASE_URL="postgresql://carekit:carekit@localhost:5999/carekit_test" \
  npx prisma migrate deploy
```

**Never run `prisma migrate dev`** — pgvector.

- [ ] **Step 3.4: Verify the role**

```bash
psql -h localhost -p 5999 -U carekit -d carekit_test -c "\du carekit_rls_probe"
```

Expected: role listed with no SUPERUSER attribute.

- [ ] **Step 3.5: Commit**

```bash
git add apps/backend/prisma/migrations/*saas_02h_rls_probe_role
git commit -m "feat(saas-02h): create carekit_rls_probe non-superuser role for RLS backstop tests"
```

---

## Task 4: Jest security project + test runner wiring

**Files:**
- Create: `apps/backend/test/jest-security.json`
- Modify: `apps/backend/package.json`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 4.1: Create `test/jest-security.json`**

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "..",
  "testEnvironment": "node",
  "testRegex": "test/e2e/security/.*\\.e2e-spec\\.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "setupFiles": ["<rootDir>/test/jest.setup.ts"],
  "testTimeout": 60000,
  "maxWorkers": 1
}
```

Single worker because the security tests mutate role-level state and RLS settings — parallelism causes flakes.

- [ ] **Step 4.2: Add npm script**

In `apps/backend/package.json`:

```json
{
  "scripts": {
    "test:security": "jest --config test/jest-security.json --runInBand"
  }
}
```

- [ ] **Step 4.3: CI job — required gate**

In `.github/workflows/ci.yml`, add under `jobs`:

```yaml
  test-security:
    name: Cross-tenant penetration suite
    runs-on: ubuntu-latest
    needs: [test-e2e]
    env:
      TENANT_ENFORCEMENT: strict
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run docker:up
      - run: cd apps/backend && npx prisma migrate deploy
      - run: cd apps/backend && npm run test:security
```

Ensure this job is listed as required in branch protection (manual step by Tariq).

- [ ] **Step 4.4: Commit**

```bash
git add apps/backend/test/jest-security.json apps/backend/package.json .github/workflows/ci.yml
git commit -m "build(saas-02h): jest security project + CI required gate"
```

---

## Task 5: Write the penetration test suites

Five e2e files. Each is self-contained; beforeAll seeds two orgs, afterAll tears them down.

### 5A: `test/e2e/security/cross-tenant-penetration.e2e-spec.ts`

Headline adversarial suite. Seeds two orgs with full stacks (branch, service, client, employee, booking, invoice, notification, file, knowledge document, activity log).

- [ ] **Step 5A.1: Direct ID probe test**

```ts
it('rejects cross-org Booking id lookup', async () => {
  const bookingA = await createBookingInOrg(ORG_A);
  await withCls(ORG_B, async () => {
    const result = await prisma.booking.findFirst({ where: { id: bookingA.id } });
    expect(result).toBeNull();
  });
});
```

Repeat for Invoice, Payment, Coupon, Notification, File, KnowledgeDocument, ChatConversation, ActivityLog, Report, FeatureFlag, Integration, ProblemReport, SiteSetting.

- [ ] **Step 5A.2: IDOR in update/delete**

```ts
it('rejects cross-org Booking update by id', async () => {
  const bookingA = await createBookingInOrg(ORG_A);
  await withCls(ORG_B, async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/dashboard/bookings/${bookingA.id}/cancel`)
      .set('Authorization', `Bearer ${jwtForOrg(ORG_B)}`)
      .send({ reason: 'test' });
    expect(res.status).toBe(404); // NOT 200, NOT 403 — must be 404 (can't reveal existence)
  });
  // Assert the booking is still in original state
  const stillActive = await prisma.booking.findFirst({ where: { id: bookingA.id, organizationId: ORG_A } });
  expect(stillActive?.status).not.toBe('CANCELLED');
});
```

Repeat for: invoice cancel/refund, coupon update, email-template update, feature-flag toggle, site-setting upsert, file delete, knowledge-document delete.

- [ ] **Step 5A.3: Cross-org foreign-key injection**

An attacker in Org B tries to create a Booking in Org B that references Org A's clientId:

```ts
it('rejects booking creation referencing another org\'s client', async () => {
  const clientA = await createClientInOrg(ORG_A);
  await withCls(ORG_B, async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/dashboard/bookings')
      .set('Authorization', `Bearer ${jwtForOrg(ORG_B)}`)
      .send({ clientId: clientA.id, employeeId: /* orgB employee */, /* ... */ });
    // Should fail because the clientId lookup (Proxy-scoped) returns null.
    expect(res.status).toBe(404);
  });
});
```

Repeat across employee, service, branch, coupon, invoice.

- [ ] **Step 5A.4: Coupon code collision (must SUCCEED per 02e design)**

```ts
it('allows the same coupon code in two different orgs', async () => {
  const couponA = await createCoupon(ORG_A, 'WELCOME10');
  const couponB = await createCoupon(ORG_B, 'WELCOME10');
  expect(couponA.id).not.toBe(couponB.id);
  expect(couponA.organizationId).toBe(ORG_A);
  expect(couponB.organizationId).toBe(ORG_B);
});

it('redeeming WELCOME10 in org A does not affect the same code in org B', async () => {
  // Redeem in A
  await withCls(ORG_A, async () => {
    await applyCouponHandler.execute({ code: 'WELCOME10', invoiceId: /* orgA invoice */ });
  });
  const couponA = await prisma.coupon.findFirst({ where: { code: 'WELCOME10', organizationId: ORG_A } });
  const couponB = await prisma.coupon.findFirst({ where: { code: 'WELCOME10', organizationId: ORG_B } });
  expect(couponA?.usedCount).toBe(1);
  expect(couponB?.usedCount).toBe(0);
});
```

- [ ] **Step 5A.5: Raw-SQL `$queryRaw` probe**

Explicitly bypass the Proxy and attempt a raw read from Org B's CLS context against Org A's KnowledgeDocument. The semantic-search handler is already scoped (02g); this test confirms no OTHER handler accidentally reads via raw SQL without the predicate:

```ts
it('$queryRaw without organizationId predicate returns only CLS org rows (RLS backstop)', async () => {
  const docA = await createKnowledgeDocument(ORG_A);
  await withCls(ORG_B, async () => {
    // If any handler did `$queryRaw\`SELECT * FROM "KnowledgeDocument"\`` it
    // would return both orgs' rows without the predicate. RLS is the backstop
    // — but Prisma connects as the DB owner, bypassing RLS. This test runs
    // under the rls_probe role to verify RLS itself is correctly configured.
    const probeClient = new Client({ connectionString: RLS_PROBE_URL });
    await probeClient.connect();
    await probeClient.query(`SET app.current_organization_id = '${ORG_B}'`);
    const rows = await probeClient.query(`SELECT id FROM "KnowledgeDocument"`);
    await probeClient.end();
    expect(rows.rows.map((r: any) => r.id)).not.toContain(docA.id);
  });
});
```

### 5B: `test/e2e/security/rls-backstop.e2e-spec.ts`

- [ ] **Step 5B.1: RLS isolation under the probe role**

For each scoped table, connect as `carekit_rls_probe`, `SET app.current_organization_id = ORG_A`, select count → should match the number of rows for ORG_A only.

Iterate over all 52 scoped tables. Fail loudly on any table where the count is off by even one row.

- [ ] **Step 5B.2: RLS active even with table owner override attempt**

Attempt `SELECT * FROM "Booking"` without setting `app.current_organization_id` — should return ZERO rows (or fail) under the probe role. The `current_setting(..., true)` returns NULL when unset, so the policy predicate `"organizationId" = null` matches nothing.

### 5C: `test/e2e/security/strict-mode-enforcement.e2e-spec.ts`

- [ ] **Step 5C.1: `requireOrganizationId` throws when CLS is unset**

```ts
it('requireOrganizationId throws when CLS has no org', () => {
  expect(() => {
    // outside any cls.run
    tenant.requireOrganizationId();
  }).toThrow(/tenant context not set/i);
});
```

- [ ] **Step 5C.2: Every authenticated-route handler fails closed without CLS**

Hit a dashboard route without the `JwtGuard` (bypass guard via test hook) — the handler's `requireOrganizationId()` should throw. The HTTP response must be 401 or 500 (NOT 200 with DEFAULT_ORG data).

### 5D: `test/e2e/security/moyasar-webhook-forgery.e2e-spec.ts`

- [ ] **Step 5D.1: Valid signature + metadata targeting Org A lands the payment in Org A**

(Positive control — same as 02e's moyasar-webhook-tenant-context spec, but re-run under strict mode.)

- [ ] **Step 5D.2: Valid signature + forged metadata `{ invoiceId: "bogus" }` → skipped**

- [ ] **Step 5D.3: Invalid signature → rejected before DB access**

- [ ] **Step 5D.4: systemContext bypass is unreachable from an authenticated route**

Attempt to call any dashboard endpoint with a hand-crafted request that attempts to set `cls.systemContext=true`. Confirm:
- No public API surface allows setting `systemContext`.
- Only the webhook route's `execute()` does so, and only for the tenant-resolution lookup (not for the write).

```ts
it('systemContext flag is NOT exposed to authenticated callers', async () => {
  // Grep-style static check: ClsService middleware MUST NOT accept a
  // client-supplied systemContext header. Confirm via the bootstrap
  // ClsModule config.
  const clsModuleConfig = app.get(ClsModuleOptions);
  expect(clsModuleConfig.setup).toBeDefined();
  // The setup function should never write cls.set('systemContext', ...).
  // Confirm by asserting the config source matches the expected file.
});
```

### 5E: Shared harness

- [ ] **Step 5E.1: `test/e2e/security/harness.ts`**

Export `withCls(orgId, fn)`, `createOrg(slug)`, `seedFullStack(orgId)`, `jwtForOrg(orgId)`, `rlsProbeUrl()`. Shared by all five suites to keep each spec focused on assertions.

- [ ] **Step 5E.2: `test/e2e/security/README.md`**

```markdown
# Cross-tenant penetration suite

Runs under strict TENANT_ENFORCEMENT. Two orgs are seeded with full stacks; an
attacker in org B attempts to reach org A's data via every known vector.

## Local run

    npm run test:security

## CI

The `test-security` job is required before merge (branch protection).

## Adding a test

1. Extend `harness.ts` with any new setup you need.
2. Add a new `it(...)` block or a new `*.e2e-spec.ts` under this directory.
3. Update `docs/saas-tenancy.md` if the new test expands the contract.

## Vectors covered

- Direct id probe (findFirst cross-org)
- IDOR in update/delete (404, not 403)
- Foreign-key injection (creating a child referencing another org's parent)
- Coupon code collision (MUST succeed — per-org namespace, 02e design)
- Raw-SQL $queryRaw read (RLS backstop under non-superuser role)
- Moyasar webhook forgery (invalid signature, forged metadata)
- systemContext bypass abuse (unreachable from authenticated routes)
- Strict-mode enforcement (requireOrganizationId throws closed)
```

- [ ] **Step 5E.3: Commit all five specs + harness**

```bash
git add apps/backend/test/e2e/security/
git commit -m "test(saas-02h): cross-tenant penetration suite (5 specs + shared harness)"
```

---

## Task 6: Run + stabilize

- [ ] **Step 6.1: Run the security suite locally**

```bash
cd apps/backend && npm run test:security
```

Expected: all tests green. Any failure = a real vulnerability. Document in `docs/superpowers/incidents/saas-02h-<date>-<short>.md`, fix the handler, re-run.

- [ ] **Step 6.2: Run full regression**

```bash
cd apps/backend && npm run test && npm run test:e2e && npm run test:security
```

Expected: all green. Record counts.

- [ ] **Step 6.3: Manual smoke against the running dev backend**

Boot the dev stack:

```bash
npm run docker:up
cd apps/backend && npm run dev
```

Using the Chrome DevTools MCP, hit the dashboard under two seeded orgs and confirm:
- Login as Org A → only Org A data visible everywhere.
- Attempt direct URL navigation to an Org B resource via its UUID → 404.
- Log the evidence in `docs/superpowers/qa/saas-02h-manual-smoke-<date>.md`.

- [ ] **Step 6.4: Commit any fixes surfaced by the runs**

Each fix is a separate commit tagged with the originating plan (e.g. `fix(saas-02d): strict-mode penetration surface bug in cancel-booking`).

---

## Task 7: Final verification + memory + index

- [ ] **Step 7.1: Typecheck**

```bash
cd apps/backend && npm run typecheck
```

Expected: clean.

- [ ] **Step 7.2: Full unit + e2e + security suites**

```bash
cd apps/backend && npm run test && npm run test:e2e && npm run test:security
```

Expected: all three green under the new `strict` default.

- [ ] **Step 7.3: Create memory file**

`/Users/tariq/.claude/projects/-Users-tariq-code-carekit/memory/saas02h_status.md`:

```markdown
---
name: SaaS-02h status
description: Plan 02h (strict mode + cross-tenant penetration suite) — TENANT_ENFORCEMENT default flipped to strict; CI security gate live
type: project
---
**Status:** PR #<N> <state> (feat/saas-02h-strict-mode → main). Closes out Phase 02.

**Scope delivered:**
- `TENANT_ENFORCEMENT=strict` is the platform default. Permissive/off remain only for local dev + bootstrap.
- Cross-tenant penetration suite (5 e2e files) runs as a required CI gate.
- `carekit_rls_probe` non-superuser role created for RLS backstop tests.
- Docs + CLAUDE.md updated — "transitional" language removed.

**Key findings from strict-mode dry-run (Task 1.3):** <fill in with real callsite fixes if any>

**How to use:**
- Never add a scoped-model query without CLS tenant context. `TenantContextService.requireOrganizationId()` throws in strict.
- Raw SQL (`$queryRaw`, `$executeRaw`) must include `organizationId = $X` — Proxy does not cover raw.
- External-entry webhooks (Moyasar, FCM DLQ, future Zoom) use `systemContext=true` only to resolve tenant, then re-run mutations inside `cls.run` with the resolved org.
- New tests for adversarial scenarios belong in `test/e2e/security/`.

**Test evidence:** <fill in> unit, <fill in> e2e, <fill in> security specs green under strict.

**Next:** Plan 03 — Verticals System (`Vertical`, `VerticalSeedService`, `VerticalSeedDepartment` + 8 templates + terminology packs).
```

- [ ] **Step 7.4: Update MEMORY.md**

Append:

```
- [SaaS-02h status](saas02h_status.md) — Plan 02h delivered <date> PR #<N>; strict mode default + penetration suite; closes SaaS-02
```

- [ ] **Step 7.5: Update transformation index**

- Progress: 9/18 phases done (50%). Phase 02 (a–h) fully closed.
- Phase 02h ✅ DONE.
- Executor next action: begin Plan 03 (Verticals System) — 02h is the final gate.
- Append log entry summarising counts: `TENANT_ENFORCEMENT=strict default, <N> penetration tests passing, CI required gate live`.
- Remove any remaining "02 rollout" risks from the active-risks section; add "Phase 02 CLOSED — shared DB multi-tenant isolation proven end-to-end".

- [ ] **Step 7.6: Final commit**

```bash
git add /Users/tariq/.claude/projects/-Users-tariq-code-carekit/memory/saas02h_status.md \
        /Users/tariq/.claude/projects/-Users-tariq-code-carekit/memory/MEMORY.md \
        docs/superpowers/plans/2026-04-21-saas-transformation-index.md
git commit -m "docs(saas): close SaaS-02 — 02h strict mode + penetration suite done"
```

- [ ] **Step 7.7: Open the PR**

```bash
git push -u origin feat/saas-02h-strict-mode
gh pr create --title "feat(saas-02h): strict mode default + cross-tenant penetration suite — closes Phase 02" \
  --body "Flips TENANT_ENFORCEMENT default to strict. Adds adversarial e2e suite (5 specs) as a required CI gate. Creates carekit_rls_probe non-superuser role for RLS backstop tests. Updates docs. No schema changes beyond the role migration."
```

---

## Rollback plan

If strict mode surfaces a production incident (unscoped CLS context in a critical path) post-deploy:

1. Set `TENANT_ENFORCEMENT=permissive` as an env override (immediate hotfix).
2. `git revert` the `.env.example` + `tenant-context.service.ts` default change — keep all other 02h work (tests, RLS role) untouched.
3. File an incident under `docs/superpowers/incidents/` naming the handler that needed the bypass.
4. Fix the handler with an explicit `requireOrganizationIdOrDefault()` or proper CLS wiring, land the fix, then re-flip to strict in a follow-up PR.

The penetration suite stays in CI regardless of mode — it runs with `TENANT_ENFORCEMENT=strict` explicitly set in the workflow env, independent of the default.

---

## Amendments applied during execution

> _This section is empty until execution. If reality diverges from any step, stop, document here, and await confirmation before continuing._
