# Super-Admin CLS Context Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit all `prisma.$allTenants.X` callsites outside `src/modules/platform/admin/` and ensure each is wrapped in `cls.run(() => { cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true); ... })`. Add a unit/lint guard to prevent regression.

**Architecture:** Apply the canonical `cls.run` wrapper from `charge-due-subscriptions.cron.ts:39-42` to every cron / service / handler that uses `$allTenants` and is invoked outside an HTTP request that goes through `SuperAdminContextInterceptor`. Add a Jest test that fails if a non-admin file uses `$allTenants` without the key being set in the same function/method scope.

**Tech Stack:** NestJS 11, nestjs-cls, Prisma 7, Jest, ripgrep.

---

## Background

The getter at `apps/backend/src/infrastructure/database/prisma.service.ts:217` reads:

```ts
get $allTenants(): PrismaClient {
  if (this.cls?.get<boolean | undefined>(SUPER_ADMIN_CONTEXT_CLS_KEY) !== true) {
    throw new ForbiddenException('super_admin_context_required');
  }
  return this.basePrisma;
}
```

Any code that calls `prisma.$allTenants.X` without first entering a `cls.run()` that sets `SUPER_ADMIN_CONTEXT_CLS_KEY = true` will throw at runtime. Admin HTTP handlers are safe because `SuperAdminContextInterceptor` sets the key for every request entering `src/api/admin/`. Everything invoked outside that interceptor — crons, BullMQ handlers, background services — must set the key themselves.

**Canonical pattern** (copy verbatim from `charge-due-subscriptions.cron.ts:39-42`):

```ts
await this.cls.run(async () => {
  this.cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
  await this.runCharge();
});
```

---

## Confirmed SAFE (admin HTTP path — no fix needed)

Files under `apps/backend/src/modules/platform/admin/` are reached only through `src/api/admin/*.controller.ts`, which applies `SuperAdminGuard` + `SuperAdminContextInterceptor` at the controller class level. The interceptor sets `SUPER_ADMIN_CONTEXT_CLS_KEY = true` before any handler runs. These files are explicitly excluded from the audit scope and must NOT be modified.

Verify the fence before any fix work:

```bash
grep -rn "SuperAdminContextInterceptor" apps/backend/src/api/admin/ | head -5
# Expected: every admin controller shows @UseInterceptors(SuperAdminContextInterceptor)
```

---

## Task 1 — Sweep: generate the authoritative callsite list

> **Gate:** all subsequent fix tasks depend on this matrix. Do not begin Task 2–4 until the matrix file exists.

- [ ] 1.1 Run the sweep command:

  ```bash
  cd apps/backend && rg -n '\$allTenants\.' src/ --files-with-matches \
    | grep -v '\.spec\.ts$' \
    | grep -v '/platform/admin/' \
    | sort > /tmp/cls-audit-files.txt
  cat /tmp/cls-audit-files.txt
  wc -l /tmp/cls-audit-files.txt
  ```

