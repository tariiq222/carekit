# Tenant Billing Phase 3 Cancel Reactivate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Stripe-style cancel-at-period-end for paid subscriptions, immediate trial cancellation, reactivation of scheduled cancellations, and a scheduled-cancellation processor.

**Architecture:** Extend the existing `platform/billing` vertical slice without replacing current subscription flows. `CancelSubscriptionHandler` remains the tenant-facing cancel boundary for compatibility, but non-trial subscriptions now set `cancelAtPeriodEnd=true` instead of immediately changing status; a new `ReactivateSubscriptionHandler` clears that schedule, and a cron transitions due scheduled cancellations to `CANCELED`.

**Tech Stack:** NestJS 11, Prisma 7 split schema, PostgreSQL, Jest, Next.js 15 App Router, React 19, TanStack Query, Vitest, Deqah UI primitives.

---

## Contract Decisions

- Add `Subscription.cancelAtPeriodEnd Boolean @default(false)` and `Subscription.scheduledCancellationDate DateTime?`.
- Trial cancellation stays immediate: `TRIALING -> CANCELED`, with `canceledAt` and `cancelReason`.
- `ACTIVE` and `PAST_DUE` cancellation schedules at `currentPeriodEnd`, leaving `status` unchanged.
- `SUSPENDED` cancellation remains immediate because there is no active paid access to preserve.
- `CANCELED` remains terminal.
- Add `POST /dashboard/billing/subscription/schedule-cancel` and keep existing `POST /dashboard/billing/subscription/cancel` as a compatibility alias to the same handler.
- Add `POST /dashboard/billing/subscription/reactivate` for undoing `cancelAtPeriodEnd=true`; keep existing `/subscription/resume` for suspended subscriptions only.
- UI copy must say "scheduled cancellation" and "Reactivate" for `cancelAtPeriodEnd=true`, not "resume"; "Resume" remains for suspended subscriptions.

## File Structure

Backend:
- Modify: `apps/backend/prisma/schema/platform.prisma`
- Create: `apps/backend/prisma/migrations/20260430140000_tenant_billing_cancel_at_period_end/migration.sql`
- Modify: `apps/backend/src/modules/platform/billing/cancel-subscription/cancel-subscription.handler.ts`
- Modify: `apps/backend/src/modules/platform/billing/cancel-subscription/cancel-subscription.handler.spec.ts`
- Create: `apps/backend/src/modules/platform/billing/reactivate-subscription/reactivate-subscription.handler.ts`
- Create: `apps/backend/src/modules/platform/billing/reactivate-subscription/reactivate-subscription.handler.spec.ts`
- Create: `apps/backend/src/modules/platform/billing/process-scheduled-cancellations/process-scheduled-cancellations.cron.ts`
- Create: `apps/backend/src/modules/platform/billing/process-scheduled-cancellations/process-scheduled-cancellations.cron.spec.ts`
- Modify: `apps/backend/src/modules/platform/billing/billing.module.ts`
- Modify: `apps/backend/src/api/dashboard/billing.controller.ts`
- Modify: `apps/backend/src/api/dashboard/billing.controller.spec.ts`

Dashboard:
- Modify: `apps/dashboard/lib/types/billing.ts`
- Modify: `apps/dashboard/lib/api/billing.ts`
- Modify: `apps/dashboard/hooks/use-current-subscription.ts`
- Modify: `apps/dashboard/components/features/billing/status-banner.tsx`
- Modify: `apps/dashboard/app/(dashboard)/settings/billing/components/current-plan-card.tsx`
- Modify: `apps/dashboard/app/(dashboard)/settings/billing/components/cancel-subscription-dialog.tsx`
- Modify: `apps/dashboard/lib/translations/en.billing.ts`
- Modify: `apps/dashboard/lib/translations/ar.billing.ts`
- Modify: `apps/dashboard/test/unit/components/billing-page.spec.tsx`
- Create: `apps/dashboard/test/unit/lib/billing-api-cancel.spec.ts`

Docs:
- Keep: `docs/superpowers/qa/dashboard-next-build-baseline-2026-04-30.md`

## Task 1: Schema and Migration

**Files:**
- Modify: `apps/backend/prisma/schema/platform.prisma`
- Create: `apps/backend/prisma/migrations/20260430140000_tenant_billing_cancel_at_period_end/migration.sql`

- [ ] **Step 1: Add failing schema expectation by running validate first**

Run:

```bash
npm run prisma:validate --workspace=backend
```

Expected: PASS before edits. This confirms the baseline schema is valid.

- [ ] **Step 2: Add cancel scheduling fields to Prisma**

In `model Subscription`, add the fields after `cancelReason`:

```prisma
  cancelAtPeriodEnd         Boolean   @default(false)
  scheduledCancellationDate DateTime?
```

Add this index near the existing `@@index([currentPeriodEnd])`:

```prisma
  @@index([cancelAtPeriodEnd, scheduledCancellationDate])
```

- [ ] **Step 3: Create migration**

Create `apps/backend/prisma/migrations/20260430140000_tenant_billing_cancel_at_period_end/migration.sql`:

```sql
ALTER TABLE "Subscription"
  ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "scheduledCancellationDate" TIMESTAMP(3);

CREATE INDEX "Subscription_cancelAtPeriodEnd_scheduledCancellationDate_idx"
  ON "Subscription"("cancelAtPeriodEnd", "scheduledCancellationDate");
```

- [ ] **Step 4: Verify Prisma**

Run:

```bash
npm run prisma:generate --workspace=backend
npm run prisma:validate --workspace=backend
```

Expected: both commands exit `0`; validate reports the schemas are valid.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/prisma/schema/platform.prisma \
  apps/backend/prisma/migrations/20260430140000_tenant_billing_cancel_at_period_end/migration.sql
git commit -m "feat(billing): add scheduled cancellation fields"
```

## Task 2: Schedule Cancel Handler

**Files:**
- Modify: `apps/backend/src/modules/platform/billing/cancel-subscription/cancel-subscription.handler.ts`
- Modify: `apps/backend/src/modules/platform/billing/cancel-subscription/cancel-subscription.handler.spec.ts`

- [ ] **Step 1: Replace immediate-cancel tests with schedule-aware tests**

Update `cancel-subscription.handler.spec.ts` to include these cases:

```ts
it('cancels TRIALING subscriptions immediately', async () => {
  const prisma = buildPrisma();
  const cache = buildCache();
  prisma.subscription.findFirst.mockResolvedValue({
    id: 'sub-trial',
    status: 'TRIALING',
    currentPeriodEnd: new Date('2026-05-01T00:00:00.000Z'),
  });
  prisma.subscription.update.mockResolvedValue({ id: 'sub-trial', status: 'CANCELED' });
  const handler = new CancelSubscriptionHandler(
    prisma as never,
    buildTenant('org-A') as never,
    cache as never,
    new SubscriptionStateMachine(),
  );

  await handler.execute({ reason: 'closing' });

  expect(prisma.subscription.update).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: 'sub-trial' },
    data: expect.objectContaining({
      status: 'CANCELED',
      canceledAt: expect.any(Date),
      cancelReason: 'closing',
      cancelAtPeriodEnd: false,
      scheduledCancellationDate: null,
    }),
  }));
  expect(cache.invalidate).toHaveBeenCalledWith('org-A');
});

it('schedules ACTIVE subscriptions at currentPeriodEnd', async () => {
  const prisma = buildPrisma();
  const periodEnd = new Date('2026-05-01T00:00:00.000Z');
  prisma.subscription.findFirst.mockResolvedValue({
    id: 'sub-active',
    status: 'ACTIVE',
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: false,
  });
  prisma.subscription.update.mockResolvedValue({
    id: 'sub-active',
    status: 'ACTIVE',
    cancelAtPeriodEnd: true,
    scheduledCancellationDate: periodEnd,
  });
  const handler = new CancelSubscriptionHandler(
    prisma as never,
    buildTenant() as never,
    buildCache() as never,
    new SubscriptionStateMachine(),
  );

  const result = await handler.execute({ reason: 'budget' });

  expect(prisma.subscription.update).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: 'sub-active' },
    data: {
      cancelAtPeriodEnd: true,
      scheduledCancellationDate: periodEnd,
      cancelReason: 'budget',
    },
  }));
  expect(result.status).toBe('ACTIVE');
});

