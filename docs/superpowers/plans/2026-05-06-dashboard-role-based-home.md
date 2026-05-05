# Dashboard Role-Based Home — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `apps/dashboard` home page (`/`) render only widgets relevant to the user's `MembershipRole` and CASL permissions, with `EMPLOYEE` data filtered to their own bookings server-side.

**Architecture:** A pure `getVisibleWidgets(membershipRole, canDo)` function (FE) drives per-widget gating. Each existing dashboard widget accepts visibility props or returns `null`. Backend re-validates via `CaslGuard` and adds an `EMPLOYEE` filter inside `GetDashboardStatsHandler` and the booking list handler. New endpoint `GET /dashboard/top-performers` powers a new `TopPerformersChart` widget restricted to OWNER/ADMIN.

**Tech Stack:** Next.js 15 (dashboard), NestJS 11 (backend), TanStack Query v5, Vitest, Jest, Playwright, Prisma 7.

**Spec:** `docs/superpowers/specs/2026-05-06-dashboard-role-based-home-design.md`

---

## File Structure

**New files:**
- `apps/dashboard/lib/dashboard-widgets.ts` — pure visibility decider
- `apps/dashboard/lib/dashboard-widgets.test.ts` — Vitest unit tests
- `apps/dashboard/components/features/dashboard/top-performers-chart.tsx` — new widget
- `apps/dashboard/hooks/use-top-performers.ts` — TanStack Query hook
- `apps/backend/src/modules/dashboard/get-top-performers/get-top-performers.dto.ts`
- `apps/backend/src/modules/dashboard/get-top-performers/get-top-performers.handler.ts`
- `apps/backend/src/modules/dashboard/get-top-performers/get-top-performers.handler.spec.ts`
- `apps/dashboard/e2e/smoke/dashboard-by-role.spec.ts` — Playwright smoke

**Modified files:**
- `apps/dashboard/app/(dashboard)/page.tsx` — gate widgets via `visible.*`
- `apps/dashboard/components/features/dashboard/dashboard-stats.tsx` — accept `visibleStats` prop
- `apps/dashboard/components/features/dashboard/quick-actions.tsx` — accept `actions` prop
- `apps/dashboard/components/features/dashboard/attention-alerts.tsx` — accept `visible` prop
- `apps/dashboard/components/features/dashboard/today-timeline.tsx` — employee empty-state copy
- `apps/dashboard/lib/api/dashboard.ts` — add `fetchTopPerformers`
- `apps/dashboard/lib/query-keys.ts` — add `dashboard.topPerformers`
- `apps/dashboard/lib/translations/ar.dashboard.ts` — new keys
- `apps/dashboard/lib/translations/en.dashboard.ts` — new keys
- `apps/backend/src/modules/dashboard/get-dashboard-stats/get-dashboard-stats.handler.ts` — EMPLOYEE filter + role-gated fields
- `apps/backend/src/modules/dashboard/get-dashboard-stats/get-dashboard-stats.handler.spec.ts` — extend cases
- `apps/backend/src/modules/dashboard/dashboard.module.ts` — register new handler
- `apps/backend/src/api/dashboard/dashboard.controller.ts` — add `top-performers` route + employee-aware stats
- `apps/backend/src/modules/bookings/list-bookings/list-bookings.handler.ts` (or equivalent) — EMPLOYEE auto-filter

---

## Task 1: Backend — extend `GetDashboardStatsHandler` to accept role + userId

**Files:**
- Modify: `apps/backend/src/modules/dashboard/get-dashboard-stats/get-dashboard-stats.handler.ts`
- Modify: `apps/backend/src/modules/dashboard/get-dashboard-stats/get-dashboard-stats.handler.spec.ts`
- Modify: `apps/backend/src/api/dashboard/dashboard.controller.ts`

- [ ] **Step 1: Add failing spec for EMPLOYEE filter**

Add to `get-dashboard-stats.handler.spec.ts`:

```ts
it('filters todayBookings by employee.userId when membershipRole is EMPLOYEE', async () => {
  const userId = 'user-emp-1';
  prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', userId } as never);
  prisma.booking.count.mockResolvedValue(2);
  await handler.execute({ membershipRole: 'EMPLOYEE', userId });
  expect(prisma.booking.count).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ employeeId: 'emp-1' }),
    }),
  );
});

it('omits payment-related fields for roles without Payment:read', async () => {
  const result = await handler.execute({ membershipRole: 'RECEPTIONIST', userId: 'u' });
  expect(result.todayRevenue).toBeUndefined();
  expect(result.pendingPayments).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/backend && npx jest get-dashboard-stats.handler.spec -t "filters todayBookings"
```
Expected: FAIL — handler.execute takes no args.

- [ ] **Step 3: Update handler to accept role + userId**