- [ ] 1.2 For each file `$f` in the list, run:

  ```bash
  rg -n '\$allTenants\.|cls\.run|SUPER_ADMIN_CONTEXT_CLS_KEY' "$f"
  ```

  Classify each file into one of:

  | Classification | Meaning |
  |---|---|
  | **SAFE** | Uses `$allTenants` AND the same file contains `cls.run` + `SUPER_ADMIN_CONTEXT_CLS_KEY` set BEFORE the first `$allTenants` call in every execution path |
  | **BROKEN** | Uses `$allTenants` with no `cls.run` wrap (or the wrap is entered AFTER the `$allTenants` call — e.g. reconcile's outer `execute()` queries before its per-org loop) |
  | **AMBIGUOUS** | The file itself has no wrap, but is only ever called from code that already established the context (verify by tracing callers) |

  Pre-populated seed from prior investigation (update after the sweep):

  | File | Status | Notes |
  |---|---|---|
  | `src/modules/platform/billing/charge-due-subscriptions/charge-due-subscriptions.cron.ts` | SAFE | Canonical pattern; `cls.run` at line 39 |
  | `src/modules/ops/orphan-audit/run-orphan-audit.handler.ts` | SAFE | `cls.run` + key set in `execute()` before any `$allTenants` call |
  | `src/modules/platform/billing/process-scheduled-plan-changes/process-scheduled-plan-changes.cron.ts` | **BROKEN** | `$allTenants` at line 23 (findMany), no `cls.run` anywhere in file |
  | `src/modules/platform/billing/record-subscription-payment/record-subscription-payment.handler.ts` | **BROKEN** | `$allTenants.membership.findFirst()` at line ~80, no `cls.run`; called from `DunningRetryService` which also has no outer wrap |
  | `src/modules/platform/billing/dunning-retry/dunning-retry.cron.ts` | **BROKEN** | `$allTenants.subscription.findMany` at line 19, no `cls.run`; `DunningRetryService` it calls is also unwrapped |
  | `src/modules/platform/billing/dunning-retry/dunning-retry.service.ts` | **BROKEN** | `$allTenants.membership.findFirst` in `sendFailureEmail()`; called from `retryInvoice()` which `DunningRetryCron` calls without a CLS context |
  | `src/modules/platform/billing/expire-trials/expire-trials.cron.ts` | **BROKEN** | Multiple `$allTenants.*` calls in `execute()`, `notifyTrialMilestones()`, `processExpiredTrials()`, `lookupOwner()`, etc.; no `cls.run` in file |
  | `src/modules/platform/billing/process-scheduled-cancellations/process-scheduled-cancellations.cron.ts` | **BROKEN** | `$allTenants.subscription.findMany` + `update` in `execute()`, no `cls.run` |
  | `src/modules/platform/billing/grace-watchers/api-webhooks-grace.cron.ts` | **BROKEN** | `$allTenants.subscription.findMany` + `membership.findFirst` + `subscription.update` in `run()`, no `cls.run` |
  | `src/modules/platform/billing/grace-watchers/custom-domain-grace.cron.ts` | **BROKEN** | `$allTenants.organizationSettings.findMany` + `membership.findFirst` + `organizationSettings.update` in `run()`, no `cls.run` |
  | `src/modules/platform/billing/send-limit-warning/send-limit-warning.cron.ts` | **BROKEN** | `$allTenants.subscription.findMany` + multiple nested `$allTenants.*` calls in `execute()`, no `cls.run` |
  | `src/modules/ops/cron-tasks/reconcile-usage-counters/reconcile-usage-counters.handler.ts` | **BROKEN** | `$allTenants.organization.findMany` at line ~39 runs BEFORE the per-org `cls.run` loop; outer `execute()` has no wrapping context |
  | `src/modules/identity/invite-user/invite-user.handler.ts` | **BROKEN** | `$allTenants.membership.findFirst` called from a tenant-scoped HTTP route (`POST /auth/invite`) with only `JwtGuard`, never `SuperAdminContextInterceptor` |
  | `src/modules/platform/billing/downgrade-safety/downgrade-safety.service.ts` | AMBIGUOUS | Verify: is it only called from `DowngradePlanHandler` (admin, SAFE) and `process-scheduled-plan-changes.cron.ts` (BROKEN)? If the latter, fixing the cron's outer wrap is sufficient |

- [ ] 1.3 Commit the classification to `docs/superpowers/specs/2026-05-04-cls-audit-matrix.md` with the final, sweep-verified table. Commit message: `docs: cls audit matrix — $allTenants callsite classification`.

---

## Task 2 — Fix `process-scheduled-plan-changes.cron.ts` (HIGH — confirmed broken)

Test file to read first: `apps/backend/src/modules/platform/billing/process-scheduled-plan-changes/process-scheduled-plan-changes.cron.spec.ts`

Implementation file: `apps/backend/src/modules/platform/billing/process-scheduled-plan-changes/process-scheduled-plan-changes.cron.ts`

### Step 2.1 — Add failing test (TDD red phase)

Read the existing spec to understand the `buildPrisma` / `buildConfig` / `buildCache` / `buildSafety` helpers that are already defined there. Then add the following test to the existing `describe` block in `process-scheduled-plan-changes.cron.spec.ts`:

```ts
import { ClsService } from 'nestjs-cls';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../../common/tenant/tenant.constants';

// Add this helper alongside the other build* helpers at the top of the describe block:
const buildCls = () => {
  const store = new Map<string, unknown>();
  return {
    run: jest.fn((fn: () => Promise<unknown>) => fn()),
    set: jest.fn((key: string, value: unknown) => store.set(key, value)),
    get: jest.fn((key: string) => store.get(key)),
  } as unknown as ClsService;
};

// Add this test case inside describe('ProcessScheduledPlanChangesCron'):
it('executes inside a super-admin CLS context so $allTenants does not throw', async () => {
  const prisma = buildPrisma([]);
  const cls = buildCls();
  const cron = new ProcessScheduledPlanChangesCron(
    prisma as never,
    buildConfig(true) as never,
    buildCache() as never,
    buildSafety() as never,
    cls,
  );

  await cron.execute();

  expect(cls.run).toHaveBeenCalledTimes(1);
  expect(cls.set).toHaveBeenCalledWith(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
});
```

- [ ] 2.1 Add the test above. Run:

  ```bash
  cd apps/backend && npx jest --testPathPattern process-scheduled-plan-changes.cron.spec --runInBand 2>&1 | tail -20
  ```

  Confirm the new test fails (the constructor call will fail because `ClsService` is not injected yet, or `cls.run` is never called).

### Step 2.2 — Apply the fix

Modify `process-scheduled-plan-changes.cron.ts` as follows.

**Constructor change** — add `ClsService` as the 5th dependency:

```ts
// Add this import at the top:
import { ClsService } from 'nestjs-cls';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../../common/tenant/tenant.constants';

// Updated constructor:
constructor(
  private readonly prisma: PrismaService,
  private readonly config: ConfigService,
  private readonly cache: SubscriptionCacheService,
  private readonly downgradeSafety: DowngradeSafetyService,
  private readonly cls: ClsService,
) {}
```

**`execute()` body** — wrap the entire body (after the guard) in `cls.run`:

```ts
async execute(): Promise<void> {
  if (!this.config.get<boolean>('BILLING_CRON_ENABLED', false)) return;

  await this.cls.run(async () => {
    this.cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
    await this.runScheduledChanges();
  });
}

private async runScheduledChanges(): Promise<void> {
  const now = new Date();
  const due = await this.prisma.$allTenants.subscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'PAST_DUE'] },
      scheduledPlanId: { not: null },
      scheduledBillingCycle: { not: null },
      scheduledPlanChangeAt: { lte: now },
    },
    select: {
      id: true,
      organizationId: true,
      scheduledPlanId: true,
      scheduledBillingCycle: true,
      plan: { select: { priceMonthly: true, limits: true } },
      scheduledPlan: { select: { priceMonthly: true, limits: true } },
    },
  });

  // ... (rest of the existing loop body, moved verbatim into this private method)
```

  Move the entire `for (const sub of due)` loop and the final `if (due.length > 0)` log into `runScheduledChanges()`. The existing logic does not change — only the structural wrapper is added.

- [ ] 2.2 Apply the changes above.

### Step 2.3 — Confirm green

- [ ] 2.3 Run:

  ```bash
  cd apps/backend && npx jest --testPathPattern process-scheduled-plan-changes.cron.spec --runInBand 2>&1 | tail -20
  ```

  All tests (including the new one) must pass.

### Step 2.4 — E2E confirmation

- [ ] 2.4 Run:

  ```bash
  cd apps/backend && npx jest --config test/jest-e2e.json --testPathPattern cache-invalidation-edge --runInBand 2>&1 | tail -30
  ```

  Case 5 must pass.

### Step 2.5 — Commit

- [ ] 2.5 Commit:

  ```
  fix(billing): wrap process-scheduled-plan-changes cron in super-admin CLS context
  ```

---

## Task 3 — Fix `record-subscription-payment.handler.ts` (HIGH — silent payment-record failure)

**Severity:** Every successful dunning retry charge ends with `DunningRetryService.retryInvoice()` calling `this.recordPayment.execute(...)`. Inside `execute()`, the handler calls `prisma.$allTenants.membership.findFirst()` to look up the owner email for the success email. Without the CLS key, this throws `ForbiddenException` at runtime. The catch block in `DunningRetryService.retryInvoice()` then records the invoice as `FAILED` and the dunning cycle continues — the tenant was charged but the platform thinks it failed.

**Caller analysis:**
- `DunningRetryService.retryInvoice()` — called from `DunningRetryCron` and admin manual-retry endpoints. Both paths are BROKEN (no outer CLS context).
- `ExpireTrialsCron.chargeExpiredTrial()` — also calls `this.recordPayment.execute(...)`. `ExpireTrialsCron` is itself BROKEN (fixed in Task 4). Once its outer wrap is applied the downstream `$allTenants` call in `RecordSubscriptionPaymentHandler` is automatically protected.
- `ChargeDueSubscriptionsCron` — already SAFE (canonical wrap at line 39); its call to `recordPayment.execute()` runs inside the established CLS context.

**Implementation decision — Option A** (recommended): wrap the `$allTenants` call INSIDE the handler rather than requiring every caller to establish context. This makes the handler safe to call from any context. Add a JSDoc explaining the requirement.

Implementation file: `apps/backend/src/modules/platform/billing/record-subscription-payment/record-subscription-payment.handler.ts`

### Step 3.1 — Add failing test (TDD red phase)

Add to the existing spec for `RecordSubscriptionPaymentHandler` (or create one if absent — check with `ls apps/backend/src/modules/platform/billing/record-subscription-payment/`):

```ts
import { ClsService } from 'nestjs-cls';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../../common/tenant/tenant.constants';

// Helper for a minimal CLS mock:
const buildCls = () => {
  const store = new Map<string, unknown>();
  return {
    run: jest.fn((fn: () => Promise<unknown>) => fn()),
    set: jest.fn((key: string, value: unknown) => store.set(key, value)),
    get: jest.fn((key: string) => store.get(key)),
  } as unknown as ClsService;
};

it('looks up owner email inside a super-admin CLS context so $allTenants does not throw', async () => {
  // Minimal prisma mock — $transaction, subscriptionInvoice, subscription, $allTenants.membership
  const mockInvoice = {
    id: 'inv-1',
    issuedAt: null,
    invoiceNumber: null,
    subscription: {
      id: 'sub-1',
      organizationId: 'org-1',
      status: 'PAST_DUE',
      billingCycle: 'MONTHLY',
      currentPeriodEnd: new Date(Date.now() - 86_400_000),
      currentPeriodStart: new Date(Date.now() - 31 * 86_400_000),
    },
    amount: '300.00',
  };

  const cls = buildCls();
  const prisma = {
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        subscriptionInvoice: { update: jest.fn().mockResolvedValue({}) },
        subscription: { update: jest.fn().mockResolvedValue({}) },
      }),
    ),
    subscriptionInvoice: { findFirst: jest.fn().mockResolvedValue(mockInvoice) },
    $allTenants: {
      membership: { findFirst: jest.fn().mockResolvedValue(null) },
    },
  };

  const handler = new RecordSubscriptionPaymentHandler(
    prisma as never,
    buildCache() as never,
    buildStateMachine() as never,
    buildMailer() as never,
    buildConfig() as never,
    buildIssueInvoice() as never,
    cls,
  );

  await handler.execute({ invoiceId: 'inv-1', moyasarPaymentId: 'pay-1' });

  expect(cls.run).toHaveBeenCalledTimes(1);
  expect(cls.set).toHaveBeenCalledWith(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
});
```

- [ ] 3.1 Add the test. Run:

  ```bash
  cd apps/backend && npx jest --testPathPattern record-subscription-payment --runInBand 2>&1 | tail -20
  ```

  Confirm the new test fails.

### Step 3.2 — Apply the fix

Add `ClsService` as a new constructor dependency (last position to avoid breaking existing test instantiations where possible):

```ts
// New imports:
import { ClsService } from 'nestjs-cls';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../../common/tenant/tenant.constants';

// Updated constructor:
constructor(
  private readonly prisma: PrismaService,
  private readonly cache: SubscriptionCacheService,
  private readonly stateMachine: SubscriptionStateMachine,
  private readonly mailer: PlatformMailerService,
  private readonly config: ConfigService,
  private readonly issueInvoice: IssueInvoiceHandler,
  private readonly cls: ClsService,
) {}
```

Wrap only the `$allTenants` block near the end of `execute()`:

```ts
// Replace the existing owner lookup block (from line ~80 to the mailer call) with:

/**
 * Owner lookup requires prisma.$allTenants — wrap in super-admin CLS context.
 * This handler is called from both cron (ChargeDueSubscriptionsCron, already
 * wrapped) and DunningRetryService (not wrapped). Option A: the handler owns
 * its own context so every caller is safe.
 */
await this.cls.run(async () => {
  this.cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true);

  const owner = await this.prisma.$allTenants.membership.findFirst({
    where: { organizationId: sub.organizationId, role: 'OWNER', isActive: true },
    select: {
      displayName: true,
      user: { select: { email: true, name: true } },
      organization: { select: { nameAr: true } },
    },
  });
  if (owner?.user) {
    const baseUrl = this.config.get<string>(
      'PLATFORM_DASHBOARD_URL',
      'https://app.webvue.pro/dashboard',
    );
    await this.mailer.sendSubscriptionPaymentSucceeded(owner.user.email, {
      ownerName: owner.displayName ?? owner.user.name ?? '',
      orgName: owner.organization.nameAr,
      amountSar: Number(invoice.amount).toFixed(2),
      invoiceId: invoice.id,
      receiptUrl: `${baseUrl}/billing/${invoice.id}`,
    });
  }
});

return { ok: true };
```

- [ ] 3.2 Apply the changes above.

### Step 3.3 — Confirm green

- [ ] 3.3 Run:

  ```bash
  cd apps/backend && npx jest --testPathPattern record-subscription-payment --runInBand 2>&1 | tail -20
  ```

  All tests must pass.

### Step 3.4 — E2E confirmation

- [ ] 3.4 Run:

  ```bash
  cd apps/backend && npx jest --config test/jest-e2e.json --testPathPattern dunning-retry --runInBand 2>&1 | tail -40
  ```

  Cases 3 and 6 must pass.

### Step 3.5 — Commit

- [ ] 3.5 Commit:

  ```
  fix(billing): wrap $allTenants owner lookup in record-subscription-payment handler
  ```

---

## Task 4 — Fix all remaining BROKEN files from Task 1's matrix

The confirmed BROKEN files (beyond Tasks 2 and 3) are listed below. **One TDD task per file** — apply the template that follows to each.

### Confirmed BROKEN files (verified in investigation):

1. `apps/backend/src/modules/platform/billing/dunning-retry/dunning-retry.cron.ts`
2. `apps/backend/src/modules/platform/billing/dunning-retry/dunning-retry.service.ts`
3. `apps/backend/src/modules/platform/billing/expire-trials/expire-trials.cron.ts`
4. `apps/backend/src/modules/platform/billing/process-scheduled-cancellations/process-scheduled-cancellations.cron.ts`
5. `apps/backend/src/modules/platform/billing/grace-watchers/api-webhooks-grace.cron.ts`
6. `apps/backend/src/modules/platform/billing/grace-watchers/custom-domain-grace.cron.ts`
7. `apps/backend/src/modules/platform/billing/send-limit-warning/send-limit-warning.cron.ts`
8. `apps/backend/src/modules/ops/cron-tasks/reconcile-usage-counters/reconcile-usage-counters.handler.ts` (outer `execute()` calls `$allTenants` before the per-org `cls.run` loop)
9. `apps/backend/src/modules/identity/invite-user/invite-user.handler.ts` (called from `POST /auth/invite` with only `JwtGuard`, no `SuperAdminContextInterceptor`)

For any additional files surfaced by Task 1's sweep, apply the same template.

**Special note on `dunning-retry.service.ts`:** Once `dunning-retry.cron.ts` is wrapped (item 1), the cron establishes the CLS context for the entire `DunningRetryService.retryInvoice()` call chain. However, `DunningRetryService` can also be called from admin manual-retry endpoints — if those endpoints already go through `SuperAdminContextInterceptor`, the service is double-covered (fine, idempotent). If not, wrap the service's public `retryInvoice()` method directly.

**Special note on `invite-user.handler.ts`:** This is called from a regular tenant HTTP route. The `$allTenants.membership.findFirst()` is a cross-tenant lookup (checking if the email already has an active membership in the given org). Option A applies here too: nest the lookup in its own `cls.run`. The handler must inject `ClsService`.

**Special note on `reconcile-usage-counters.handler.ts`:** The per-org loop already sets the key inside each `cls.run()` iteration, but the initial `$allTenants.organization.findMany` at line ~39 runs OUTSIDE any wrap. The fix is to add an outer `cls.run` in `execute()` that wraps the entire body:

```ts
async execute(): Promise<{ orgsScanned: number; rowsRepaired: number }> {
  return this.cls.run(async () => {
    this.cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
    return this.runReconciliation();
  });
}

private async runReconciliation(): Promise<{ orgsScanned: number; rowsRepaired: number }> {
  const orgs = await this.prisma.$allTenants.organization.findMany({
    // ... existing query
  });
  // ... rest of existing execute() body
}
```

---

### Per-file fix template (apply once per BROKEN file)

Replace `<FILE_PATH>`, `<CLASS_NAME>`, `<METHOD_NAME>`, `<SPEC_FILE_PATH>`, and `<COMMIT_SUFFIX>` with values specific to the target file.

#### Step 4.N.1 — Read and understand

- [ ] Read `<FILE_PATH>` and its corresponding spec `<SPEC_FILE_PATH>`.
- [ ] Identify: (a) which method(s) call `$allTenants`, (b) whether `ClsService` is already injected, (c) whether a `private runX()` split is needed.

#### Step 4.N.2 — Add failing test

Add to `<SPEC_FILE_PATH>`:

```ts
import { ClsService } from 'nestjs-cls';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '<relative-path>/common/tenant/tenant.constants';

// CLS mock helper (add once per spec file):
const buildCls = () => {
  const store = new Map<string, unknown>();
  return {
    run: jest.fn((fn: () => Promise<unknown>) => fn()),
    set: jest.fn((key: string, value: unknown) => store.set(key, value)),
    get: jest.fn((key: string) => store.get(key)),
  } as unknown as ClsService;
};

it('wraps execution in super-admin CLS context so $allTenants does not throw', async () => {
  const cls = buildCls();
  // Construct the class under test with existing mocks + cls as the new last argument.
  const instance = new <CLASS_NAME>(
    /* ... existing mock args ... */,
    cls,
  );

  await instance.<METHOD_NAME>(/* minimal args */);

  expect(cls.run).toHaveBeenCalledTimes(1);
  expect(cls.set).toHaveBeenCalledWith(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
});
```

Run:

```bash
cd apps/backend && npx jest --testPathPattern <SPEC_FILE_NAME> --runInBand 2>&1 | tail -20
```

Confirm the test fails.

#### Step 4.N.3 — Apply the fix

1. Add imports at top of `<FILE_PATH>`:

   ```ts
   import { ClsService } from 'nestjs-cls';
   import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '<relative-path>/common/tenant/tenant.constants';
   ```

2. Add `private readonly cls: ClsService` as the last constructor parameter.

3. In the entry method (`execute()` / `run()` / `retryInvoice()` etc.), after any early-return guard (e.g. `BILLING_CRON_ENABLED` check), wrap the body in:

   ```ts
   await this.cls.run(async () => {
     this.cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
     await this.runBody(); // extract existing body into a private method
   });
   ```

4. Extract the existing method body into a new `private async runBody(): Promise<void>` (or `private async run<ClassName>(): Promise<void>`). Keep the extracted body 100% unchanged.

#### Step 4.N.4 — Confirm green

```bash
cd apps/backend && npx jest --testPathPattern <SPEC_FILE_NAME> --runInBand 2>&1 | tail -20
```

All tests in the spec file must pass.

#### Step 4.N.5 — Commit

```bash
git commit -m "fix(<module>): wrap <CLASS_NAME> in super-admin CLS context (<COMMIT_SUFFIX>)"
```

---

## Task 5 — Add regression guard

Create `apps/backend/test/unit/architecture/all-tenants-cls-guard.spec.ts`.

This test performs a static analysis pass: it reads every non-spec source file under `src/modules/` (excluding `src/modules/platform/admin/` which is fenced by the interceptor), finds files containing `$allTenants.`, and asserts that each such file also contains `SUPER_ADMIN_CONTEXT_CLS_KEY`. Any file that uses `$allTenants` without declaring the key is on the allowlist OR is a violation.

**Full test file to create:**

```ts
/**
 * Architecture guard: every file outside src/modules/platform/admin/ that
 * calls prisma.$allTenants must also reference SUPER_ADMIN_CONTEXT_CLS_KEY
 * in the same file — either to set it (cls.set) or to show awareness of the
 * requirement (import).
 *
 * This is a static heuristic. It catches the most common mistake: a developer
 * adds a new $allTenants call without establishing the context. It does NOT
 * verify that the set() call is executed before the $allTenants call at
 * runtime — for that, rely on the e2e tests.
 *
 * To add an intentional exception (e.g. a file that is only ever called from
 * code that already established the context and you've confirmed this by
 * tracing callers), add the relative path from `src/` to the ALLOWLIST below
 * with a comment explaining why it is safe.
 */

import * as fs from 'fs';
import * as path from 'path';

// Files that use $allTenants but are exempt from the CLS key requirement
// because they are only ever called from code that already established the context.
// EACH entry must have a comment explaining the caller chain.
const ALLOWLIST: string[] = [
  // Example (remove once the actual list is known after Task 1 audit):
  // 'modules/platform/billing/downgrade-safety/downgrade-safety.service.ts',
  // ^ Only called from DowngradePlanHandler (admin, safe) and
  //   process-scheduled-plan-changes.cron.ts (fixed in Task 2, which wraps before calling).
];

const SRC_ROOT = path.resolve(__dirname, '../../../src');
const ADMIN_MODULE = path.join(SRC_ROOT, 'modules', 'platform', 'admin');

function collectFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(full));
    } else if (entry.isFile() && full.endsWith('.ts') && !full.endsWith('.spec.ts')) {
      files.push(full);
    }
  }
  return files;
}

describe('Architecture: $allTenants CLS guard', () => {
  it('every file that calls $allTenants also references SUPER_ADMIN_CONTEXT_CLS_KEY', () => {
    const modulesDir = path.join(SRC_ROOT, 'modules');
    const allFiles = collectFiles(modulesDir);

    const violations: string[] = [];

    for (const file of allFiles) {
      // Skip the admin module — it's fenced by SuperAdminContextInterceptor at the controller layer.
      if (file.startsWith(ADMIN_MODULE)) continue;

      const content = fs.readFileSync(file, 'utf-8');
      if (!content.includes('$allTenants.')) continue;

      const relPath = path.relative(SRC_ROOT, file);

      // Check allowlist.
      if (ALLOWLIST.some((allowed) => relPath.endsWith(allowed))) continue;

      // Must reference the CLS key somewhere in the file.
      if (!content.includes('SUPER_ADMIN_CONTEXT_CLS_KEY')) {
        violations.push(relPath);
      }
    }

    if (violations.length > 0) {
      const msg = [
        '',
        'The following files call prisma.$allTenants without referencing SUPER_ADMIN_CONTEXT_CLS_KEY.',
        'Either:',
        '  (a) Wrap the $allTenants call in cls.run(() => { cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true); ... })',
        '  (b) Add the file to the ALLOWLIST in this spec with a comment explaining the safe caller chain.',
        '',
        ...violations.map((v) => `  - src/${v}`),
        '',
      ].join('\n');
      expect(violations).toEqual([]); // fail with the message below
      fail(msg);
    }

    expect(violations).toHaveLength(0);
  });
});
```

- [ ] 5.1 Create the file above at `apps/backend/test/unit/architecture/all-tenants-cls-guard.spec.ts`. Ensure the `tsconfig` for unit tests includes `test/unit/**` (verify with `cat apps/backend/tsconfig.json | grep -A5 include`).

- [ ] 5.2 Run:

  ```bash
  cd apps/backend && npx jest --testPathPattern all-tenants-cls-guard --runInBand 2>&1 | tail -30
  ```

  After all Tasks 2–4 fixes are applied, this test must pass with zero violations.

- [ ] 5.3 Commit:

  ```
  test(architecture): guard against $allTenants without super-admin CLS context
  ```

---

## Task 6 — Final e2e run and summary

- [ ] 6.1 Run the full four-spec suite:

  ```bash
  cd apps/backend && npx jest --config test/jest-e2e.json \
    --testPathPattern "(zoom-credential-lifecycle|dunning-retry|partial-refund-reconciliation|cache-invalidation-edge)" \
    --runInBand 2>&1 | tail -30
  ```

  Expected outcomes after this plan is fully applied:

  | Spec | Before | After |
  |---|---|---|
  | `dunning-retry.e2e-spec.ts` case 3 | FAIL (`super_admin_context_required`) | PASS |
  | `dunning-retry.e2e-spec.ts` case 6 | FAIL (`super_admin_context_required`) | PASS |
  | `cache-invalidation-edge.e2e-spec.ts` case 5 | FAIL (`super_admin_context_required`) | PASS |
  | `zoom-credential-lifecycle.e2e-spec.ts` | 1 FAIL (Zoom race condition — separate bug, out of scope) | unchanged |
  | `partial-refund-reconciliation.e2e-spec.ts` | 1 FAIL (counter lag — separate bug, out of scope) | unchanged |

  Net result: 18 pass / 2 fail (the 2 remaining failures are unrelated to CLS context).

- [ ] 6.2 Check for a CHANGELOG:

  ```bash
  git ls-files | grep -i changelog | head -3
  ```

  If one exists, append a note under the current `[Unreleased]` section:

  ```markdown
  ### Fixed
  - Wrap all out-of-HTTP crons and background services in `super-admin CLS context`
    so `prisma.$allTenants` calls do not throw `ForbiddenException` outside the
    admin HTTP request lifecycle. Fixes silent dunning payment-record failures and
    scheduled plan-change cron failures. (Tasks 2–4 of CLS context audit plan.)
  ```

  If no CHANGELOG exists, skip this step.

- [ ] 6.3 Final commit (only if CHANGELOG was updated):

  ```
  chore(changelog): note super-admin CLS context audit fixes
  ```

---

## Definition of Done

- [ ] `ls -la /Users/tariq/code/carekit/docs/superpowers/plans/2026-05-04-super-admin-cls-context-audit.md` — non-zero size (this file).
- [ ] `docs/superpowers/specs/2026-05-04-cls-audit-matrix.md` — exists and contains the sweep-verified classification table.
- [ ] `apps/backend/test/unit/architecture/all-tenants-cls-guard.spec.ts` — exists and passes with zero violations.
- [ ] `npx jest --testPathPattern "(dunning-retry|cache-invalidation-edge)" --config test/jest-e2e.json --runInBand` — cases 3, 5, 6 pass.
- [ ] No new `ForbiddenException: super_admin_context_required` errors in cron/background worker logs.
- [ ] Every BROKEN file from the Task 1 matrix has a corresponding fix commit.