it('rejects scheduling when cancellation is already scheduled', async () => {
  const prisma = buildPrisma();
  prisma.subscription.findFirst.mockResolvedValue({
    id: 'sub-active',
    status: 'ACTIVE',
    currentPeriodEnd: new Date('2026-05-01T00:00:00.000Z'),
    cancelAtPeriodEnd: true,
  });
  const handler = new CancelSubscriptionHandler(
    prisma as never,
    buildTenant() as never,
    buildCache() as never,
    new SubscriptionStateMachine(),
  );

  await expect(handler.execute({})).rejects.toThrow('subscription_cancellation_already_scheduled');
});
```

Keep the existing `NotFoundException` and already `CANCELED` tests, updating expected data where needed.

- [ ] **Step 2: Run the cancel tests and verify RED**

Run:

```bash
npm run test --workspace=backend -- src/modules/platform/billing/cancel-subscription/cancel-subscription.handler.spec.ts --runInBand
```

Expected: FAIL because `CancelSubscriptionHandler` still immediately cancels `ACTIVE`.

- [ ] **Step 3: Implement schedule-aware cancellation**

Replace `CancelSubscriptionHandler.execute()` with:

```ts
async execute(cmd: { reason?: string }) {
  const organizationId = this.tenant.requireOrganizationId();

  const sub = await this.prisma.subscription.findFirst({
    where: { organizationId },
    select: {
      id: true,
      status: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
    },
  });
  if (!sub) throw new NotFoundException('No subscription found');

  if (sub.status === 'ACTIVE' || sub.status === 'PAST_DUE') {
    if (sub.cancelAtPeriodEnd) {
      throw new ConflictException('subscription_cancellation_already_scheduled');
    }

    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        cancelAtPeriodEnd: true,
        scheduledCancellationDate: sub.currentPeriodEnd,
        cancelReason: cmd.reason ?? null,
      },
    });
    this.cache.invalidate(organizationId);
    return updated;
  }

  this.stateMachine.transition(sub.status, { type: 'cancel' });

  const updated = await this.prisma.subscription.update({
    where: { id: sub.id },
    data: {
      status: 'CANCELED',
      canceledAt: new Date(),
      cancelReason: cmd.reason ?? null,
      cancelAtPeriodEnd: false,
      scheduledCancellationDate: null,
    },
  });
  this.cache.invalidate(organizationId);
  return updated;
}
```

Add `ConflictException` to the existing imports.

- [ ] **Step 4: Verify cancel tests**

Run:

```bash
npm run test --workspace=backend -- src/modules/platform/billing/cancel-subscription/cancel-subscription.handler.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/platform/billing/cancel-subscription/cancel-subscription.handler.ts \
  apps/backend/src/modules/platform/billing/cancel-subscription/cancel-subscription.handler.spec.ts
git commit -m "feat(billing): schedule subscription cancellation"
```

## Task 3: Reactivate Scheduled Cancellation Handler

**Files:**
- Create: `apps/backend/src/modules/platform/billing/reactivate-subscription/reactivate-subscription.handler.ts`
- Create: `apps/backend/src/modules/platform/billing/reactivate-subscription/reactivate-subscription.handler.spec.ts`
- Modify: `apps/backend/src/modules/platform/billing/billing.module.ts`

- [ ] **Step 1: Write failing handler tests**

Create `reactivate-subscription.handler.spec.ts`:

```ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReactivateSubscriptionHandler } from './reactivate-subscription.handler';

const buildPrisma = () => ({
  subscription: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
});

const buildTenant = (organizationId = 'org-A') => ({
  requireOrganizationId: jest.fn().mockReturnValue(organizationId),
});

const buildCache = () => ({
  invalidate: jest.fn(),
});

describe('ReactivateSubscriptionHandler', () => {
  it('throws NotFoundException when no subscription exists', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue(null);
    const handler = new ReactivateSubscriptionHandler(
      prisma as never,
      buildTenant() as never,
      buildCache() as never,
    );

    await expect(handler.execute()).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when no cancellation is scheduled', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      cancelAtPeriodEnd: false,
    });
    const handler = new ReactivateSubscriptionHandler(
      prisma as never,
      buildTenant() as never,
      buildCache() as never,
    );

    await expect(handler.execute()).rejects.toThrow(BadRequestException);
  });

  it('clears scheduled cancellation fields and invalidates cache', async () => {
    const prisma = buildPrisma();
    const cache = buildCache();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      cancelAtPeriodEnd: true,
      scheduledCancellationDate: new Date('2026-05-01T00:00:00.000Z'),
    });
    prisma.subscription.update.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      cancelAtPeriodEnd: false,
      scheduledCancellationDate: null,
    });
    const handler = new ReactivateSubscriptionHandler(
      prisma as never,
      buildTenant('org-A') as never,
      cache as never,
    );

    const result = await handler.execute();

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: {
        cancelAtPeriodEnd: false,
        scheduledCancellationDate: null,
        cancelReason: null,
      },
    });
    expect(result.cancelAtPeriodEnd).toBe(false);
    expect(cache.invalidate).toHaveBeenCalledWith('org-A');
  });

  it('rejects terminal CANCELED subscriptions', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'CANCELED',
      cancelAtPeriodEnd: true,
    });
    const handler = new ReactivateSubscriptionHandler(
      prisma as never,
      buildTenant() as never,
      buildCache() as never,
    );

    await expect(handler.execute()).rejects.toThrow('subscription_not_reactivatable');
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
npm run test --workspace=backend -- src/modules/platform/billing/reactivate-subscription/reactivate-subscription.handler.spec.ts --runInBand
```

Expected: FAIL because the handler file does not exist.

- [ ] **Step 3: Implement handler**

Create `reactivate-subscription.handler.ts`:

```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { SubscriptionCacheService } from '../subscription-cache.service';

