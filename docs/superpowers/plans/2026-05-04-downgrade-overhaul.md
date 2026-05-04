# Downgrade Overhaul — Implementation Plan

> **For agentic workers:** This plan is executed by the parent Opus agent as supervisor and `sonnet-executor` as worker, one Phase per dispatch. Steps use checkbox (`- [ ]`) syntax for tracking. Phases must be merged in order.

**Goal:** Make tenant-initiated plan downgrade work end-to-end (counter integrity, boolean safety, hybrid retention, manual-only quantitative resolution, actionable UI), per the spec at `docs/superpowers/specs/2026-05-04-downgrade-overhaul-design.md`.

**Architecture:** Five sequential phases on `feat/downgrade-overhaul`. Each phase = one PR, merged green into the feature branch. Final PR `feat/downgrade-overhaul → main` after Phase 5.

**Tech Stack:** NestJS 11, Prisma 7, BullMQ, Next.js 15 (dashboard + admin), Vitest + Jest + Playwright, Kiwi TCMS for manual QA sync.

**Branch:** `feat/downgrade-overhaul` (already created from `main`).

---

## Phase 1 — Counter Integrity & Cleanup

**Goal:** Counters reflect *active* entity counts. ZATCA always-on. STORAGE removed entirely. Schema migrations land.

**Files:**
- Create: `apps/backend/src/modules/org-config/events/branch-deactivated.event.ts`
- Create: `apps/backend/src/modules/org-config/events/branch-reactivated.event.ts`
- Create: `apps/backend/src/modules/people/events/employee-deactivated.event.ts`
- Create: `apps/backend/src/modules/people/events/employee-reactivated.event.ts`
- Create: `apps/backend/src/modules/org-experience/events/service-deactivated.event.ts`
- Create: `apps/backend/src/modules/org-experience/events/service-reactivated.event.ts`
- Create: `apps/backend/src/modules/platform/billing/usage-counter/decrement-on-lifecycle.listener.ts`
- Create: `apps/backend/src/modules/platform/billing/usage-counter/decrement-on-lifecycle.listener.spec.ts`
- Create: `apps/backend/scripts/billing/recompute-all-counters.ts`
- Modify: `apps/backend/src/modules/org-config/branches/update-branch.handler.ts` — emit deactivated/reactivated events on isActive transition
- Modify: `apps/backend/src/modules/people/employees/update-employee.handler.ts` — same
- Modify: `apps/backend/src/modules/org-experience/services/update-service.handler.ts` — same
- Modify: `apps/backend/src/modules/platform/billing/feature.guard.ts:206` — add `isActive: true` filter for Employee
- Modify: `apps/backend/src/modules/platform/billing/feature.guard.ts:221-227` — remove STORAGE branch
- Modify: `apps/backend/src/modules/platform/billing/downgrade-safety/downgrade-safety.service.ts:122-125` — add `isActive: true` filter
- Modify: `apps/backend/src/modules/platform/billing/downgrade-safety/downgrade-safety.service.ts:57-65` — remove STORAGE from HARD_CAP_DIMENSIONS
- Modify: `apps/backend/src/modules/platform/billing/usage-counter/increment-usage.listener.ts` — remove `media.file.uploaded` subscription
- Modify: `apps/backend/src/modules/platform/billing/plan-limits.zod.ts` — remove `maxStorageMB`, `overageRateStorageGB`, `zatca`
- Modify: `apps/admin/features/plans/plan-limits.zod.ts` — mirror the above
- Modify: `packages/shared/constants/feature-keys.ts` — remove `ZATCA`, `STORAGE`
- Modify: `packages/shared/constants/feature-catalog.ts` — remove ZATCA + STORAGE rows
- Modify: `apps/backend/src/modules/platform/billing/feature-key-map.ts` — remove ZATCA + STORAGE entries
- Modify: `apps/backend/src/api/dashboard/zatca.controller.ts` — remove `@RequireFeature(FeatureKey.ZATCA)` from every method
- Create: `apps/backend/prisma/migrations/<timestamp>_downgrade_overhaul_p1/migration.sql` — adds grace columns (Subscription.apiAccessGraceUntil, Subscription.webhooksGraceUntil, OrganizationSettings.customDomainGraceUntil); seeds zatca:true; deletes storage UsageCounter rows
- Modify: `apps/backend/prisma/schema/billing.prisma` — add the two grace columns to Subscription
- Modify: `apps/backend/prisma/schema/org-experience.prisma` — add customDomainGraceUntil to OrganizationSettings (or wherever it lives)
- Test: `apps/backend/src/modules/org-config/branches/update-branch.handler.spec.ts` — add deactivated/reactivated event assertions
- Test: `apps/backend/src/modules/people/employees/update-employee.handler.spec.ts` — same
- Test: `apps/backend/src/modules/org-experience/services/update-service.handler.spec.ts` — same
- Test: `apps/backend/src/modules/platform/billing/downgrade-safety/downgrade-safety.service.spec.ts` — update for STORAGE removal + isActive fix
- Test: `apps/backend/src/modules/platform/billing/feature.guard.spec.ts` — update for STORAGE removal + isActive fix + ZATCA removal
- Test: `apps/backend/src/api/dashboard/zatca.controller.spec.ts` (or e2e equivalent) — confirm endpoints work on a basic plan

---

### Task 1.1: Create deactivated/reactivated event classes

- [ ] **Step 1: Create branch deactivated event**

```typescript
// apps/backend/src/modules/org-config/events/branch-deactivated.event.ts
import { BaseEvent } from '../../../common/events';

export interface BranchDeactivatedPayload {
  branchId: string;
  organizationId: string;
}

export class BranchDeactivatedEvent extends BaseEvent<BranchDeactivatedPayload> {
  readonly eventName = 'org-config.branch.deactivated';

  constructor(payload: BranchDeactivatedPayload) {
    super({ source: 'org-config', version: 1, payload });
  }
}
```

- [ ] **Step 2: Create branch reactivated event**

```typescript
// apps/backend/src/modules/org-config/events/branch-reactivated.event.ts
import { BaseEvent } from '../../../common/events';

export interface BranchReactivatedPayload {
  branchId: string;
  organizationId: string;
}

export class BranchReactivatedEvent extends BaseEvent<BranchReactivatedPayload> {
  readonly eventName = 'org-config.branch.reactivated';

  constructor(payload: BranchReactivatedPayload) {
    super({ source: 'org-config', version: 1, payload });
  }
}
```

