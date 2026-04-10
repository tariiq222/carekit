# Services P1 Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three P1 bugs in the Services module: inactive practitioners returned in patient-facing endpoint, unbounded `perPage` (DoS vector), and active/inactive stats cards calculated from paginated data instead of totals.

**Architecture:** All surgical. No new files.

**Tech Stack:** NestJS 11, Prisma 7, TypeScript strict, Jest, Next.js 15

---

## Files

- Modify: `backend/src/modules/services/service-practitioners.service.ts`
- Modify: `backend/src/modules/services/dto/service-list-query.dto.ts`
- Modify: `dashboard/components/features/services/services-tab-content.tsx`
- Modify: `dashboard/hooks/use-services.ts` (add `listStats` query if needed)
- Test: `backend/test/unit/services/service-practitioners.service.spec.ts`
- Test: `backend/test/unit/services/services.service.spec.ts`

---

## Task 1: Filter out inactive practitioners from `getPractitionersForService`

**Files:**
- Modify: `backend/src/modules/services/service-practitioners.service.ts`
- Test: `backend/test/unit/services/service-practitioners.service.spec.ts`

**Problem:** `getPractitionersForService` (lines 14-52) returns practitioners without filtering `isActive` or `deletedAt`. A soft-deleted or deactivated practitioner appears in the patient's booking list.

- [ ] **Step 1: Write the failing test**

Create `backend/test/unit/services/service-practitioners.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { ServicePractitionersService } from '../../../src/modules/services/service-practitioners.service.js';
import { ServicesService } from '../../../src/modules/services/services.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

describe('ServicePractitionersService', () => {
  let service: ServicePractitionersService;
  let prisma: jest.Mocked<PrismaService>;
  let servicesService: jest.Mocked<ServicesService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ServicePractitionersService,
        {
          provide: ServicesService,
          useValue: { ensureExists: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: PrismaService,
          useValue: { practitionerService: { findMany: jest.fn() } },
        },
      ],
    }).compile();

    service = module.get(ServicePractitionersService);
    prisma = module.get(PrismaService);
    servicesService = module.get(ServicesService);
  });

  it('should only return active, non-deleted practitioners', async () => {
    prisma.practitionerService.findMany.mockResolvedValue([
      {
        practitioner: { id: 'p-1', isActive: true, deletedAt: null, nameAr: 'طبيب', title: 'Dr', user: { firstName: 'Ahmad', lastName: 'Ali', avatarUrl: null } },
        serviceTypes: [],
      },
      {
        practitioner: { id: 'p-2', isActive: false, deletedAt: null, nameAr: 'طبيب', title: 'Dr', user: { firstName: 'Khalid', lastName: 'Omar', avatarUrl: null } },
        serviceTypes: [],
      },
    ] as never);

    const result = await service.getPractitionersForService('service-1');

    // The query itself should include the isActive filter — not post-filter in JS
    expect(prisma.practitionerService.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          practitioner: expect.objectContaining({
            isActive: true,
            deletedAt: null,
          }),
        }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test -- --testPathPattern="service-practitioners" --no-coverage
```

Expected: FAIL — current query has no `isActive`/`deletedAt` filter.

- [ ] **Step 3: Implement the fix**

In `service-practitioners.service.ts`, update the `where` clause in `getPractitionersForService`:

```typescript
const rows = await this.prisma.practitionerService.findMany({
  where: {
    serviceId,
    practitioner: {
      isActive: true,
      deletedAt: null,
      ...(branchId && {
        branches: { some: { branchId } },
      }),
    },
  },
  include: {
    practitioner: {
      select: {
        id: true,
        nameAr: true,
        title: true,
        isActive: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    },
    serviceTypes: {
      select: {
        id: true,
        bookingType: true,
        price: true,
        duration: true,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    },
  },
  orderBy: { createdAt: 'asc' },
});
```

Note: The `branchId` condition moved inside the `practitioner` filter (previously it was at the top level alongside `serviceId`, which was logically correct but now we consolidate).

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test -- --testPathPattern="service-practitioners" --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tariq/Documents/my_programs/CareKit
git add backend/src/modules/services/service-practitioners.service.ts \
        backend/test/unit/services/service-practitioners.service.spec.ts
git commit -m "fix(services): exclude inactive/deleted practitioners from getPractitionersForService

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Add `@Max(100)` to `perPage` in `ServiceListQueryDto`

**Files:**
- Modify: `backend/src/modules/services/dto/service-list-query.dto.ts`
- Test: `backend/test/unit/services/services.service.spec.ts`

**Problem:** `perPage` accepts any positive integer. A request with `?perPage=10000` returns thousands of rows with `include: { category: true }`, creating memory pressure and slow response.

- [ ] **Step 1: Write the failing test**

In `backend/test/unit/services/services.service.spec.ts`, add a validation test:

```typescript
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ServiceListQueryDto } from '../../../src/modules/services/dto/service-list-query.dto.js';

describe('ServiceListQueryDto validation', () => {
  it('should reject perPage > 100', async () => {
    const dto = plainToInstance(ServiceListQueryDto, { perPage: 500 });
    const errors = await validate(dto);
    const perPageError = errors.find((e) => e.property === 'perPage');
    expect(perPageError).toBeDefined();
  });

  it('should accept perPage = 100', async () => {
    const dto = plainToInstance(ServiceListQueryDto, { perPage: 100 });
    const errors = await validate(dto);
    const perPageError = errors.find((e) => e.property === 'perPage');
    expect(perPageError).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test -- --testPathPattern="services.service" --no-coverage
```

Expected: FAIL (perPage=500 currently passes validation)

- [ ] **Step 3: Implement the fix**

In `service-list-query.dto.ts`, add `Max` to imports and add `@Max(100)` decorator:

```typescript
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ServiceListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number;

  // ... rest unchanged
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test -- --testPathPattern="services.service" --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/tariq/Documents/my_programs/CareKit
git add backend/src/modules/services/dto/service-list-query.dto.ts \
        backend/test/unit/services/services.service.spec.ts
git commit -m "fix(services): cap perPage at 100 in ServiceListQueryDto to prevent unbounded queries

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Fix Stats Cards — use backend aggregate instead of counting page items

**Files:**
- Modify: `dashboard/components/features/services/services-tab-content.tsx`

**Problem:** `services.filter((s) => s.isActive).length` counts only the current page (up to 20 items). With 80 total services, the stats show "5 active" when the real total is 50. The backend already has a `/services/list-stats` endpoint pattern used in other modules.

Check if `/services/list-stats` exists first:

- [ ] **Step 1: Check if list-stats endpoint exists**

```bash
grep -n "list-stats\|listStats\|getListStats" \
  /Users/tariq/Documents/my_programs/CareKit/backend/src/modules/services/services.controller.ts \
  /Users/tariq/Documents/my_programs/CareKit/backend/src/modules/services/services.service.ts
```

Note what you find. If it exists, use it. If not, follow Step 2a (add to backend). If it already returns active/inactive counts, skip to Step 3.

- [ ] **Step 2a: (Only if list-stats doesn't exist) Add `getListStats` to `services.service.ts`**

Add this method to `ServicesService`:

```typescript
async getListStats() {
  const base = { deletedAt: null };

  const [total, active, inactive] = await Promise.all([
    this.prisma.service.count({ where: base }),
    this.prisma.service.count({ where: { ...base, isActive: true } }),
    this.prisma.service.count({ where: { ...base, isActive: false } }),
  ]);

  return { total, active, inactive };
}
```

And add the endpoint to `services.controller.ts` (before `:id` route to avoid param collision):

```typescript
@Get('list-stats')
@CheckPermissions({ module: 'services', action: 'view' })
@ApiOperation({ summary: 'Get aggregate stats for service list' })
async getListStats() {
  return this.servicesService.getListStats();
}
```

- [ ] **Step 2b: (Only if list-stats doesn't exist) Add API function in dashboard**

In `dashboard/lib/api/services.ts`, add:

```typescript
export async function fetchServicesListStats(): Promise<{ total: number; active: number; inactive: number }> {
  return api.get('/services/list-stats');
}
```

- [ ] **Step 2c: (Only if list-stats doesn't exist) Add hook in `use-services.ts`**

In `dashboard/hooks/use-services.ts`, add:

```typescript
export function useServicesListStats() {
  return useQuery({
    queryKey: queryKeys.services.listStats(),
    queryFn: fetchServicesListStats,
    staleTime: 30 * 1000,
  });
}
```

Ensure `queryKeys.services.listStats` exists in `lib/query-keys.ts`. If not, add:

```typescript
listStats: () => [...services.all, 'list-stats'] as const,
```

- [ ] **Step 3: Update `services-tab-content.tsx` to use aggregate stats**

In `services-tab-content.tsx`, replace the two `StatCard` values that calculate from the page array. Import and use the stats hook:

```typescript
// Add near top of component (with existing hooks):
const { data: listStats } = useServicesListStats();
```

Replace:

```typescript
// BEFORE (wrong — counts only current page):
value={services.filter((s) => s.isActive).length}
// ...
value={services.filter((s) => !s.isActive).length}
```

With:

```typescript
// AFTER (correct — from backend aggregate):
value={listStats?.active ?? 0}
// ...
value={listStats?.inactive ?? 0}
```

Also update the `total` StatCard to use `listStats?.total` instead of `meta?.total` for consistency.

- [ ] **Step 4: Run typecheck on dashboard**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/dashboard
npm run typecheck
```

Expected: 0 errors

- [ ] **Step 5: Run full backend test suite**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test --no-coverage
```

Expected: All passing

- [ ] **Step 6: Commit**

```bash
cd /Users/tariq/Documents/my_programs/CareKit
git add backend/src/modules/services/services.service.ts \
        backend/src/modules/services/services.controller.ts \
        dashboard/lib/api/services.ts \
        dashboard/hooks/use-services.ts \
        dashboard/components/features/services/services-tab-content.tsx
git commit -m "fix(services): use backend aggregate for stats cards — fixes incorrect active/inactive counts on paginated pages

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