@Injectable()
export class ReactivateSubscriptionHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly cache: SubscriptionCacheService,
  ) {}

  async execute() {
    const organizationId = this.tenant.requireOrganizationId();
    const sub = await this.prisma.subscription.findFirst({
      where: { organizationId },
      select: {
        id: true,
        status: true,
        cancelAtPeriodEnd: true,
      },
    });
    if (!sub) throw new NotFoundException('No subscription found');
    if (sub.status === 'CANCELED') {
      throw new BadRequestException('subscription_not_reactivatable');
    }
    if (!sub.cancelAtPeriodEnd) {
      throw new BadRequestException('subscription_cancellation_not_scheduled');
    }

    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        cancelAtPeriodEnd: false,
        scheduledCancellationDate: null,
        cancelReason: null,
      },
    });
    this.cache.invalidate(organizationId);
    return updated;
  }
}
```

- [ ] **Step 4: Register provider**

In `billing.module.ts`, import and add to `HANDLERS`:

```ts
import { ReactivateSubscriptionHandler } from "./reactivate-subscription/reactivate-subscription.handler";
```

```ts
  ReactivateSubscriptionHandler,
```

- [ ] **Step 5: Verify tests**

Run:

```bash
npm run test --workspace=backend -- src/modules/platform/billing/reactivate-subscription/reactivate-subscription.handler.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/platform/billing/reactivate-subscription \
  apps/backend/src/modules/platform/billing/billing.module.ts
git commit -m "feat(billing): reactivate scheduled cancellations"
```

## Task 4: Scheduled Cancellation Cron

**Files:**
- Create: `apps/backend/src/modules/platform/billing/process-scheduled-cancellations/process-scheduled-cancellations.cron.ts`
- Create: `apps/backend/src/modules/platform/billing/process-scheduled-cancellations/process-scheduled-cancellations.cron.spec.ts`
- Modify: `apps/backend/src/modules/platform/billing/billing.module.ts`

- [ ] **Step 1: Write failing cron tests**

Create `process-scheduled-cancellations.cron.spec.ts`:

```ts
import { ProcessScheduledCancellationsCron } from './process-scheduled-cancellations.cron';

const NOW = new Date('2026-05-01T00:00:00.000Z');

const buildConfig = (enabled: boolean) => ({
  get: jest.fn((key: string, fallback?: unknown) => {
    if (key === 'BILLING_CRON_ENABLED') return enabled;
    return fallback;
  }),
});

const buildPrisma = (subs: unknown[] = []) => ({
  $allTenants: {
    subscription: {
      findMany: jest.fn().mockResolvedValue(subs),
      update: jest.fn().mockResolvedValue({}),
    },
  },
});

const buildCache = () => ({
  invalidate: jest.fn(),
});

describe('ProcessScheduledCancellationsCron', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
  afterEach(() => jest.useRealTimers());

  it('does nothing when billing cron is disabled', async () => {
    const prisma = buildPrisma([{ id: 'sub-1' }]);
    const cron = new ProcessScheduledCancellationsCron(
      prisma as never,
      buildConfig(false) as never,
      buildCache() as never,
    );

    await cron.execute();

    expect(prisma.$allTenants.subscription.findMany).not.toHaveBeenCalled();
  });

  it('queries due active scheduled cancellations only', async () => {
    const prisma = buildPrisma([]);
    const cron = new ProcessScheduledCancellationsCron(
      prisma as never,
      buildConfig(true) as never,
      buildCache() as never,
    );

    await cron.execute();

    expect(prisma.$allTenants.subscription.findMany).toHaveBeenCalledWith({
      where: {
        status: { in: ['ACTIVE', 'PAST_DUE'] },
        cancelAtPeriodEnd: true,
        scheduledCancellationDate: { lte: NOW },
      },
      select: { id: true, organizationId: true },
    });
  });

  it('cancels due subscriptions and invalidates each tenant cache', async () => {
    const prisma = buildPrisma([{ id: 'sub-1', organizationId: 'org-1' }]);
    const cache = buildCache();
    const cron = new ProcessScheduledCancellationsCron(
      prisma as never,
      buildConfig(true) as never,
      cache as never,
    );

    await cron.execute();

    expect(prisma.$allTenants.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: {
        status: 'CANCELED',
        canceledAt: NOW,
        cancelAtPeriodEnd: false,
      },
    });
    expect(cache.invalidate).toHaveBeenCalledWith('org-1');
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
npm run test --workspace=backend -- src/modules/platform/billing/process-scheduled-cancellations/process-scheduled-cancellations.cron.spec.ts --runInBand
```

Expected: FAIL because the cron file does not exist.

- [ ] **Step 3: Implement cron**

Create `process-scheduled-cancellations.cron.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { SubscriptionCacheService } from '../subscription-cache.service';

@Injectable()
export class ProcessScheduledCancellationsCron {
  private readonly logger = new Logger(ProcessScheduledCancellationsCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly cache: SubscriptionCacheService,
  ) {}

  async execute(): Promise<void> {
    if (!this.config.get<boolean>('BILLING_CRON_ENABLED', false)) return;

    const now = new Date();
    const due = await this.prisma.$allTenants.subscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'PAST_DUE'] },
        cancelAtPeriodEnd: true,
        scheduledCancellationDate: { lte: now },
      },
      select: { id: true, organizationId: true },
    });

    for (const sub of due) {
      await this.prisma.$allTenants.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'CANCELED',
          canceledAt: now,
          cancelAtPeriodEnd: false,
        },
      });
      this.cache.invalidate(sub.organizationId);
    }

    if (due.length > 0) {
      this.logger.log(`Processed ${due.length} scheduled subscription cancellations`);
    }
  }
}
```

- [ ] **Step 4: Register cron provider**

In `billing.module.ts`, import and add `ProcessScheduledCancellationsCron` to `providers` and `exports` through the `HANDLERS` array:

```ts
import { ProcessScheduledCancellationsCron } from "./process-scheduled-cancellations/process-scheduled-cancellations.cron";
```

```ts
  ProcessScheduledCancellationsCron,