- [ ] **Step 3: Repeat for employee** at `apps/backend/src/modules/people/events/employee-deactivated.event.ts` and `employee-reactivated.event.ts` with `eventName = 'people.employee.deactivated'` / `'people.employee.reactivated'` and `source: 'people'`.

- [ ] **Step 4: Repeat for service** at `apps/backend/src/modules/org-experience/events/service-deactivated.event.ts` and `service-reactivated.event.ts` with `eventName = 'org-experience.service.deactivated'` / `'org-experience.service.reactivated'` and `source: 'org-experience'`.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/org-config/events/branch-deactivated.event.ts \
        apps/backend/src/modules/org-config/events/branch-reactivated.event.ts \
        apps/backend/src/modules/people/events/employee-deactivated.event.ts \
        apps/backend/src/modules/people/events/employee-reactivated.event.ts \
        apps/backend/src/modules/org-experience/events/service-deactivated.event.ts \
        apps/backend/src/modules/org-experience/events/service-reactivated.event.ts
git commit -m "feat(billing/p1): add lifecycle events for branch/employee/service activation toggles"
```

### Task 1.2: Wire events into update handlers

- [ ] **Step 1: Write failing test for branch update emitting deactivated event**

In `apps/backend/src/modules/org-config/branches/update-branch.handler.spec.ts` add:

```typescript
it('emits BranchDeactivatedEvent when isActive transitions true → false', async () => {
  const eventBus = mockEventBus();
  // arrange branch with isActive: true
  await handler.execute({ branchId, isActive: false });
  expect(eventBus.publish).toHaveBeenCalledWith(
    expect.objectContaining({ eventName: 'org-config.branch.deactivated', payload: { branchId, organizationId } })
  );
});

it('emits BranchReactivatedEvent when isActive transitions false → true', async () => {
  // mirror test
});