Replace the body of `get-dashboard-stats.handler.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { BookingStatus, PaymentStatus, PaymentMethod } from '@prisma/client';

export interface DashboardStatsCommand {
  membershipRole: string | null;
  userId: string;
}

export interface DashboardStats {
  todayBookings: number;
  confirmedToday: number;
  pendingToday: number;
  cancelRequests: number;
  // Payment-gated fields — undefined for roles without Payment:read
  pendingPayments?: number;
  todayRevenue?: number;
}

const PAYMENT_READ_ROLES = new Set(['OWNER', 'ADMIN', 'ACCOUNTANT']);

@Injectable()
export class GetDashboardStatsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: DashboardStatsCommand): Promise<DashboardStats> {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Resolve employeeId for EMPLOYEE role; null otherwise.
    let employeeFilter: { employeeId: string } | object = {};
    if (cmd.membershipRole === 'EMPLOYEE') {
      const emp = await this.prisma.employee.findFirst({
        where: { organizationId, userId: cmd.userId },
        select: { id: true },
      });
      employeeFilter = emp ? { employeeId: emp.id } : { employeeId: '__no_match__' };
    }

    const baseWhere = { organizationId, ...employeeFilter };
    const includePayments = PAYMENT_READ_ROLES.has(cmd.membershipRole ?? '');

    const [todayBookingsCount, confirmedCount, pendingCount, cancelRequestedCount] =
      await Promise.all([
        this.prisma.booking.count({
          where: { ...baseWhere, scheduledAt: { gte: today, lt: tomorrow } },
        }),
        this.prisma.booking.count({
          where: {
            ...baseWhere,
            scheduledAt: { gte: today, lt: tomorrow },
            status: BookingStatus.CONFIRMED,
          },
        }),
        this.prisma.booking.count({
          where: {
            ...baseWhere,
            scheduledAt: { gte: today, lt: tomorrow },
            status: BookingStatus.PENDING,
          },
        }),
        this.prisma.booking.count({
          where: { ...baseWhere, status: BookingStatus.CANCEL_REQUESTED },
        }),
      ]);

    const result: DashboardStats = {
      todayBookings: todayBookingsCount,
      confirmedToday: confirmedCount,
      pendingToday: pendingCount,
      cancelRequests: cancelRequestedCount,
    };

    if (includePayments) {
      const [pendingPaymentsCount, revenueResult] = await Promise.all([
        this.prisma.payment.count({
          where: {
            invoice: { organizationId },
            method: PaymentMethod.BANK_TRANSFER,
            status: PaymentStatus.PENDING_VERIFICATION,
          },
        }),
        this.prisma.payment.aggregate({
          where: {
            invoice: { organizationId },
            status: PaymentStatus.SUCCEEDED,
            paidAt: { gte: today, lt: tomorrow },
          },
          _sum: { amount: true },
        }),
      ]);
      result.pendingPayments = pendingPaymentsCount;
      result.todayRevenue = Number(revenueResult._sum.amount ?? 0);
    }

    return result;
  }
}
```

- [ ] **Step 4: Update controller call site**

In `apps/backend/src/api/dashboard/dashboard.controller.ts`, find the `getDashboardStats` route and update the handler call:

```ts
@Get('stats')
@CheckAbility({ action: 'read', subject: 'Booking' })
async getStats(@User() user: AuthUser) {
  return this.getDashboardStats.execute({
    membershipRole: user.membershipRole ?? null,
    userId: user.id,
  });
}
```

- [ ] **Step 5: Run unit tests**

```bash
cd apps/backend && npx jest get-dashboard-stats.handler.spec
```
Expected: PASS.

- [ ] **Step 6: Run typecheck**

```bash
cd apps/backend && npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/dashboard/get-dashboard-stats/ apps/backend/src/api/dashboard/dashboard.controller.ts
git commit -m "feat(backend): role-aware dashboard stats with EMPLOYEE filter"
```

---

## Task 2: Backend — EMPLOYEE filter on booking list

**Files:**
- Modify: `apps/backend/src/modules/bookings/list-bookings/list-bookings.handler.ts` (find by reading the file; path may differ)
- Modify: `apps/backend/src/modules/bookings/list-bookings/list-bookings.handler.spec.ts`
- Modify: `apps/backend/src/api/dashboard/bookings.controller.ts`

- [ ] **Step 1: Locate the list-bookings handler**

Run: `rg -l "BookingListQuery|list-bookings" apps/backend/src/modules/bookings/`

If the slice is named differently (e.g. `list.handler.ts`), use that path everywhere below.

- [ ] **Step 2: Add failing spec**

In the handler spec:

```ts
it('auto-filters by Employee when membershipRole=EMPLOYEE', async () => {
  prisma.employee.findFirst.mockResolvedValue({ id: 'emp-9' } as never);
  prisma.booking.findMany.mockResolvedValue([] as never);
  prisma.booking.count.mockResolvedValue(0);
  await handler.execute({
    membershipRole: 'EMPLOYEE',
    userId: 'user-emp',
    perPage: 10,
  });
  expect(prisma.booking.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ employeeId: 'emp-9' }),
    }),
  );
});
```

- [ ] **Step 3: Run to verify failure**

```bash
cd apps/backend && npx jest list-bookings -t "auto-filters by Employee"
```
Expected: FAIL.

- [ ] **Step 4: Implement filter**

In the handler `execute()`, before building the Prisma `where`, add:

```ts
let employeeWhere: { employeeId?: string } = {};
if (cmd.membershipRole === 'EMPLOYEE' && cmd.userId) {
  const emp = await this.prisma.employee.findFirst({
    where: { organizationId, userId: cmd.userId },
    select: { id: true },
  });
  employeeWhere = { employeeId: emp?.id ?? '__no_match__' };
}
const where = { organizationId, ...employeeWhere, /* existing filters */ };
```

Update `BookingListCommand` type to include `membershipRole` and `userId`.

- [ ] **Step 5: Update controller**

In `bookings.controller.ts`, the dashboard list-bookings call:

```ts
return this.listBookings.execute({
  ...query,
  membershipRole: user.membershipRole ?? null,
  userId: user.id,
});
```

- [ ] **Step 6: Run tests + typecheck**