```

- [ ] **Step 5: Verify cron tests**

Run:

```bash
npm run test --workspace=backend -- src/modules/platform/billing/process-scheduled-cancellations/process-scheduled-cancellations.cron.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/platform/billing/process-scheduled-cancellations \
  apps/backend/src/modules/platform/billing/billing.module.ts
git commit -m "feat(billing): process scheduled cancellations"
```

## Task 5: Dashboard Billing API Endpoints

**Files:**
- Modify: `apps/backend/src/api/dashboard/billing.controller.ts`
- Modify: `apps/backend/src/api/dashboard/billing.controller.spec.ts`

- [ ] **Step 1: Extend controller tests**

Add this test to `billing.controller.spec.ts`, reusing `buildHandler`:

```ts
describe('BillingController cancellation routes', () => {
  it('delegates schedule-cancel and reactivate routes to handlers', async () => {
    const cancel = buildHandler({ id: 'sub-1', cancelAtPeriodEnd: true });
    const reactivate = buildHandler({ id: 'sub-1', cancelAtPeriodEnd: false });
    const controller = new BillingController(
      buildHandler([]) as never,
      buildHandler(null) as never,
      buildHandler([]) as never,
      buildHandler(null) as never,
      buildHandler(null) as never,
      buildHandler(null) as never,
      cancel as never,
      buildHandler(null) as never,
      buildHandler([]) as never,
      buildHandler(null) as never,
      buildHandler(null) as never,
      buildHandler(null) as never,
      reactivate as never,
    );

    await controller.scheduleCancelSub({ reason: 'budget' });
    expect(cancel.execute).toHaveBeenCalledWith({ reason: 'budget' });

    await controller.reactivateSub();
    expect(reactivate.execute).toHaveBeenCalledWith();
  });
});
```

After adding the new constructor dependency, update the saved-card controller test constructor to pass `buildHandler(null) as never` for the final `reactivate` argument.

- [ ] **Step 2: Run and verify RED**

Run:

```bash
npm run test --workspace=backend -- src/api/dashboard/billing.controller.spec.ts --runInBand
```

Expected: FAIL because controller methods are missing.

- [ ] **Step 3: Add controller routes**

Import:

```ts
import { ReactivateSubscriptionHandler } from "../../modules/platform/billing/reactivate-subscription/reactivate-subscription.handler";
```

Add constructor dependency after saved-card handlers:

```ts
    private readonly reactivate: ReactivateSubscriptionHandler,
```

Add routes:

```ts
  @Post("subscription/schedule-cancel")
  @ApiOperation({ summary: "Schedule subscription cancellation at period end" })
  scheduleCancelSub(@Body() body: { reason?: string }) {
    return this.cancel.execute(body);
  }

  @Post("subscription/reactivate")
  @HttpCode(200)
  @ApiOperation({ summary: "Reactivate a scheduled cancellation" })
  reactivateSub() {
    return this.reactivate.execute();
  }
```

Keep existing `cancelSub()` as the compatibility route. It should still delegate to `this.cancel.execute(body)`.

- [ ] **Step 4: Verify controller tests**

Run:

```bash
npm run test --workspace=backend -- src/api/dashboard/billing.controller.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/api/dashboard/billing.controller.ts \
  apps/backend/src/api/dashboard/billing.controller.spec.ts
git commit -m "feat(billing): expose scheduled cancellation endpoints"
```

## Task 6: Dashboard Client API and Types

**Files:**
- Modify: `apps/dashboard/lib/types/billing.ts`
- Modify: `apps/dashboard/lib/api/billing.ts`
- Modify: `apps/dashboard/hooks/use-current-subscription.ts`
- Create: `apps/dashboard/test/unit/lib/billing-api-cancel.spec.ts`

- [ ] **Step 1: Write failing API tests**

Create `billing-api-cancel.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    post: vi.fn(),
  },
}))

vi.mock("@/lib/api", () => ({
  api: apiMock,
}))

import { billingApi } from "@/lib/api/billing"