it('emits no lifecycle event when isActive does not change', async () => {
  // arrange branch with isActive: true
  await handler.execute({ branchId, isActive: true });
  expect(eventBus.publish).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run** `cd apps/backend && npx jest update-branch.handler.spec.ts` → expect FAIL.

- [ ] **Step 3: Modify `update-branch.handler.ts`** to inject `EventBusService`, capture the previous `isActive` (already loaded in `tx.branch.findFirst`), and after the update emit the appropriate event when the value transitions:

```typescript
const wasActive = branch.isActive;
const updated = await tx.branch.update({ /* existing */ });
if (dto.isActive !== undefined && dto.isActive !== wasActive) {
  const event = dto.isActive
    ? new BranchReactivatedEvent({ branchId: updated.id, organizationId })
    : new BranchDeactivatedEvent({ branchId: updated.id, organizationId });
  await this.eventBus.publish(event).catch(() => undefined);
}
return updated;
```

- [ ] **Step 4: Run** the test → expect PASS.

- [ ] **Step 5: Repeat steps 1-4 for `update-employee.handler.ts`** with `EmployeeDeactivatedEvent` / `EmployeeReactivatedEvent`. Note: the `Employee` entity may not have a direct `isActive` toggle on the update DTO — verify the field is in the DTO; if missing, add it.

- [ ] **Step 6: Repeat steps 1-4 for `update-service.handler.ts`** with `ServiceDeactivatedEvent` / `ServiceReactivatedEvent`.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/org-config/branches/ \
        apps/backend/src/modules/people/employees/ \
        apps/backend/src/modules/org-experience/services/
git commit -m "feat(billing/p1): emit lifecycle events from update handlers on isActive transitions"
```

### Task 1.3: Decrement listener

- [ ] **Step 1: Create `decrement-on-lifecycle.listener.ts`** modeled after `increment-usage.listener.ts`:

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { EventBusService } from '../../../../infrastructure/events';
import { UsageCounterService } from './usage-counter.service';
import { EPOCH } from './period.util';

interface LifecyclePayload {
  organizationId: string;
}

@Injectable()
export class DecrementOnLifecycleListener implements OnModuleInit {
  private readonly logger = new Logger(DecrementOnLifecycleListener.name);

  constructor(
    private readonly counters: UsageCounterService,
    private readonly eventBus: EventBusService,
  ) {}

  onModuleInit(): void {
    this.subscribeDecrement('org-config.branch.deactivated', FeatureKey.BRANCHES);
    this.subscribeIncrement('org-config.branch.reactivated', FeatureKey.BRANCHES);
    this.subscribeDecrement('people.employee.deactivated', FeatureKey.EMPLOYEES);
    this.subscribeIncrement('people.employee.reactivated', FeatureKey.EMPLOYEES);
    this.subscribeDecrement('org-experience.service.deactivated', FeatureKey.SERVICES);
    this.subscribeIncrement('org-experience.service.reactivated', FeatureKey.SERVICES);
  }

  private subscribeDecrement(eventName: string, key: FeatureKey) {
    this.eventBus.subscribe<LifecyclePayload>(eventName, async (envelope) => {
      const { organizationId } = envelope.payload;
      await this.counters
        .increment(organizationId, key, EPOCH, -1)
        .catch((err: unknown) =>
          this.logger.error({ err, organizationId, key }, 'usage_counter_decrement_failed'),
        );
    });
  }

  private subscribeIncrement(eventName: string, key: FeatureKey) {
    this.eventBus.subscribe<LifecyclePayload>(eventName, async (envelope) => {
      const { organizationId } = envelope.payload;
      await this.counters
        .increment(organizationId, key, EPOCH, 1)
        .catch((err: unknown) =>
          this.logger.error({ err, organizationId, key }, 'usage_counter_reincrement_failed'),
        );
    });
  }
}
```

- [ ] **Step 2: Verify `UsageCounterService.increment` accepts negative deltas** — read `usage-counter.service.ts`. If `increment(orgId, key, period, delta)` clamps to ≥ 0, that's fine; if it forbids negatives, change it to clamp at 0 (never below). Keep the change minimal and add a one-line spec asserting the clamp.

- [ ] **Step 3: Write spec `decrement-on-lifecycle.listener.spec.ts`** covering all six event subscriptions (3 decrement, 3 increment) using the existing event-bus mock pattern from `increment-usage.listener.spec.ts`.

- [ ] **Step 4: Register the listener in `BillingModule`** — add to providers + ensure `OnModuleInit` runs. Check `billing.module.ts` for the pattern used by `IncrementUsageListener`.

- [ ] **Step 5: Run** `cd apps/backend && npx jest decrement-on-lifecycle` → expect PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/platform/billing/usage-counter/decrement-on-lifecycle.listener.ts \
        apps/backend/src/modules/platform/billing/usage-counter/decrement-on-lifecycle.listener.spec.ts \
        apps/backend/src/modules/platform/billing/usage-counter/usage-counter.service.ts \
        apps/backend/src/modules/platform/billing/billing.module.ts
git commit -m "feat(billing/p1): decrement-on-lifecycle listener for branches/employees/services"
```

### Task 1.4: Fix Employee recompute (isActive filter)

- [ ] **Step 1: Update spec for `feature.guard.spec.ts`** to assert that `recomputeFromSource` for `EMPLOYEES` returns count of active only:

```typescript
it('counts only active employees in EMPLOYEES recompute', async () => {
  await prisma.employee.createMany({ data: [
    { organizationId, name: 'A', isActive: true },
    { organizationId, name: 'B', isActive: false },
  ]});
  const count = await guard['recomputeFromSource'](FeatureKey.EMPLOYEES, organizationId, EPOCH);
  expect(count).toBe(1);
});
```

- [ ] **Step 2: Run** → expect FAIL (returns 2).

- [ ] **Step 3: Patch `feature.guard.ts:206`** to `where: { organizationId, isActive: true }`.

- [ ] **Step 4: Patch `downgrade-safety.service.ts:122-125`** identically.

- [ ] **Step 5: Update `downgrade-safety.service.spec.ts`** if it has corresponding asserts.

- [ ] **Step 6: Run** all billing specs → expect PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/platform/billing/
git commit -m "fix(billing/p1): recompute employees by isActive=true"
```

### Task 1.5: Remove STORAGE end-to-end

- [ ] **Step 1: Remove `STORAGE` from `packages/shared/constants/feature-keys.ts`**.

- [ ] **Step 2: Remove the STORAGE entry from `packages/shared/constants/feature-catalog.ts`**.

- [ ] **Step 3: Remove `STORAGE` mapping from `apps/backend/src/modules/platform/billing/feature-key-map.ts`**.

- [ ] **Step 4: Remove `maxStorageMB` and `overageRateStorageGB`** from `plan-limits.zod.ts` (backend) and the admin mirror, plus from `DEFAULT_PLAN_LIMITS`.

- [ ] **Step 5: Remove `STORAGE` from `HARD_CAP_DIMENSIONS`** in `downgrade-safety.service.ts:57-65`.

- [ ] **Step 6: Remove the STORAGE branch** from `recomputeFromSource` in both `feature.guard.ts:221-227` and `downgrade-safety.service.ts`.

- [ ] **Step 7: Remove the `media.file.uploaded` subscription** from `increment-usage.listener.ts`.

- [ ] **Step 8: Run typecheck across the monorepo** — `pnpm -w typecheck`. Fix any consumer that referenced `FeatureKey.STORAGE` or `maxStorageMB`. Likely sites: admin plan editor (`apps/admin/features/plans/`), dashboard usage widget, dashboard plan-comparison grid, feature matrix, billing translations.

- [ ] **Step 9: Run all backend specs** — `cd apps/backend && npm test`. Update any spec that referenced STORAGE.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor(billing/p1): remove STORAGE from feature registry, plans, counters, UI"
```

### Task 1.6: Remove ZATCA from feature toggle

- [ ] **Step 1: Remove `ZATCA` from `feature-keys.ts`, `feature-catalog.ts`, `feature-key-map.ts`**.

- [ ] **Step 2: Remove `zatca: z.boolean()` from `plan-limits.zod.ts` (backend + admin mirror) and `DEFAULT_PLAN_LIMITS`**.

- [ ] **Step 3: Remove `@RequireFeature(FeatureKey.ZATCA)` from every method** in `apps/backend/src/api/dashboard/zatca.controller.ts`. Also remove the `FeatureKey` import if no other reference remains.

- [ ] **Step 4: `rg -n "FeatureKey.ZATCA|'zatca'" apps/ packages/`** — for every hit, decide: if it's the toggle (zod / catalog / decorator), remove. If it's an actual ZATCA business path (controller, service, schema), leave alone.

- [ ] **Step 5: Update or remove specs** that asserted "ZATCA endpoint blocks on basic plan." They now expect 200.

- [ ] **Step 6: Add an e2e spec** at `apps/backend/test/e2e/zatca-always-on.e2e.spec.ts` confirming `/dashboard/zatca/*` returns 2xx for an org on the lowest-tier plan.

- [ ] **Step 7: Run** all specs → expect PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(billing/p1): make ZATCA always-on, remove from feature registry"
```

### Task 1.7: Schema migration & data migration

- [ ] **Step 1: Edit `apps/backend/prisma/schema/billing.prisma`** to add to `Subscription`:

```prisma
apiAccessGraceUntil  DateTime?
webhooksGraceUntil   DateTime?
```

- [ ] **Step 2: Edit `apps/backend/prisma/schema/org-experience.prisma`** (or wherever `OrganizationSettings` lives — verify with `rg -n "model OrganizationSettings"`) to add:

```prisma
customDomainGraceUntil DateTime?
```

- [ ] **Step 3: Generate migration** — `cd apps/backend && npm run prisma:migrate -- --name downgrade_overhaul_p1`. Verify the produced SQL matches expected ALTER TABLE statements.

- [ ] **Step 4: Edit the generated `migration.sql`** to also include:

```sql
-- Seed zatca = true on all existing plan limits (idempotent)
UPDATE "Plan" SET limits = jsonb_set(limits, '{zatca}', 'true', true);

-- Remove obsolete storage counters
DELETE FROM "UsageCounter" WHERE "featureKey" = 'storage';
```

- [ ] **Step 5: Re-run** `npm run prisma:migrate` to apply.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/prisma/
git commit -m "feat(billing/p1): migration — grace columns, zatca always-on, drop storage counters"
```

### Task 1.8: Backfill script

- [ ] **Step 1: Create `apps/backend/scripts/billing/recompute-all-counters.ts`**:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/infrastructure/database';
import { UsageCounterService } from '../../src/modules/platform/billing/usage-counter/usage-counter.service';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { EPOCH, startOfMonthUTC } from '../../src/modules/platform/billing/usage-counter/period.util';
import { BookingStatus } from '@prisma/client';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const counters = app.get(UsageCounterService);

  const orgs = await prisma.$allTenants.organization.findMany({ select: { id: true } });
  const startOfMonth = startOfMonthUTC();

  for (const { id: orgId } of orgs) {
    const branches = await prisma.$allTenants.branch.count({ where: { organizationId: orgId, isActive: true } });
    const employees = await prisma.$allTenants.employee.count({ where: { organizationId: orgId, isActive: true } });
    const services = await prisma.$allTenants.service.count({ where: { organizationId: orgId, isActive: true } });
    const bookings = await prisma.$allTenants.booking.count({
      where: { organizationId: orgId, scheduledAt: { gte: startOfMonth }, status: { not: BookingStatus.CANCELLED } },
    });

    await counters.upsertExact(orgId, FeatureKey.BRANCHES, EPOCH, branches);
    await counters.upsertExact(orgId, FeatureKey.EMPLOYEES, EPOCH, employees);
    await counters.upsertExact(orgId, FeatureKey.SERVICES, EPOCH, services);
    await counters.upsertExact(orgId, FeatureKey.MONTHLY_BOOKINGS, startOfMonth, bookings);

    console.log(`[backfill] ${orgId} → branches=${branches} employees=${employees} services=${services} bookings=${bookings}`);
  }

  await app.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Add npm script** in `apps/backend/package.json`: `"backfill:counters": "ts-node scripts/billing/recompute-all-counters.ts"`.

- [ ] **Step 3: Run dry locally** against the dev DB. Capture output. Verify counts look right vs Prisma Studio for one known org.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/scripts/billing/ apps/backend/package.json
git commit -m "feat(billing/p1): one-shot recompute-all-counters backfill script"
```

### Task 1.9: Phase 1 verification & PR

- [ ] **Step 1: Run** `cd apps/backend && npm run typecheck && npm run lint && npm test` → all green.

- [ ] **Step 2: Run** `pnpm -w typecheck` from the repo root to catch shared-package consumers.

- [ ] **Step 3: Push branch** — `git push -u origin feat/downgrade-overhaul`.

- [ ] **Step 4: Open PR** with title "feat(billing): phase 1 — counter integrity, ZATCA always-on, STORAGE removed" and the body summarizing tasks 1.1-1.8.

- [ ] **Step 5: Wait for CI green; merge.**

---

## Phase 2 — Boolean Downgrade Safety

**Goal:** `DowngradeSafetyService` checks every boolean feature for in-flight data and returns a structured violations list.

**Files:**
- Modify: `apps/backend/src/modules/platform/billing/downgrade-safety/downgrade-safety.service.ts` — add boolean-check map + `checkBooleanDowngrade` method
- Modify: `apps/backend/src/modules/platform/billing/downgrade-safety/downgrade-precheck.exception.ts` — extend `DowngradeViolation` shape with `kind` discriminator + boolean fields
- Modify: `apps/backend/src/modules/platform/billing/downgrade-plan/downgrade-plan.handler.ts` — pass merged violations
- Modify: `apps/backend/src/modules/platform/billing/schedule-downgrade/schedule-downgrade.handler.ts` — same
- Modify: `apps/backend/src/modules/platform/billing/process-scheduled-plan-changes/process-scheduled-plan-changes.cron.ts` — re-check both quantitative and boolean at swap-time
- Test: `apps/backend/src/modules/platform/billing/downgrade-safety/downgrade-safety.service.spec.ts` — new specs per boolean feature
- Test: `apps/backend/src/modules/platform/billing/downgrade-plan/downgrade-plan.handler.spec.ts` — combined-violation case
- Test: `apps/backend/src/modules/platform/billing/schedule-downgrade/schedule-downgrade.handler.spec.ts` — same

---

### Task 2.1: Extend the violation shape

- [ ] **Step 1: Replace `DowngradeViolation`** in `downgrade-safety.service.ts`:

```typescript
export interface QuantitativeViolation {
  kind: 'QUANTITATIVE';
  featureKey: typeof FeatureKey.BRANCHES | typeof FeatureKey.EMPLOYEES | typeof FeatureKey.MONTHLY_BOOKINGS;
  current: number;
  targetMax: number;
}

export interface BooleanViolation {
  kind: 'BOOLEAN';
  featureKey: FeatureKey;
  blockingResources: {
    count: number;
    sampleIds: string[];
    deepLink: string;
  };
}

export type DowngradeViolation = QuantitativeViolation | BooleanViolation;
```

- [ ] **Step 2: Update `DowngradeCheckResult`** to use the union.

- [ ] **Step 3: Update `DowngradePrecheckExceptionBody`** in `downgrade-precheck.exception.ts` accordingly.

- [ ] **Step 4: Run typecheck** — fix any consumer (the dashboard types regen comes in Phase 4).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/platform/billing/downgrade-safety/
git commit -m "refactor(billing/p2): discriminated DowngradeViolation (QUANTITATIVE|BOOLEAN)"
```

### Task 2.2: Boolean check map

- [ ] **Step 1: Define the map** at the top of `downgrade-safety.service.ts`:

```typescript
type BooleanCheck = (orgId: string, prisma: PrismaService) => Promise<{ count: number; sampleIds: string[]; deepLink: string } | null>;

const BOOLEAN_CHECKS: Partial<Record<FeatureKey, BooleanCheck>> = {
  [FeatureKey.RECURRING_BOOKINGS]: async (orgId, prisma) => {
    const rows = await prisma.$allTenants.recurringBookingTemplate.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true },
      take: 3,
    });
    if (rows.length === 0) return null;
    const total = await prisma.$allTenants.recurringBookingTemplate.count({ where: { organizationId: orgId, isActive: true } });
    return { count: total, sampleIds: rows.map(r => r.id), deepLink: '/bookings/recurring' };
  },
  [FeatureKey.WAITLIST]: async (orgId, prisma) => { /* similar */ },
  [FeatureKey.GROUP_SESSIONS]: async (orgId, prisma) => { /* future bookings with groupSessionId */ },
  [FeatureKey.AI_CHATBOT]: async (orgId, prisma) => { /* knowledge base articles */ },
  [FeatureKey.EMAIL_TEMPLATES]: async (orgId, prisma) => { /* active templates */ },
  [FeatureKey.COUPONS]: async (orgId, prisma) => { /* active + non-expired coupons */ },
  [FeatureKey.INTAKE_FORMS]: async (orgId, prisma) => { /* active forms */ },
  [FeatureKey.CUSTOM_ROLES]: async (orgId, prisma) => { /* custom roles */ },
  [FeatureKey.ZOOM_INTEGRATION]: async (orgId, prisma) => { /* ZoomCredential present */ },
  [FeatureKey.BANK_TRANSFER_PAYMENTS]: async (orgId, prisma) => { /* pending bank transfers */ },
  [FeatureKey.DEPARTMENTS]: async (orgId, prisma) => { /* departments */ },
  [FeatureKey.SMS_PROVIDER_PER_TENANT]: async (orgId, prisma) => { /* OrganizationSmsConfig present */ },
  [FeatureKey.MULTI_CURRENCY]: async (orgId, prisma) => { /* open invoices in non-default currency */ },
  // CUSTOM_DOMAIN, API_ACCESS, WEBHOOKS, WHITE_LABEL_MOBILE handled by grace policy in Phase 3 — return null here (no precheck violation).
  // ACTIVITY_LOG, WALK_IN_BOOKINGS, CLIENT_RATINGS, DATA_EXPORT, ADVANCED_REPORTS, PRIORITY_SUPPORT, AUDIT_EXPORT — always allow (no in-flight gate).
};
```

Implement each non-null check with the actual Prisma model. For each, verify the model exists by `rg -n "model RecurringBookingTemplate" apps/backend/prisma/schema/`.

- [ ] **Step 2: Add `checkBooleanDowngrade` method** to the service:

```typescript
async checkBooleanDowngrade(currentLimits: PlanLimitsLike, targetLimits: PlanLimitsLike, orgId: string): Promise<BooleanViolation[]> {
  const violations: BooleanViolation[] = [];
  for (const [key, check] of Object.entries(BOOLEAN_CHECKS) as Array<[FeatureKey, BooleanCheck]>) {
    const jsonKey = FEATURE_KEY_MAP[key];
    const wasOn = currentLimits[jsonKey] === true;
    const isOff = targetLimits[jsonKey] !== true;
    if (!wasOn || !isOff) continue;
    const result = await check(orgId, this.prisma);
    if (result) violations.push({ kind: 'BOOLEAN', featureKey: key, blockingResources: result });
  }
  return violations;
}
```

- [ ] **Step 3: Update `checkDowngrade`** to call both and merge:

```typescript
async checkDowngrade(currentPlan, targetPlan, orgId): Promise<DowngradeCheckResult> {
  const targetLimits = readLimits(targetPlan);
  const currentLimits = readLimits(currentPlan);
  const quantitative = await this.checkQuantitativeDowngrade(targetLimits, orgId); // existing logic, renamed
  const boolean = await this.checkBooleanDowngrade(currentLimits, targetLimits, orgId);
  const violations = [...quantitative, ...boolean];
  return { ok: violations.length === 0, violations };
}
```

- [ ] **Step 4: Write specs** — for each boolean check, two cases (data present → violation; data absent → no violation). Use `prisma-mock` or factories already in the spec.

- [ ] **Step 5: Run** specs → expect PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/platform/billing/downgrade-safety/
git commit -m "feat(billing/p2): boolean downgrade safety with per-feature in-flight checks"
```