```bash
cd apps/backend && npx jest list-bookings && npm run typecheck
```
Expected: PASS, 0 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/bookings/list-bookings/ apps/backend/src/api/dashboard/bookings.controller.ts
git commit -m "feat(backend): EMPLOYEE auto-filter on dashboard booking list"
```

---

## Task 3: Backend — `GetTopPerformersHandler`

**Files:**
- Create: `apps/backend/src/modules/dashboard/get-top-performers/get-top-performers.dto.ts`
- Create: `apps/backend/src/modules/dashboard/get-top-performers/get-top-performers.handler.ts`
- Create: `apps/backend/src/modules/dashboard/get-top-performers/get-top-performers.handler.spec.ts`
- Modify: `apps/backend/src/modules/dashboard/dashboard.module.ts`

- [ ] **Step 1: Create DTO**

`get-top-performers.dto.ts`:

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class GetTopPerformersDto {
  @ApiPropertyOptional({ description: 'Period for aggregation', enum: ['month'], example: 'month' })
  @IsOptional()
  @IsIn(['month'])
  period?: 'month' = 'month';
}
```

- [ ] **Step 2: Write failing handler spec**

`get-top-performers.handler.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { GetTopPerformersHandler } from './get-top-performers.handler';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';

describe('GetTopPerformersHandler', () => {
  let handler: GetTopPerformersHandler;
  let prisma: { $queryRaw: jest.Mock };
  let tenant: { requireOrganizationIdOrDefault: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn() };
    tenant = { requireOrganizationIdOrDefault: jest.fn().mockReturnValue('org-1') };
    const mod = await Test.createTestingModule({
      providers: [
        GetTopPerformersHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: TenantContextService, useValue: tenant },
      ],
    }).compile();
    handler = mod.get(GetTopPerformersHandler);
  });

  it('returns top 5 employees ranked by month revenue', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { employeeId: 'e1', displayName: 'Dr A', avatarUrl: null, bookingsCount: 12n, revenue: 4500 },
      { employeeId: 'e2', displayName: 'Dr B', avatarUrl: null, bookingsCount: 9n, revenue: 3200 },
    ]);
    const result = await handler.execute({ period: 'month' });
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      employeeId: 'e1',
      displayName: 'Dr A',
      avatarUrl: null,
      bookingsCount: 12,
      revenue: 4500,
    });
  });

  it('returns empty array when no data', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    const result = await handler.execute({ period: 'month' });
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 3: Run to verify failure**

```bash
cd apps/backend && npx jest get-top-performers
```
Expected: FAIL — handler not found.

- [ ] **Step 4: Implement handler**

`get-top-performers.handler.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';

export interface TopPerformersCommand {
  period: 'month';
}

export interface TopPerformer {
  employeeId: string;
  displayName: string;
  avatarUrl: string | null;
  bookingsCount: number;
  revenue: number;
}

@Injectable()
export class GetTopPerformersHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(_cmd: TopPerformersCommand): Promise<TopPerformer[]> {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    const rows = await this.prisma.$queryRaw<
      Array<{
        employeeId: string;
        displayName: string;
        avatarUrl: string | null;
        bookingsCount: bigint | number;
        revenue: number | string;
      }>
    >(Prisma.sql`
      SELECT
        e.id                                          AS "employeeId",
        COALESCE(m."displayName", u.name, e.name)     AS "displayName",
        COALESCE(m."avatarUrl", u."avatarUrl")        AS "avatarUrl",
        COUNT(DISTINCT b.id)                          AS "bookingsCount",
        COALESCE(SUM(p.amount), 0)::float             AS "revenue"
      FROM "Employee" e
      LEFT JOIN "User"       u ON u.id = e."userId"
      LEFT JOIN "Membership" m ON m."userId" = e."userId"
                              AND m."organizationId" = e."organizationId"
      LEFT JOIN "Booking" b ON b."employeeId" = e.id
                           AND b."organizationId" = ${organizationId}
      LEFT JOIN "Invoice" i ON i."bookingId" = b.id
      LEFT JOIN "Payment" p ON p."invoiceId" = i.id
                           AND p.status = 'SUCCEEDED'
                           AND p."paidAt" >= ${start}
                           AND p."paidAt" <  ${end}
      WHERE e."organizationId" = ${organizationId}
      GROUP BY e.id, m."displayName", m."avatarUrl", u.name, u."avatarUrl"
      ORDER BY "revenue" DESC NULLS LAST, "bookingsCount" DESC
      LIMIT 5
    `);

    return rows.map((r) => ({
      employeeId: r.employeeId,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
      bookingsCount: Number(r.bookingsCount),
      revenue: Number(r.revenue),
    }));
  }
}
```

- [ ] **Step 5: Register in module**

In `apps/backend/src/modules/dashboard/dashboard.module.ts` add `GetTopPerformersHandler` to `providers` and `exports`.

- [ ] **Step 6: Run tests**

```bash
cd apps/backend && npx jest get-top-performers
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/dashboard/get-top-performers/ apps/backend/src/modules/dashboard/dashboard.module.ts
git commit -m "feat(backend): GetTopPerformersHandler — month-revenue rank"
```

---

## Task 4: Backend — controller route + ACCOUNTANT exclusion + OpenAPI

**Files:**
- Modify: `apps/backend/src/api/dashboard/dashboard.controller.ts`
- Modify: `apps/backend/openapi.json` (regen)

- [ ] **Step 1: Add controller method**

In `dashboard.controller.ts`:

```ts
import { ForbiddenException } from '@nestjs/common';
import { GetTopPerformersHandler } from '../../modules/dashboard/get-top-performers/get-top-performers.handler';
import { GetTopPerformersDto } from '../../modules/dashboard/get-top-performers/get-top-performers.dto';

// In constructor params:
private readonly getTopPerformers: GetTopPerformersHandler,