describe("billingApi scheduled cancellation", () => {
  beforeEach(() => vi.clearAllMocks())

  it("schedules cancellation at period end", async () => {
    apiMock.post.mockResolvedValueOnce({ id: "sub-1", cancelAtPeriodEnd: true })

    await billingApi.scheduleCancel("budget")

    expect(apiMock.post).toHaveBeenCalledWith(
      "/dashboard/billing/subscription/schedule-cancel",
      { reason: "budget" },
    )
  })

  it("reactivates a scheduled cancellation", async () => {
    apiMock.post.mockResolvedValueOnce({ id: "sub-1", cancelAtPeriodEnd: false })

    await billingApi.reactivate()

    expect(apiMock.post).toHaveBeenCalledWith(
      "/dashboard/billing/subscription/reactivate",
      {},
    )
  })
})
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
npm run test --workspace=dashboard -- test/unit/lib/billing-api-cancel.spec.ts
```

Expected: FAIL because methods do not exist.

- [ ] **Step 3: Add Subscription fields**

In `Subscription` interface, add:

```ts
  cancelAtPeriodEnd?: boolean
  scheduledCancellationDate?: string | null
```

- [ ] **Step 4: Add API methods**

In `billingApi`, replace the old `cancel` body method with explicit schedule method while keeping compatibility:

```ts
  scheduleCancel: (reason?: string) =>
    api.post<Subscription>('/dashboard/billing/subscription/schedule-cancel', { reason }),

  cancel: (reason?: string) =>
    api.post<Subscription>('/dashboard/billing/subscription/cancel', { reason }),

  reactivate: () =>
    api.post<Subscription>('/dashboard/billing/subscription/reactivate', {}),
```

Keep existing `resume()` unchanged.

- [ ] **Step 5: Update hooks**

In `useBillingMutations()`, add:

```ts
  const scheduleCancelMut = useMutation({
    mutationFn: (reason?: string) => billingApi.scheduleCancel(reason),
    onSuccess: invalidate,
  })

  const reactivateMut = useMutation({
    mutationFn: () => billingApi.reactivate(),
    onSuccess: invalidate,
  })
```

Return both mutations. Keep `cancelMut` for compatibility, but have UI use `scheduleCancelMut` for paid subscriptions.

- [ ] **Step 6: Verify dashboard API tests**

Run:

```bash
npm run test --workspace=dashboard -- test/unit/lib/billing-api-cancel.spec.ts test/unit/lib/billing-api.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/lib/types/billing.ts \
  apps/dashboard/lib/api/billing.ts \
  apps/dashboard/hooks/use-current-subscription.ts \
  apps/dashboard/test/unit/lib/billing-api-cancel.spec.ts
git commit -m "feat(dashboard): add scheduled cancellation client API"
```

## Task 7: Dashboard Scheduled Cancellation UX

**Files:**
- Modify: `apps/dashboard/components/features/billing/status-banner.tsx`
- Modify: `apps/dashboard/app/(dashboard)/settings/billing/components/current-plan-card.tsx`
- Modify: `apps/dashboard/app/(dashboard)/settings/billing/components/cancel-subscription-dialog.tsx`
- Modify: `apps/dashboard/lib/translations/en.billing.ts`
- Modify: `apps/dashboard/lib/translations/ar.billing.ts`
- Modify: `apps/dashboard/test/unit/components/billing-page.spec.tsx`

- [ ] **Step 1: Extend billing page tests**

In `billing-page.spec.tsx`, add translation keys to the `t()` map:

```ts
          "billing.banner.scheduledCancel.title": "Cancellation scheduled",
          "billing.banner.scheduledCancel.description": "Your subscription stays active until the period ends.",
          "billing.summary.endsOn": "Ends on",
          "billing.actions.reactivate": "Reactivate",
          "billing.actions.reactivating": "Reactivating...",
          "billing.cancel.scheduleConfirm": "Schedule cancellation",
```

Update `useBillingMutations.mockReturnValue()` to include:

```ts
      scheduleCancelMut: { isPending: false, mutateAsync: scheduleCancelMutateAsync },
      reactivateMut: { isPending: false, mutate: reactivateMutate },
```

Add the two mocks next to the existing mutation mocks.

Add tests:

```tsx
it("shows scheduled cancellation banner and reactivate action", async () => {
  mockBillingFor("ACTIVE", proPlan)
  const subscription = useBilling.mock.calls.at(-1)?.[0]?.subscription
  const scheduledSub = {
    ...subscription,
    cancelAtPeriodEnd: true,
    scheduledCancellationDate: "2026-05-01T00:00:00.000Z",
  }
  useBilling.mockReturnValue({
    status: "ACTIVE",
    subscription: scheduledSub,
    isLoading: false,
  })
  useCurrentSubscription.mockReturnValue({ isLoading: false, data: scheduledSub })

  render(<BillingPage />)

  expect(screen.getByText("Cancellation scheduled")).toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: "Reactivate" }))
  expect(reactivateMutate).toHaveBeenCalledOnce()
})