### Task 2.3: Wire violations into both downgrade handlers and the cron

- [ ] **Step 1: `downgrade-plan.handler.ts`** — already calls `checkDowngrade`; the new merged violations flow through automatically via the updated exception body. Add a spec asserting a combined-violation 422 includes both kinds.

- [ ] **Step 2: `schedule-downgrade.handler.ts`** — same.

- [ ] **Step 3: `process-scheduled-plan-changes.cron.ts`** — at swap-time, call `checkDowngrade` again. If violations exist, do NOT swap. Set `Subscription.scheduledChangeBlockedReason` to a serialized summary, send a notification email to the owner, and skip. Existing column reused.

- [ ] **Step 4: Spec the cron** — case where usage grew between schedule-time and swap-time (e.g. new employees added) → swap is skipped and reason recorded.

- [ ] **Step 5: Run** `npm test` → all green.

- [ ] **Step 6: Commit + PR**

```bash
git add apps/backend/src/modules/platform/billing/
git commit -m "feat(billing/p2): cron re-checks downgrade safety at swap-time and skips with reason"
git push
gh pr create --base feat/downgrade-overhaul --head <phase-2-sub-branch> --title "feat(billing): phase 2 — boolean downgrade safety" --body "Implements §4.2 of the spec."
```

(If you've been committing directly on `feat/downgrade-overhaul` without sub-branches, just push and skip the sub-branch step.)

---

## Phase 3 — Data Retention Enforcement (Hybrid Policy)

**Goal:** Freeze policy enforced at API + background; three named exceptions implemented with grace columns + crons + emails.

**Files:**
- Create: `apps/backend/src/modules/platform/billing/feature-check.service.ts`
- Create: `apps/backend/src/modules/platform/billing/feature-check.service.spec.ts`
- Create: `apps/backend/src/modules/platform/billing/grace-watchers/custom-domain-grace.cron.ts` + spec
- Create: `apps/backend/src/modules/platform/billing/grace-watchers/api-webhooks-grace.cron.ts` + spec
- Create: `apps/backend/src/infrastructure/mail/templates/feature-grace-warning.template.ts`
- Create: `apps/backend/src/infrastructure/mail/templates/feature-grace-expired.template.ts`
- Modify: each background site listed in §4.3.1 of the spec (one task per site)
- Modify: `downgrade-plan.handler.ts` and `process-scheduled-plan-changes.cron.ts` — set grace columns on swap when applicable

---

### Task 3.1: `FeatureCheckService`

- [ ] **Step 1: Create the service**:

```typescript
@Injectable()
export class FeatureCheckService {
  constructor(private readonly cache: SubscriptionCacheService) {}

  async isEnabled(organizationId: string, key: FeatureKey): Promise<boolean> {
    const sub = await this.cache.get(organizationId);
    if (!sub) return false;
    const jsonKey = FEATURE_KEY_MAP[key];
    return sub.limits[jsonKey] === true || (typeof sub.limits[jsonKey] === 'number' && sub.limits[jsonKey] !== 0);
  }
}
```

- [ ] **Step 2: Spec it** — enabled-true, enabled-false, no-subscription, missing-key cases.

- [ ] **Step 3: Export from `BillingModule`**.

- [ ] **Step 4: Run** specs → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/platform/billing/feature-check.service.ts \
        apps/backend/src/modules/platform/billing/feature-check.service.spec.ts \
        apps/backend/src/modules/platform/billing/billing.module.ts
git commit -m "feat(billing/p3): FeatureCheckService for background-effect gating"
```

### Task 3.2: Retrofit background sites (one sub-task per site)

For each row in §4.3.1 of the spec, run this sub-loop:

- [ ] **3.2.a Recurring bookings cron** — inject `FeatureCheckService`, skip emit when `isEnabled(org, RECURRING_BOOKINGS)` is false. Spec the skip-path. Commit.
- [ ] **3.2.b Apply-coupon slice** — same.
- [ ] **3.2.c Webhook dispatcher** — same, but also honor `Subscription.webhooksGraceUntil > now` as an override allowing emit.
- [ ] **3.2.d Send-email custom-template path** — same.
- [ ] **3.2.e Intake-form submission handler** — same.
- [ ] **3.2.f Waitlist auto-promote cron** — same.
- [ ] **3.2.g Zoom-meeting created listener** — same.
- [ ] **3.2.h Bank-transfer upload handler** — same (already has `FeatureGuard` at controller; verify and add a service-level check too if it's reachable from any internal path).
- [ ] **3.2.i Rating-request cron** — same.

Each sub-task = test write → fail → patch → pass → commit.

### Task 3.3: API access grace gate

- [ ] **Step 1: Locate the API key guard** — `rg -n "api.key|ApiKey" apps/backend/src/api/ apps/backend/src/common/auth/`. Edit it to: read `Subscription.apiAccessGraceUntil`, allow if `now < graceUntil`, deny with 402 + structured body otherwise. If feature is enabled in the current plan, allow as before.

- [ ] **Step 2: Spec the three states** — feature on, feature off + within grace, feature off + past grace.

- [ ] **Step 3: Commit**.

### Task 3.4: Webhook dispatcher grace gate

- [ ] **Step 1: Edit dispatcher** — same logic against `Subscription.webhooksGraceUntil`.

- [ ] **Step 2: Spec the three states**.

- [ ] **Step 3: Commit**.

### Task 3.5: Custom domain grace cron

- [ ] **Step 1: Create `custom-domain-grace.cron.ts`** scheduled daily (use the BullMQ cron pattern already in `apps/backend/src/modules/platform/billing/charge-due-subscriptions/`):

```typescript
@Injectable()
export class CustomDomainGraceCron {
  async run() {
    const orgs = await this.prisma.$allTenants.organizationSettings.findMany({
      where: { customDomainGraceUntil: { not: null } },
      select: { organizationId: true, customDomain: true, customDomainGraceUntil: true, organization: { select: { /* owner */ } } },
    });
    for (const org of orgs) {
      const daysLeft = Math.ceil((org.customDomainGraceUntil!.getTime() - Date.now()) / 86_400_000);
      if (daysLeft <= 0) {
        await this.revertDomain(org);
        await this.mailer.sendFeatureGraceExpired(/* … */);
      } else if (daysLeft <= 7) {
        await this.mailer.sendFeatureGraceWarning(/* … */);
      }
    }
  }

  private async revertDomain(org) {
    await this.prisma.$allTenants.organizationSettings.update({
      where: { organizationId: org.organizationId },
      data: { customDomain: null, customDomainGraceUntil: null },
    });
    // DNS revert: out of scope for code (operations runbook), but log a structured event.
  }
}
```

- [ ] **Step 2: Spec the three branches** — > 7 days, ≤ 7 days, ≤ 0 days.

- [ ] **Step 3: Register in cron module**.

- [ ] **Step 4: Commit**.

### Task 3.6: API/Webhooks grace cron (warning-only)

- [ ] **Step 1: Create `api-webhooks-grace.cron.ts`** — daily; for each org with non-null `apiAccessGraceUntil` or `webhooksGraceUntil`, send a warning email when `daysLeft ∈ {6,3,1}`. The actual block is enforced by the guard/dispatcher gates from 3.3 / 3.4. No revert action — the feature is already off; the grace column just stays past-due (and effectively is the "this is over" state).

- [ ] **Step 2: Spec the warning fan-out**.

- [ ] **Step 3: Register**.

- [ ] **Step 4: Commit**.

### Task 3.7: Mail templates

- [ ] **Step 1: Create `feature-grace-warning.template.ts`** — bilingual builder pattern matching existing templates in `apps/backend/src/infrastructure/mail/templates/`. Inputs: `featureKey`, `daysLeft`, `tenantName`, `dashboardUrl`.

- [ ] **Step 2: Create `feature-grace-expired.template.ts`** — confirmation that the feature is now off.

- [ ] **Step 3: Add `sendFeatureGraceWarning` and `sendFeatureGraceExpired` to `PlatformMailerService`**.

- [ ] **Step 4: Spec the templates** — assert AR + EN render, key vars escape.

- [ ] **Step 5: Commit**.

### Task 3.8: Wire grace-column writes on downgrade swap

- [ ] **Step 1: In `downgrade-plan.handler.ts`** (immediate downgrade) — after the plan swap, if the old plan had `custom_domain: true` and the new doesn't AND the org has `customDomain` set, write `customDomainGraceUntil = now + 30d`. Same shape for `api_access` / `webhooks` with `now + 7d`.

- [ ] **Step 2: Same in `process-scheduled-plan-changes.cron.ts`** at the swap moment.

- [ ] **Step 3: Spec both paths**.

- [ ] **Step 4: Commit + push + PR for Phase 3**.

---

## Phase 4 — Dashboard Dialog UI

**Goal:** Tenants see an actionable "Cannot downgrade" Dialog with violation rows + deep links + bilingual copy. Per-feature pages have working Deactivate buttons.

**Files:**
- Create: `apps/dashboard/components/features/billing/downgrade-violations-dialog.tsx`
- Create: `apps/dashboard/hooks/use-downgrade-violations.ts`
- Modify: `apps/dashboard/lib/api/billing.ts` — handle 422 response shape, expose `downgradeViolations(planId, billingCycle)` reading the same body
- Modify: `apps/dashboard/lib/types/billing.ts` — add `DowngradeViolation` types
- Modify: `apps/dashboard/app/(dashboard)/subscription/components/tabs/plans-tab.tsx` — open dialog on 422 instead of toast
- Modify: `apps/dashboard/lib/translations/ar.billing.ts` + `en.billing.ts` — add violation copy keys
- Verify + add (one sub-task per page): per-row Deactivate button on `/employees`, `/branches`, `/bookings/recurring`, `/coupons`, `/intake-forms`, `/email-templates`, `/departments`
- Modify: `apps/admin/features/plans/features-tab/feature-matrix.tsx` — drop ZATCA + STORAGE rows
- Modify: `apps/dashboard/app/(dashboard)/subscription/plans/components/feature-matrix.tsx` — same

---

### Task 4.1: Type sync + API client

- [ ] **Step 1: Run** `npm run openapi:sync` from the repo root to regenerate `apps/dashboard/lib/types/api.generated.ts` with the new violation shape.

- [ ] **Step 2: Add to `apps/dashboard/lib/types/billing.ts`** the discriminated union mirroring backend, plus the union-narrow guards.

- [ ] **Step 3: Update `billing.ts` API client** — the `downgrade()` and `scheduleDowngrade()` mutations need to surface the 422 body (currently they throw a generic ApiError). Throw a typed `DowngradeBlockedError` with `violations: DowngradeViolation[]` instead.

- [ ] **Step 4: Commit**.

### Task 4.2: Dialog component

- [ ] **Step 1: Create `downgrade-violations-dialog.tsx`** — uses `Dialog` from `@deqah/ui`. Shape:

```tsx
type Props = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  violations: DowngradeViolation[];
  targetPlanName: string;
  onChooseHigherPlan: () => void;
};