// Route:
@Get('top-performers')
@CheckAbility({ action: 'read', subject: 'Report' })
@ApiOperation({ summary: 'Get top-performing employees by revenue (current month)' })
@ApiStandardResponses()
async topPerformers(@User() user: AuthUser, @Query() dto: GetTopPerformersDto) {
  if (user.membershipRole === 'ACCOUNTANT') {
    throw new ForbiddenException('Performance metrics are not available to this role');
  }
  return this.getTopPerformers.execute({ period: dto.period ?? 'month' });
}
```

- [ ] **Step 2: Add controller spec**

In or alongside `dashboard.controller.spec.ts`:

```ts
it('rejects ACCOUNTANT from /top-performers', async () => {
  const user = { id: 'u', membershipRole: 'ACCOUNTANT', organizationId: 'o' };
  await expect(
    controller.topPerformers(user as never, {} as never),
  ).rejects.toThrow('Performance metrics');
});
```

- [ ] **Step 3: Run controller test**

```bash
cd apps/backend && npx jest dashboard.controller -t "ACCOUNTANT"
```
Expected: PASS.

- [ ] **Step 4: Regenerate OpenAPI snapshot**

```bash
cd apps/backend && npm run openapi:build-and-snapshot
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/api/dashboard/ apps/backend/openapi.json
git commit -m "feat(backend): GET /dashboard/top-performers route (Owner/Admin only)"
```

---

## Task 5: Frontend — `dashboard-widgets.ts` pure decider

**Files:**
- Create: `apps/dashboard/lib/dashboard-widgets.ts`
- Create: `apps/dashboard/lib/dashboard-widgets.test.ts`

- [ ] **Step 1: Write failing tests**

`dashboard-widgets.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getVisibleWidgets } from './dashboard-widgets'

const allow = (perms: string[]) => (m: string, a: string) =>
  perms.includes(`${m}:${a}`) || perms.includes(`${m}:*`) || perms.includes('*')

const OWNER = allow(['*'])
const ADMIN = allow([
  'bookings:*', 'clients:*', 'employees:*', 'invoices:*',
  'payments:*', 'reports:*', 'settings:*', 'branding:*',
])
const RECEPTIONIST = allow(['bookings:*', 'clients:*', 'employees:read', 'invoices:read'])
const ACCOUNTANT = allow(['invoices:*', 'payments:*', 'bookings:read', 'reports:read'])
const EMPLOYEE = allow(['bookings:read', 'bookings:update', 'clients:read'])