it("schedules paid cancellation instead of immediate cancel", async () => {
  mockBillingFor("ACTIVE", proPlan)

  render(<BillingPage />)

  await userEvent.click(screen.getByRole("button", { name: "Cancel subscription" }))
  await userEvent.type(screen.getByPlaceholderText("Tell us why you're canceling"), "Budget")
  await userEvent.click(screen.getByRole("button", { name: "Schedule cancellation" }))

  await waitFor(() => expect(scheduleCancelMutateAsync).toHaveBeenCalledWith("Budget"))
})
```

Use this direct `scheduledSub` fixture in the banner/reactivation spec:

```ts
const scheduledSub = {
  id: "sub-1",
  organizationId: "org-1",
  status: "ACTIVE",
  billingCycle: "MONTHLY",
  currentPeriodStart: "2026-04-01T00:00:00.000Z",
  currentPeriodEnd: "2026-05-01T00:00:00.000Z",
  cancelAtPeriodEnd: true,
  scheduledCancellationDate: "2026-05-01T00:00:00.000Z",
  plan: { ...proPlan, currency: "SAR" },
  usage: { BOOKINGS_PER_MONTH: 25 },
  invoices: [],
}
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
npm run test --workspace=dashboard -- test/unit/components/billing-page.spec.tsx
```

Expected: FAIL because scheduled-cancel UI does not exist.

- [ ] **Step 3: Add translations**

Add to `en.billing.ts`:

```ts
  "billing.banner.scheduledCancel.title": "Cancellation scheduled",
  "billing.banner.scheduledCancel.description": "Your subscription stays active until the period ends.",
  "billing.summary.endsOn": "Ends on",
  "billing.actions.reactivate": "Reactivate",
  "billing.actions.reactivating": "Reactivating...",
  "billing.cancel.scheduleConfirm": "Schedule cancellation",
```

Add matching Arabic keys to `ar.billing.ts`:

```ts
  "billing.banner.scheduledCancel.title": "تمت جدولة الإلغاء",
  "billing.banner.scheduledCancel.description": "يبقى الاشتراك فعالاً حتى نهاية الفترة الحالية.",
  "billing.summary.endsOn": "ينتهي في",
  "billing.actions.reactivate": "إعادة التفعيل",
  "billing.actions.reactivating": "جارٍ إعادة التفعيل...",
  "billing.cancel.scheduleConfirm": "جدولة الإلغاء",
```

- [ ] **Step 4: Update scheduled-cancel banner**

In `BillingStatusBanner`, read `subscription` from `useBilling()`:

```ts
const { status, subscription } = useBilling()
```

Before the existing status guard, add:

```tsx
if (subscription?.cancelAtPeriodEnd && status === "ACTIVE") {
  return (
    <Card className="space-y-1 border border-warning/30 bg-warning/10 p-4 text-warning">
      <p className="font-semibold">{t("billing.banner.scheduledCancel.title")}</p>
      <p className="text-sm opacity-90">{t("billing.banner.scheduledCancel.description")}</p>
    </Card>
  )
}
```

Keep `PAST_DUE`, `SUSPENDED`, and `CANCELED` status banners higher priority by placing their check before scheduled-cancel if the implementation already checks status first. The intended priority is: `PAST_DUE/SUSPENDED/CANCELED` first, scheduled cancel only for otherwise active subscriptions.

- [ ] **Step 5: Update CurrentPlanCard actions**

Read new mutations:

```ts
const {
  upgradeMut,
  downgradeMut,
  cancelMut,
  resumeMut,
  startMut,
  scheduleCancelMut,
  reactivateMut,
} = useBillingMutations()
```

Include them in `pending`.

Change cancellation submit to:

```ts
async function submitCancellation(reason?: string) {
  if (currentSubscription.status === "TRIALING") {
    await cancelMut.mutateAsync(reason)
  } else {
    await scheduleCancelMut.mutateAsync(reason)
  }
  setCancelDialogOpen(false)
}
```

Show scheduled date copy under cycle/trial fields:

```tsx
{currentSubscription.cancelAtPeriodEnd && currentSubscription.scheduledCancellationDate && (
  <p className="text-sm text-muted-foreground">
    {t("billing.summary.endsOn")}:{" "}
    <span className="font-medium text-foreground">
      {formatBillingDate(currentSubscription.scheduledCancellationDate, locale)}
    </span>
  </p>
)}
```

In the actions area, replace cancel button with reactivate when scheduled:

```tsx
{currentSubscription.cancelAtPeriodEnd ? (
  <Button
    size="sm"
    variant="outline"
    disabled={pending}
    onClick={() => reactivateMut.mutate()}
  >
    {reactivateMut.isPending
      ? t("billing.actions.reactivating")
      : t("billing.actions.reactivate")}
  </Button>
) : currentSubscription.status !== "CANCELED" && currentSubscription.status !== "SUSPENDED" ? (
  <Button
    size="sm"
    variant="outline"
    className="text-error hover:text-error"
    disabled={pending}
    onClick={() => setCancelDialogOpen(true)}
  >
    {scheduleCancelMut.isPending || cancelMut.isPending
      ? t("billing.actions.canceling")
      : t("billing.actions.cancel")}
  </Button>
) : null}
```

- [ ] **Step 6: Update dialog confirm label**

In `CancelSubscriptionDialogProps`, add:

```ts
confirmLabel?: string
```

Render:

```tsx
{pending ? t("billing.actions.canceling") : confirmLabel ?? t("billing.cancel.confirm")}
```

Pass from `CurrentPlanCard`:

```tsx
confirmLabel={
  currentSubscription.status === "TRIALING"
    ? t("billing.cancel.confirm")
    : t("billing.cancel.scheduleConfirm")
}
```

- [ ] **Step 7: Verify dashboard tests and i18n**

Run:

```bash
npm run test --workspace=dashboard -- test/unit/components/billing-page.spec.tsx test/unit/lib/billing-api-cancel.spec.ts
npm run i18n:verify --workspace=dashboard
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard/components/features/billing/status-banner.tsx \
  apps/dashboard/app/'(dashboard)'/settings/billing/components/current-plan-card.tsx \
  apps/dashboard/app/'(dashboard)'/settings/billing/components/cancel-subscription-dialog.tsx \
  apps/dashboard/lib/translations/en.billing.ts \
  apps/dashboard/lib/translations/ar.billing.ts \
  apps/dashboard/test/unit/components/billing-page.spec.tsx