export function DowngradeViolationsDialog(props: Props) { /* render rows per violation kind */ }
```

Each row component switches on `kind`:

- `QUANTITATIVE` + `BRANCHES`/`EMPLOYEES` → "Deactivate N {entity}. Their historical records are preserved." + button linking to `/employees?status=active` (etc).
- `QUANTITATIVE` + `MONTHLY_BOOKINGS` → "Cannot reduce — historical. Resets on {date} ({daysUntil} days)." No link.
- `BOOLEAN` → "{N} active {feature}. Deactivate them." + link from `blockingResources.deepLink`.

All copy through `useLocale().t()`.

- [ ] **Step 2: Add translation keys** — `billing.downgradeViolations.title`, `.employees.title`, `.employees.body`, `.branches.title`, `.bookings.title`, `.bookings.body`, plus per-feature keys for booleans, plus `.actions.manage`, `.actions.chooseHigherPlan`. Mirror in AR + EN. Run `npm run i18n:verify` to confirm parity.

- [ ] **Step 3: Spec** with Vitest (`downgrade-violations-dialog.spec.tsx`) — render with mixed violations, assert each row + link.

- [ ] **Step 4: Commit**.

### Task 4.3: Wire dialog into plans tab

- [ ] **Step 1: In `plans-tab.tsx`** — the `submitPlanChange` async function catches `DowngradeBlockedError` and opens the dialog with the violations.

- [ ] **Step 2: TanStack invalidation** — when the dialog closes, invalidate `['billing','proration-preview']` and any `['employees',…]` / `['branches',…]` keys (in case the user deactivated something via deep link in another tab and came back).

- [ ] **Step 3: Spec** the integration.

- [ ] **Step 4: Commit**.

### Task 4.4: Verify + add per-row Deactivate buttons

For each list page, sub-task:

- [ ] **4.4.a `/employees`** — `rg -n "deactivate" apps/dashboard/components/features/employees/`. If no per-row Deactivate button in the columns/table, add one (mutation calls `PATCH /employees/:id` with `{ isActive: false }`). Spec the button + mutation. Commit.
- [ ] **4.4.b `/branches`** — same audit + add if missing.
- [ ] **4.4.c `/bookings/recurring`** — same.
- [ ] **4.4.d `/coupons`** — same.
- [ ] **4.4.e `/intake-forms`** — same.
- [ ] **4.4.f `/email-templates`** — same.
- [ ] **4.4.g `/departments`** — same.

### Task 4.5: Drop ZATCA + STORAGE rows from comparison matrices

- [ ] **Step 1: Edit `apps/dashboard/app/(dashboard)/subscription/plans/components/feature-matrix.tsx`** — remove rows.

- [ ] **Step 2: Edit `apps/admin/features/plans/features-tab/feature-matrix.tsx`** — remove rows from admin plan editor.

- [ ] **Step 3: Edit translation files** to remove now-unused keys for ZATCA + STORAGE feature names. Run `npm run i18n:verify`.

- [ ] **Step 4: Commit + PR for Phase 4**.

---

## Phase 5 — E2E + Kiwi

**Goal:** Five end-to-end suites prove the full flows; manual QA report synced to Kiwi; final PR `feat/downgrade-overhaul → main`.

**Files:**
- Create: `apps/backend/test/e2e/downgrade-quantitative.e2e.spec.ts`
- Create: `apps/backend/test/e2e/downgrade-boolean.e2e.spec.ts`
- Create: `apps/backend/test/e2e/downgrade-grace-api-webhooks.e2e.spec.ts`
- Create: `apps/backend/test/e2e/downgrade-grace-custom-domain.e2e.spec.ts`
- Create: `apps/backend/test/e2e/downgrade-tenant-isolation.e2e.spec.ts`
- Create: `data/kiwi/billing-downgrade-2026-05-XX.json`
- Create: `docs/superpowers/qa/downgrade-overhaul-report-2026-05-XX.md`

---

### Task 5.1: Quantitative e2e

- [ ] **Step 1: Write the spec** following the existing e2e style under `apps/backend/test/e2e/`. Use `bootstrap` helper to create org with overflowing usage, attempt downgrade, deactivate via real endpoints, retry. Assert HTTP codes and counter values at each stage.

- [ ] **Step 2: Run** `cd apps/backend && npm run test:e2e` → expect PASS.

- [ ] **Step 3: Commit**.

### Task 5.2: Boolean e2e

- [ ] **Step 1: Write the spec** — create org with active recurring + active coupons → schedule downgrade → assert 422 with both violations → deactivate via endpoints → retry → 200.

- [ ] **Step 2: Run + commit**.

### Task 5.3: Grace e2e (API/Webhooks)

- [ ] **Step 1: Write the spec** — downgrade lands → API key works (assert via integration test that the guard allows) → fast-forward time (Jest fake timers or mocked clock) past 7 days → call returns 402.

- [ ] **Step 2: Run + commit**.

### Task 5.4: Grace e2e (Custom Domain)

- [ ] **Step 1: Write the spec** — downgrade → cron run on day 23 sends warning (assert mailer mock called) → day 30 reverts.

- [ ] **Step 2: Run + commit**.

### Task 5.5: Tenant isolation e2e

- [ ] **Step 1: Write the spec** — downgrade flow on org A; org B simultaneously has different state; assert org B sees no leakage in its own violations.

- [ ] **Step 2: Run + commit**.

### Task 5.6: Manual QA + Kiwi sync

- [ ] **Step 1: Stand up the local stack** — `npm run docker:up && npm run dev:backend && npm run dev:dashboard`.

- [ ] **Step 2: Run the QA gate** via Chrome DevTools MCP: walk the full happy path (downgrade with violations → resolve → retry → succeed) and capture screenshots into `docs/superpowers/qa/downgrade-overhaul-report-2026-05-XX.md`.

- [ ] **Step 3: Author plan JSON** at `data/kiwi/billing-downgrade-2026-05-XX.json` per the schema in CLAUDE.md.

- [ ] **Step 4: Sync** — `npm run kiwi:sync-manual data/kiwi/billing-downgrade-2026-05-XX.json`.

- [ ] **Step 5: Link Kiwi URLs** back into the report.

- [ ] **Step 6: Commit**.

### Task 5.7: Final PR

- [ ] **Step 1: Run all suites** from repo root — `npm run typecheck && npm run lint && npm test`.

- [ ] **Step 2: Open PR `feat/downgrade-overhaul → main`** with a comprehensive summary linking the spec and all phase commits.

- [ ] **Step 3: Auto-merge once CI green** (per CLAUDE.md feedback memory: auto-merge phase PRs when green; owner-only areas still need explicit review since this touches billing).

- [ ] **Step 4: Wait for user confirmation of success.**

- [ ] **Step 5: Tear down the orchestration pipeline** (see "Pipeline Teardown" section below).

---

## Pipeline (Orchestration Layer)

This plan is executed by an automated supervisor pattern, not by hand:

- **Supervisor:** parent Opus session (this conversation). Reads each Task in order, dispatches to the worker, reviews the result, decides whether to advance to the next Task or to send back for fixes.
- **Worker:** `sonnet-executor` sub-agent. Receives a self-contained brief per Task containing the goal, exact files, full code blocks, and acceptance criteria. Applies the changes, runs the listed test commands, reports back results.
- **Cadence:** one Task per sub-agent dispatch. Between tasks, supervisor verifies the diff (`git status --short` + `git log -1`) and the test output. If the worker reports failure, supervisor re-dispatches with corrections (max 2 retries per Task — escalate after that).
- **Phase boundaries:** at the end of each Phase the supervisor opens the PR, waits for CI green, auto-merges to `feat/downgrade-overhaul`, then dispatches the first task of the next Phase.

The pipeline definition lives at `pipeline/downgrade-overhaul/runbook.md` (created at execution start). It is **deleted** after the user confirms successful completion of the final PR.

---

## Self-Review

Spec coverage:
- §3 Q1 Hybrid policy → Phase 3 task 3.2 (default Freeze) + Phase 3 tasks 3.5/3.6/3.8 (exceptions). ✓
- §3 Q2 Freeze definition → Phase 3 task 3.2 (background) + existing FeatureGuard (API). ✓
- §3 Q3 ZATCA always-on → Phase 1 task 1.6 + Task 1.7 migration. ✓
- §3 Q3 CUSTOM_DOMAIN 30d grace → Phase 3 task 3.5. ✓
- §3 Q3 API/WEBHOOKS 7d grace → Phase 3 tasks 3.3 + 3.4 + 3.6. ✓
- §3 Q3 WHITE_LABEL_MOBILE → covered in Phase 3 task 3.2 (writes blocked, build untouched). The "tenant cannot publish a new build" enforcement is documented as out-of-scope for code; this is consistent with §4.3.4.
- §3 Q4 STORAGE removed → Phase 1 task 1.5. ✓
- §3 Q5 Manual-only → Phase 4 task 4.4 (per-row deactivate buttons). ✓
- §3 Q6 No super-admin override → enforced by absence of any new force endpoint. ✓
- §4.1 Counter integrity → Phase 1 tasks 1.1-1.4 + 1.8 (backfill). ✓
- §4.2 Boolean safety table → Phase 2 task 2.2 (each row implemented). ✓
- §4.3 Retention enforcement → Phase 3 (all tasks). ✓
- §4.4 STORAGE removal → Phase 1 task 1.5. ✓
- §4.5 Manual resolution + dialog spec → Phase 4 (all tasks). ✓
- §5 Migrations → Phase 1 task 1.7. ✓
- §6 Testing → unit tests inline in every task; e2e in Phase 5; Kiwi in Task 5.6. ✓

Placeholder scan: all task steps contain real code or real commands. The boolean check map in Task 2.2 uses ellipses (`/* similar */`) for repeat patterns — this is intentional brevity for repeating the exact same shape; the worker is instructed to "Implement each non-null check with the actual Prisma model." Type consistency: `DowngradeViolation` shape is defined once in Task 2.1 and consumed identically in Tasks 2.2, 2.3, 4.1, 4.2.