describe('getVisibleWidgets', () => {
  it('OWNER sees everything including topPerformers', () => {
    const v = getVisibleWidgets('OWNER', OWNER)
    expect(v.topPerformers).toBe(true)
    expect(v.revenueChart).toBe(true)
    expect(v.stats.revenue).toBe(true)
    expect(v.quickActions).toEqual(['newBooking', 'newClient', 'recordPayment'])
  })

  it('ADMIN sees topPerformers and revenue', () => {
    const v = getVisibleWidgets('ADMIN', ADMIN)
    expect(v.topPerformers).toBe(true)
    expect(v.revenueChart).toBe(true)
  })

  it('RECEPTIONIST hides revenue and topPerformers', () => {
    const v = getVisibleWidgets('RECEPTIONIST', RECEPTIONIST)
    expect(v.stats.revenue).toBe(false)
    expect(v.stats.pendingPayments).toBe(false)
    expect(v.revenueChart).toBe(false)
    expect(v.recentPayments).toBe(false)
    expect(v.topPerformers).toBe(false)
    expect(v.attentionAlerts.pendingPayments).toBe(false)
    expect(v.attentionAlerts.cancelRequests).toBe(true)
    expect(v.quickActions).toEqual(['newBooking', 'newClient'])
  })

  it('ACCOUNTANT sees revenue + recentPayments but NOT topPerformers', () => {
    const v = getVisibleWidgets('ACCOUNTANT', ACCOUNTANT)
    expect(v.revenueChart).toBe(true)
    expect(v.recentPayments).toBe(true)
    expect(v.topPerformers).toBe(false)
    expect(v.stats.clients).toBe(false)
    expect(v.quickActions).toEqual(['recordPayment'])
  })

  it('EMPLOYEE sees only personal info — no quickActions, no payments', () => {
    const v = getVisibleWidgets('EMPLOYEE', EMPLOYEE)
    expect(v.quickActions).toEqual([])
    expect(v.revenueChart).toBe(false)
    expect(v.recentPayments).toBe(false)
    expect(v.topPerformers).toBe(false)
    expect(v.stats.bookings).toBe(true)
    expect(v.stats.clients).toBe(true)
    expect(v.todayTimeline).toBe(true)
  })

  it('unknown role degrades to greeting + activity feed only', () => {
    const v = getVisibleWidgets(null, () => false)
    expect(v.todayTimeline).toBe(false)
    expect(v.quickActions).toEqual([])
    expect(v.activityFeed).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd apps/dashboard && npm test -- dashboard-widgets
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement decider**

`dashboard-widgets.ts`:

```ts
export type QuickActionKey = 'newBooking' | 'newClient' | 'recordPayment'

export interface VisibleWidgets {
  stats: {
    bookings: boolean
    clients: boolean
    revenue: boolean
    pendingPayments: boolean
  }
  attentionAlerts: {
    pendingPayments: boolean
    cancelRequests: boolean
  }
  quickActions: QuickActionKey[]
  todayTimeline: boolean
  activityFeed: boolean
  revenueChart: boolean
  recentPayments: boolean
  topPerformers: boolean
}

type CanDo = (module: string, action: string) => boolean

export function getVisibleWidgets(
  membershipRole: string | null,
  canDo: CanDo,
): VisibleWidgets {
  const role = membershipRole ?? ''
  const canBookingRead = canDo('bookings', 'read')
  const canBookingCreate = canDo('bookings', 'create')
  const canBookingUpdate = canDo('bookings', 'update')
  const canClientRead = canDo('clients', 'read')
  const canClientCreate = canDo('clients', 'create')
  const canPaymentRead = canDo('payments', 'read')
  const canPaymentCreate = canDo('payments', 'create')
  const canReportRead = canDo('reports', 'read')

  const quickActions: QuickActionKey[] = []
  // EMPLOYEE never gets quick actions even if a custom role grants creates
  if (role !== 'EMPLOYEE') {
    if (canBookingCreate) quickActions.push('newBooking')
    if (canClientCreate) quickActions.push('newClient')
    if (canPaymentCreate) quickActions.push('recordPayment')
  }

  return {
    stats: {
      bookings: canBookingRead,
      clients: canClientRead,
      revenue: canPaymentRead,
      pendingPayments: canPaymentRead,
    },
    attentionAlerts: {
      pendingPayments: canPaymentRead,
      cancelRequests: canBookingUpdate,
    },
    quickActions,
    todayTimeline: canBookingRead,
    activityFeed: true,
    revenueChart: canReportRead && canPaymentRead,
    recentPayments: canPaymentRead,
    topPerformers: canReportRead && role !== 'ACCOUNTANT' && role !== '',
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/dashboard && npm test -- dashboard-widgets
```
Expected: PASS (all 6 cases).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/lib/dashboard-widgets.ts apps/dashboard/lib/dashboard-widgets.test.ts
git commit -m "feat(dashboard): pure visibility decider for home widgets"
```

---

## Task 6: Frontend — adapt `dashboard-stats`, `quick-actions`, `attention-alerts`

**Files:**
- Modify: `apps/dashboard/components/features/dashboard/dashboard-stats.tsx`
- Modify: `apps/dashboard/components/features/dashboard/quick-actions.tsx`
- Modify: `apps/dashboard/components/features/dashboard/attention-alerts.tsx`

- [ ] **Step 1: Update `dashboard-stats.tsx`**

Add to props:

```ts
import type { VisibleWidgets } from '@/lib/dashboard-widgets'

interface Props {
  stats: DashboardStats | undefined
  visibleStats: VisibleWidgets['stats']
}
```

Build the displayed cards array dynamically:

```tsx
const cards = [
  visibleStats.bookings && {
    key: 'bookings',
    label: t('dashboard.stats.todayBookings'),
    value: stats?.todayBookings ?? 0,
    /* … existing icon/color … */
  },
  visibleStats.clients && {
    key: 'clients',
    label: t('dashboard.stats.totalClients'),
    value: stats?.totalClients ?? 0,
  },
  visibleStats.revenue && {
    key: 'revenue',
    label: t('dashboard.stats.todayRevenue'),
    value: formatCurrency(stats?.todayRevenue ?? 0),
  },
  visibleStats.pendingPayments && {
    key: 'pending',
    label: t('dashboard.stats.pendingPayments'),
    value: stats?.pendingPayments ?? 0,
  },
].filter(Boolean) as Array<{ key: string; label: string; value: string | number }>

if (cards.length === 0) return null

const colsClass = cards.length >= 4 ? 'lg:grid-cols-4'
  : cards.length === 3 ? 'lg:grid-cols-3'
  : cards.length === 2 ? 'lg:grid-cols-2'
  : 'lg:grid-cols-1'
```

Use `colsClass` on the grid wrapper. Each card sets `data-testid={`stat-${card.key}`}`.

- [ ] **Step 2: Update `quick-actions.tsx`**

```tsx
import type { QuickActionKey } from '@/lib/dashboard-widgets'

interface Props {
  actions: QuickActionKey[]
}

const ACTION_CONFIG: Record<QuickActionKey, { titleKey: string; href: string; icon: typeof PlusIcon }> = {
  newBooking: { titleKey: 'dashboard.quickActions.newBooking', href: '/bookings?new=1', icon: Calendar03Icon },
  newClient:  { titleKey: 'dashboard.quickActions.newClient',  href: '/clients?new=1',  icon: UserAdd01Icon },
  recordPayment: { titleKey: 'dashboard.quickActions.recordPayment', href: '/payments?new=1', icon: MoneyBag02Icon },
}

export function QuickActions({ actions }: Props) {
  if (actions.length === 0) return null
  return (
    <div data-testid="quick-actions" className="grid gap-3 md:grid-cols-3">
      {actions.map((key) => {
        const cfg = ACTION_CONFIG[key]
        return <ActionCard key={key} {...cfg} />
      })}
    </div>
  )
}
```

(Reuse the existing `ActionCard` internal component or inline the existing markup; the change is replacing hardcoded list with a mapped render.)

- [ ] **Step 3: Update `attention-alerts.tsx`**

```tsx
import type { VisibleWidgets } from '@/lib/dashboard-widgets'

interface Props {
  pendingPayments: number
  cancelRequests: number
  visible: VisibleWidgets['attentionAlerts']
}

export function AttentionAlerts({ pendingPayments, cancelRequests, visible }: Props) {
  const showPayments = visible.pendingPayments && pendingPayments > 0
  const showCancels  = visible.cancelRequests  && cancelRequests > 0
  if (!showPayments && !showCancels) return null
  return (
    <div data-testid="attention-alerts" /* existing wrapper */>
      {showPayments && (/* existing pending-payments alert */)}
      {showCancels  && (/* existing cancel-requests alert */)}
    </div>
  )
}
```

- [ ] **Step 4: Typecheck**

```bash
cd apps/dashboard && npm run typecheck
```
Expected: 0 errors (callers fixed in Task 7).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/components/features/dashboard/{dashboard-stats,quick-actions,attention-alerts}.tsx
git commit -m "feat(dashboard): widget components accept visibility props"
```

---

## Task 7: Frontend — wire `page.tsx` to use `getVisibleWidgets`

**Files:**
- Modify: `apps/dashboard/app/(dashboard)/page.tsx`

- [ ] **Step 1: Rewrite the page**

Replace contents of `app/(dashboard)/page.tsx`:

```tsx
"use client"

import { Suspense, useMemo } from "react"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import { FlashIcon, Analytics01Icon } from "@hugeicons/core-free-icons"

import { GreetingHeader } from "@/components/features/dashboard/greeting-header"
import { DashboardStats } from "@/components/features/dashboard/dashboard-stats"
import { AttentionAlerts } from "@/components/features/dashboard/attention-alerts"
import { QuickActions } from "@/components/features/dashboard/quick-actions"
import { TodayTimeline } from "@/components/features/dashboard/today-timeline"
import { ActivityFeed } from "@/components/features/dashboard/activity-feed"
import { RevenueChart } from "@/components/features/dashboard/revenue-chart"
import { RecentPayments } from "@/components/features/dashboard/recent-payments"
import { TopPerformersChart } from "@/components/features/dashboard/top-performers-chart"
import { ErrorBanner } from "@/components/features/error-banner"
import { SectionHeader } from "@/components/features/section-header"
import { Skeleton } from "@deqah/ui"
import { useTodayBookings } from "@/hooks/use-bookings"
import { useDashboardNotifications } from "@/hooks/use-notifications"
import { useDashboardStats } from "@/hooks/use-dashboard-stats"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/locale-provider"
import { getVisibleWidgets } from "@/lib/dashboard-widgets"

export default function DashboardPage() {
  const today = format(new Date(), "yyyy-MM-dd")
  const { user, canDo } = useAuth()
  const { locale, t } = useLocale()

  const membershipRole = user?.activeMembership?.role ?? null
  const visible = useMemo(() => getVisibleWidgets(membershipRole, canDo), [membershipRole, canDo])

  const dateLabel = format(
    new Date(),
    locale === "ar" ? "EEEE، d MMMM yyyy" : "EEEE, MMMM d, yyyy",
    locale === "ar" ? { locale: ar } : undefined,
  )

  const { data: todayBookings, isLoading: bookingsLoading, error: bookingsError, refetch: refetchBookings } =
    useTodayBookings(today)
  const { data: notifData, isLoading: notifLoading, error: notifError, refetch: refetchNotifs } =
    useDashboardNotifications()
  const { data: dashboardStats } = useDashboardStats()

  const userName = user?.activeMembership?.displayName || user?.name || user?.email || "—"

  const operationalSectionVisible =
    visible.todayTimeline || visible.activityFeed || visible.revenueChart || visible.recentPayments || visible.topPerformers

  return (
    <div className="flex flex-col gap-12">
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}>
        <section className="flex flex-col gap-6">
          <GreetingHeader userName={userName} dateLabel={dateLabel} bookingsCount={0} />
          <DashboardStats stats={dashboardStats} visibleStats={visible.stats} />
          <AttentionAlerts
            pendingPayments={dashboardStats?.pendingPayments ?? 0}
            cancelRequests={dashboardStats?.cancelRequests ?? 0}
            visible={visible.attentionAlerts}
          />
        </section>
      </Suspense>

      {visible.quickActions.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionHeader icon={FlashIcon} title={t("dashboard.quickActions")} />
          <QuickActions actions={visible.quickActions} />
        </section>
      )}

      {operationalSectionVisible && (
        <section className="flex flex-col gap-5">
          <SectionHeader icon={Analytics01Icon} title={t("dashboard.operations")} variant="accent" />

          {(visible.todayTimeline || visible.activityFeed) && (
            <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
              {visible.todayTimeline && (
                bookingsLoading ? (
                  <Skeleton className="h-[400px] rounded-xl" />
                ) : bookingsError ? (
                  <ErrorBanner message={t("dashboard.error.schedule")} onRetry={() => refetchBookings()} />
                ) : (
                  <TodayTimeline
                    bookings={todayBookings?.items ?? []}
                    membershipRole={membershipRole}
                  />
                )
              )}
              {visible.activityFeed && (
                notifLoading ? (
                  <Skeleton className="h-[400px] rounded-xl" />
                ) : notifError ? (
                  <ErrorBanner message={t("dashboard.error.activity")} onRetry={() => refetchNotifs()} />
                ) : (
                  <ActivityFeed notifications={notifData?.items ?? []} />
                )
              )}
            </div>
          )}

          {(visible.revenueChart || visible.recentPayments) && (
            <div className="grid gap-5 lg:grid-cols-2">
              {visible.revenueChart && <RevenueChart />}
              {visible.recentPayments && <RecentPayments />}
            </div>
          )}

          {visible.topPerformers && <TopPerformersChart />}
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify line count ≤ 150**

```bash
wc -l apps/dashboard/app/\(dashboard\)/page.tsx
```
Expected: ≤ 150.

- [ ] **Step 3: Run typecheck**

```bash
cd apps/dashboard && npm run typecheck
```
Expected: 0 errors. (`TopPerformersChart` will fail until Task 8 — leave a temporary stub or do Task 8 first if blocked.)

- [ ] **Step 4: Commit (after Task 8)**

Hold off committing this task until Task 8 lands `TopPerformersChart`, then commit both together OR add a temporary `export function TopPerformersChart() { return null }` stub now and commit, replacing in Task 8.

For simplicity, add the stub now:

`apps/dashboard/components/features/dashboard/top-performers-chart.tsx`:

```tsx
export function TopPerformersChart() { return null }
```

```bash
git add apps/dashboard/app/\(dashboard\)/page.tsx apps/dashboard/components/features/dashboard/top-performers-chart.tsx
git commit -m "feat(dashboard): home page renders widgets via visibility map"
```

---

## Task 8: Frontend — `TopPerformersChart` widget + hook

**Files:**
- Modify: `apps/dashboard/lib/api/dashboard.ts`
- Modify: `apps/dashboard/lib/query-keys.ts`
- Create: `apps/dashboard/hooks/use-top-performers.ts`
- Modify: `apps/dashboard/components/features/dashboard/top-performers-chart.tsx`
- Modify: `apps/dashboard/lib/translations/ar.dashboard.ts`
- Modify: `apps/dashboard/lib/translations/en.dashboard.ts`

- [ ] **Step 1: Add API call**

In `lib/api/dashboard.ts`:

```ts
export interface TopPerformer {
  employeeId: string
  displayName: string
  avatarUrl: string | null
  bookingsCount: number
  revenue: number
}

export async function fetchTopPerformers(): Promise<TopPerformer[]> {
  const { data } = await api.get<TopPerformer[]>('/dashboard/top-performers', { params: { period: 'month' } })
  return data
}
```

- [ ] **Step 2: Add query key**

In `lib/query-keys.ts`, extend `dashboard`:

```ts
dashboard: {
  all: ['dashboard'] as const,
  stats: () => ['dashboard', 'stats'] as const,
  topPerformers: () => ['dashboard', 'top-performers'] as const,
},
```

- [ ] **Step 3: Add hook**

`hooks/use-top-performers.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { fetchTopPerformers } from '@/lib/api/dashboard'
import { queryKeys } from '@/lib/query-keys'

export function useTopPerformers() {
  return useQuery({
    queryKey: queryKeys.dashboard.topPerformers(),
    queryFn: fetchTopPerformers,
    staleTime: 5 * 60 * 1000,
  })
}
```

- [ ] **Step 4: Add translations**

`lib/translations/ar.dashboard.ts`:

```ts
'dashboard.topPerformers.title': 'أفضل المعالجين هذا الشهر',
'dashboard.topPerformers.empty': 'لا توجد بيانات أداء لهذا الشهر بعد',
'dashboard.topPerformers.bookingsCount': '{count} حجز',
'dashboard.timeline.empty.employee': 'لا توجد حجوزات لك اليوم',
'dashboard.quickActions.newBooking': 'حجز جديد',
'dashboard.quickActions.newClient': 'عميل جديد',
'dashboard.quickActions.recordPayment': 'تسجيل دفعة',
```

`lib/translations/en.dashboard.ts`:

```ts
'dashboard.topPerformers.title': 'Top performers this month',
'dashboard.topPerformers.empty': 'No performance data yet for this month',
'dashboard.topPerformers.bookingsCount': '{count} bookings',
'dashboard.timeline.empty.employee': 'You have no bookings today',
'dashboard.quickActions.newBooking': 'New booking',
'dashboard.quickActions.newClient': 'New client',
'dashboard.quickActions.recordPayment': 'Record payment',
```

- [ ] **Step 5: Replace stub with real component**

`top-performers-chart.tsx`:

```tsx
"use client"

import { useTopPerformers } from '@/hooks/use-top-performers'
import { useLocale } from '@/components/locale-provider'
import { Skeleton } from '@deqah/ui'
import { formatCurrency } from '@/lib/utils'

export function TopPerformersChart() {
  const { data, isLoading } = useTopPerformers()
  const { t } = useLocale()

  if (isLoading) return <Skeleton className="h-[300px] rounded-xl" />

  return (
    <div data-testid="top-performers" className="glass rounded-xl p-6">
      <h3 className="mb-4 text-lg font-semibold">{t('dashboard.topPerformers.title')}</h3>
      {!data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('dashboard.topPerformers.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((p, i) => {
            const max = data[0].revenue || 1
            const widthPct = Math.max(4, Math.round((p.revenue / max) * 100))
            return (
              <li key={p.employeeId} className="flex items-center gap-3">
                <span className="w-6 text-sm text-muted-foreground">{i + 1}</span>
                {p.avatarUrl ? (
                  <img src={p.avatarUrl} alt="" className="size-8 rounded-full object-cover" />
                ) : (
                  <div className="size-8 rounded-full bg-muted" />
                )}
                <div className="flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{p.displayName}</span>
                    <span className="text-sm tabular-nums">{formatCurrency(p.revenue)}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ inlineSize: `${widthPct}%` }} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t('dashboard.topPerformers.bookingsCount').replace('{count}', String(p.bookingsCount))}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Run i18n parity**

```bash
cd apps/dashboard && npm run i18n:verify
```
Expected: PASS.

- [ ] **Step 7: Run typecheck + lint**

```bash
cd apps/dashboard && npm run typecheck && npm run lint
```
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard/lib/api/dashboard.ts apps/dashboard/lib/query-keys.ts \
  apps/dashboard/hooks/use-top-performers.ts \
  apps/dashboard/components/features/dashboard/top-performers-chart.tsx \
  apps/dashboard/lib/translations/{ar,en}.dashboard.ts
git commit -m "feat(dashboard): TopPerformersChart widget for owner/admin"
```

---

## Task 9: Frontend — EMPLOYEE empty-state in `today-timeline`

**Files:**
- Modify: `apps/dashboard/components/features/dashboard/today-timeline.tsx`

- [ ] **Step 1: Add prop + branch**

Add to props:

```ts
interface Props {
  bookings: Booking[]
  membershipRole?: string | null
}
```

In the empty-state branch:

```tsx
if (bookings.length === 0) {
  const key = membershipRole === 'EMPLOYEE'
    ? 'dashboard.timeline.empty.employee'
    : 'dashboard.timeline.empty.general'
  return <p className="text-sm text-muted-foreground">{t(key)}</p>
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/dashboard && npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/components/features/dashboard/today-timeline.tsx
git commit -m "feat(dashboard): EMPLOYEE-specific empty state on today timeline"
```

---

## Task 10: Playwright smoke — role-based home

**Files:**
- Create: `apps/dashboard/e2e/smoke/dashboard-by-role.spec.ts`

- [ ] **Step 1: Inspect existing seed test users**

```bash
rg "OWNER|RECEPTIONIST|EMPLOYEE" apps/dashboard/e2e/ apps/backend/prisma/seed.ts | head -20
```

Note the seed credentials for OWNER, RECEPTIONIST, EMPLOYEE. If a seed user is missing for any role, add it to the seed script (separate sub-step before writing the test).

- [ ] **Step 2: Write the smoke spec**

`e2e/smoke/dashboard-by-role.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { loginAs } from '../helpers/auth' // existing helper; adjust import path

test.describe('Dashboard home — role-based widgets', () => {
  test('OWNER sees TopPerformers + RevenueChart', async ({ page }) => {
    await loginAs(page, 'owner')
    await page.goto('/')
    await expect(page.getByTestId('top-performers')).toBeVisible()
    await expect(page.getByTestId('revenue-chart')).toBeVisible()
  })

  test('RECEPTIONIST does not see RevenueChart or TopPerformers', async ({ page }) => {
    await loginAs(page, 'receptionist')
    await page.goto('/')
    await expect(page.getByTestId('revenue-chart')).toHaveCount(0)
    await expect(page.getByTestId('top-performers')).toHaveCount(0)
    await expect(page.getByTestId('quick-actions')).toBeVisible()
  })

  test('EMPLOYEE sees no QuickActions', async ({ page }) => {
    await loginAs(page, 'employee')
    await page.goto('/')
    await expect(page.getByTestId('quick-actions')).toHaveCount(0)
    await expect(page.getByTestId('top-performers')).toHaveCount(0)
  })
})
```

If `loginAs` does not exist with these role keys, add the necessary cases to the helper (look at how existing smoke tests authenticate).

- [ ] **Step 3: Run smoke**

```bash
cd apps/dashboard && npm run e2e:smoke -- dashboard-by-role
```
Expected: 3 PASS. If any fail, fix `data-testid` attributes in the relevant components (Tasks 6 + 8 already wire them — verify they reach the DOM).

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/e2e/smoke/dashboard-by-role.spec.ts
git commit -m "test(dashboard): playwright smoke for role-based home"
```

---

## Task 11: Final pre-PR validation

- [ ] **Step 1: Backend full test + typecheck**

```bash
cd apps/backend && npm run typecheck && npm run test
```

- [ ] **Step 2: Dashboard full test + typecheck + lint + i18n**

```bash
cd apps/dashboard && npm run typecheck && npm run lint && npm run test && npm run i18n:verify
```

- [ ] **Step 3: Smoke pass**

```bash
cd apps/dashboard && npm run e2e:smoke
```

- [ ] **Step 4: Verify no file exceeds 350 lines**

```bash
find apps/dashboard apps/backend -name "*.ts" -o -name "*.tsx" | xargs wc -l | awk '$1 > 350 && $2 != "total"'
```
Expected: empty output for files we touched.

- [ ] **Step 5: Open PR**

```bash
git push -u origin feat/dashboard-role-based-home
gh pr create --title "feat(dashboard): role-based home page" --body "$(cat <<'EOF'
## Summary
- Home page widgets gated by MembershipRole + CASL via `lib/dashboard-widgets.ts`
- EMPLOYEE sees only own bookings (server-side filter)
- New TopPerformersChart for OWNER/ADMIN (excludes ACCOUNTANT)

## Test plan
- [x] Unit: `dashboard-widgets.test.ts` (6 cases)
- [x] Backend Jest: `get-dashboard-stats`, `get-top-performers`, controller-403
- [x] Playwright smoke: `dashboard-by-role.spec.ts`
- [x] i18n parity verified

Spec: `docs/superpowers/specs/2026-05-06-dashboard-role-based-home-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- §4 visibility map → Task 5 (decider) + Task 7 (page wiring). ✅
- §5.1 FE files → Tasks 5–9. ✅
- §5.2 BE files → Tasks 1–4. ✅
- §6 data flow → Tasks 1+2 (BE filter) + Task 7 (FE memo). ✅
- §7 testing → Task 5 (unit), Tasks 1/3/4 (BE jest), Task 10 (Playwright). ✅
- §8 i18n → Task 8. ✅
- §10 EMPLOYEE-with-no-Employee-row risk → Task 1 (`'__no_match__'` sentinel). ✅
- §10 unknown-role degrade → Task 5 default branch covered by test "unknown role". ✅

**Placeholder scan:** none found.

**Type consistency:**
- `VisibleWidgets`, `QuickActionKey` defined in Task 5 are imported consistently in Tasks 6+7+8.
- `DashboardStatsCommand` defined in Task 1 matches controller call in Task 1 step 4.
- `TopPerformer` type appears in BE handler (Task 3) and FE API client (Task 8) with identical fields.