git commit -m "feat(dashboard): show scheduled cancellation state"
```

## Task 8: Verification and Handoff

**Files:**
- Review all changed files.

- [ ] **Step 1: Run backend verification**

```bash
npm run prisma:generate --workspace=backend
npm run prisma:validate --workspace=backend
npm run test --workspace=backend -- src/modules/platform/billing/cancel-subscription/cancel-subscription.handler.spec.ts src/modules/platform/billing/reactivate-subscription/reactivate-subscription.handler.spec.ts src/modules/platform/billing/process-scheduled-cancellations/process-scheduled-cancellations.cron.spec.ts src/api/dashboard/billing.controller.spec.ts --runInBand
npm run typecheck --workspace=backend
npx eslint src/modules/platform/billing/cancel-subscription/cancel-subscription.handler.ts src/modules/platform/billing/reactivate-subscription/*.ts src/modules/platform/billing/process-scheduled-cancellations/*.ts src/api/dashboard/billing.controller.ts src/modules/platform/billing/billing.module.ts
```

Expected: all commands exit `0`.

- [ ] **Step 2: Run dashboard verification**

```bash
npm run test --workspace=dashboard -- test/unit/lib/billing-api-cancel.spec.ts test/unit/components/billing-page.spec.tsx
npm run typecheck --workspace=dashboard
npm run i18n:verify --workspace=dashboard
npm run lint --workspace=dashboard -- lib/types/billing.ts lib/api/billing.ts hooks/use-current-subscription.ts components/features/billing/status-banner.tsx app/'(dashboard)'/settings/billing/components/current-plan-card.tsx app/'(dashboard)'/settings/billing/components/cancel-subscription-dialog.tsx test/unit/components/billing-page.spec.tsx test/unit/lib/billing-api-cancel.spec.ts lib/translations/en.billing.ts lib/translations/ar.billing.ts
```

Expected: all commands exit `0`.

- [ ] **Step 3: Record full build baseline**

Do not block Phase 3 on the known full dashboard build baseline unless the failing files include Phase 3 files. Re-run:

```bash
npm run build --workspace=dashboard
```

Expected today: fails on the documented unrelated React hook lint baseline from `docs/superpowers/qa/dashboard-next-build-baseline-2026-04-30.md`. If new Phase 3 files appear in the failure list, fix them before merge.

- [ ] **Step 4: Final branch status**

```bash
git status --short --branch
git log --oneline main..HEAD
```

Expected: clean worktree and focused commits on `feat/tenant-billing-phase-3`.

## Self-Review

- Spec coverage: covers Phase 3 `Cancel-at-period-end ─ schedule + reactivate`, scheduled-cancel state on overview, and due-cancellation processing.
- Edge cases covered: trial-cancel immediate, cancel-then-reactivate, already scheduled cancel rejection, due scheduled cancel processing.
- Intentional defer: interactions with scheduled downgrade and upgrade proration are Phase 4 because scheduled downgrade and proration endpoints do not exist yet.
- Existing `/subscription/resume` remains for SUSPENDED recovery and is not repurposed as scheduled-cancel reactivation.
- Full dashboard build baseline is documented separately; scoped Phase 3 verification must stay green.
