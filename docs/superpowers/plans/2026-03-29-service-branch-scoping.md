# Service Branch Scoping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow services (and surface practitioners) to be restricted to specific branches, defaulting to all branches when no restriction is set.

**Architecture:** A new `ServiceBranch` M2M join table follows the same pattern as `PractitionerBranch`. Empty = all branches; records present = restricted to those branches only. The same `OR [none, some]` filter is applied in every endpoint that accepts `branchId`.

**Tech Stack:** NestJS 11, Prisma 7, PostgreSQL, class-validator, Jest

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `backend/prisma/schema/services.prisma` | Add `ServiceBranch` model + relation on `Service` |
| Modify | `backend/prisma/schema/clinic.prisma` | Add `services` relation to `Branch` |
| Create | `backend/prisma/migrations/20260329120000_add_service_branches/migration.sql` | DDL for new table |
| Modify | `backend/src/modules/services/dto/service-list-query.dto.ts` | Add optional `branchId` field |
| Create | `backend/src/modules/services/dto/set-service-branches.dto.ts` | `{ branchIds: string[] }` |
| Modify | `backend/src/modules/services/services.service.ts` | Add `branchId` filter to `queryServices`, add `setBranches` / `clearBranches` methods |
| Modify | `backend/src/modules/services/service-practitioners.service.ts` | Add `branchId` filter when listing practitioners |
| Modify | `backend/src/modules/services/services.controller.ts` | Add `PUT /:id/branches` and `DELETE /:id/branches` endpoints |
| Modify | `backend/src/modules/bookings/booking-creation.service.ts` | Validate service available at booking's branch |
| Modify | `backend/src/modules/services/tests/services.service.spec.ts` | Add tests for branch filtering, setBranches, clearBranches |

---

## Task 1: Schema — Add `ServiceBranch` model

**Files:**
- Modify: `backend/prisma/schema/services.prisma`
- Modify: `backend/prisma/schema/clinic.prisma`

- [ ] **Step 1: Add `ServiceBranch` model to `services.prisma`**

Open `backend/prisma/schema/services.prisma`. After the closing `}` of the `Service` model (after `@@map("services")`), add the `ServiceBranch` model. Also add `branches ServiceBranch[]` to the `Service` model's relations block (after `couponServices CouponService[]`):

In `Service` model, add after `couponServices CouponService[]`:
```prisma
  branches             ServiceBranch[]
```

After the `Service` model closing brace, add:
```prisma
model ServiceBranch {
  id        String   @id @default(uuid())
  serviceId String   @map("service_id")
  branchId  String   @map("branch_id")
  createdAt DateTime @default(now()) @map("created_at")

  service Service @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  branch  Branch  @relation(fields: [branchId], references: [id], onDelete: Cascade)

  @@unique([serviceId, branchId])
  @@index([branchId])
  @@map("service_branches")
}
```

- [ ] **Step 2: Add `services` relation to `Branch` model in `clinic.prisma`**

Open `backend/prisma/schema/clinic.prisma`. In the `Branch` model relations block (it currently has `practitioners`, `intakeForms`, etc.), add:
```prisma
  services                ServiceBranch[]
```

- [ ] **Step 3: Create the migration SQL**

Create directory: `backend/prisma/migrations/20260329120000_add_service_branches/`

Create file `backend/prisma/migrations/20260329120000_add_service_branches/migration.sql`:
```sql
-- CreateTable
CREATE TABLE "service_branches" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_branches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_branches_service_id_branch_id_key" ON "service_branches"("service_id", "branch_id");

-- CreateIndex
CREATE INDEX "service_branches_branch_id_idx" ON "service_branches"("branch_id");

-- AddForeignKey
ALTER TABLE "service_branches" ADD CONSTRAINT "service_branches_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_branches" ADD CONSTRAINT "service_branches_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Apply the migration**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run prisma:migrate
```

Expected: Migration `20260329120000_add_service_branches` applied successfully. Prisma client regenerated.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema/services.prisma backend/prisma/schema/clinic.prisma backend/prisma/migrations/20260329120000_add_service_branches/
git commit -m "feat(services): add service_branches M2M join table"
```

---

## Task 2: DTO — Branch query param + set-branches DTO

**Files:**
- Modify: `backend/src/modules/services/dto/service-list-query.dto.ts`
- Create: `backend/src/modules/services/dto/set-service-branches.dto.ts`

- [ ] **Step 1: Write failing test for branchId in query DTO**

In `backend/src/modules/services/tests/services.service.spec.ts`, add at the top of the `describe('ServicesService')` block a new describe group for branch filtering (we will extend it in Task 4):

```typescript
describe('branch filter in findAll', () => {
  it('passes branchId filter to queryServices', async () => {
    // We will test the actual filtering in Task 4.
    // This placeholder ensures the DTO field exists at compile time.
    const query: ServiceListQueryDto = { branchId: 'branch-uuid-1' };
    expect(query.branchId).toBe('branch-uuid-1');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails (compile error or field missing)**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test -- --testPathPattern="services.service.spec" --no-coverage 2>&1 | tail -20
```

Expected: Error — `Property 'branchId' does not exist on type 'ServiceListQueryDto'`.

- [ ] **Step 3: Add `branchId` to `ServiceListQueryDto`**

Open `backend/src/modules/services/dto/service-list-query.dto.ts`. Add `IsUUID` to the import list (it's already imported — just confirm). Add after `search?`:

```typescript
  @IsOptional()
  @IsUUID()
  branchId?: string;
```

Also add `ApiProperty` decorator if the file uses it (check imports — add `@ApiPropertyOptional()` above `@IsOptional()` for Swagger consistency if other fields have it).

- [ ] **Step 4: Create `set-service-branches.dto.ts`**

Create `backend/src/modules/services/dto/set-service-branches.dto.ts`:

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, ArrayMinSize } from 'class-validator';

export class SetServiceBranchesDto {
  @ApiProperty({ type: [String], description: 'Branch IDs to restrict this service to' })
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  branchIds: string[];
}
```

- [ ] **Step 5: Run test — confirm it now passes**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test -- --testPathPattern="services.service.spec" --no-coverage 2>&1 | tail -20
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/services/dto/service-list-query.dto.ts backend/src/modules/services/dto/set-service-branches.dto.ts backend/src/modules/services/tests/services.service.spec.ts
git commit -m "feat(services): add branchId query param and SetServiceBranchesDto"
```

---

## Task 3: Service — branch filtering helper + setBranches / clearBranches

**Files:**
- Modify: `backend/src/modules/services/services.service.ts`

- [ ] **Step 1: Write failing tests**

In `backend/src/modules/services/tests/services.service.spec.ts`, replace the placeholder `describe('branch filter in findAll')` block written in Task 2 with:

```typescript
describe('branch filtering', () => {
  it('findAll with branchId filters to matching services', async () => {
    mockPrismaService.service.findMany.mockResolvedValue([]);
    mockPrismaService.service.count.mockResolvedValue(0);

    await service.findAll({ branchId: 'branch-uuid-1' });

    const whereArg = mockPrismaService.service.findMany.mock.calls[0][0].where;
    expect(whereArg.OR).toEqual([
      { branches: { none: {} } },
      { branches: { some: { branchId: 'branch-uuid-1' } } },
    ]);
  });

  it('findAll without branchId has no branch filter', async () => {
    mockPrismaService.service.findMany.mockResolvedValue([]);
    mockPrismaService.service.count.mockResolvedValue(0);

    await service.findAll({});

    const whereArg = mockPrismaService.service.findMany.mock.calls[0][0].where;
    expect(whereArg.OR).toBeUndefined();
  });

  it('setBranches replaces all branch records for a service', async () => {
    mockPrismaService.service.findFirst.mockResolvedValue({ id: 'svc-uuid-1', deletedAt: null });
    mockPrismaService.$transaction.mockResolvedValue([]);

    await service.setBranches('svc-uuid-1', ['branch-uuid-1', 'branch-uuid-2']);

    expect(mockPrismaService.$transaction).toHaveBeenCalled();
  });

  it('clearBranches deletes all ServiceBranch records for a service', async () => {
    mockPrismaService.service.findFirst.mockResolvedValue({ id: 'svc-uuid-1', deletedAt: null });
    mockPrismaService.serviceBranch = { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) };

    await service.clearBranches('svc-uuid-1');

    expect(mockPrismaService.serviceBranch.deleteMany).toHaveBeenCalledWith({
      where: { serviceId: 'svc-uuid-1' },
    });
  });
});
```

Also add `serviceBranch` to the `mockPrismaService` object at the top of the file:
```typescript
  serviceBranch: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test -- --testPathPattern="services.service.spec" --no-coverage 2>&1 | tail -30
```

Expected: FAIL — `setBranches is not a function`, `clearBranches is not a function`, branch filter assertions fail.

- [ ] **Step 3: Update `ServiceListQuery` interface and `queryServices` in `services.service.ts`**

Add `branchId?: string` to the `ServiceListQuery` interface at the top of the file:
```typescript
interface ServiceListQuery {
  page?: number;
  perPage?: number;
  categoryId?: string;
  isActive?: boolean;
  includeHidden?: boolean;
  search?: string;
  branchId?: string;
}
```

In `queryServices`, add the branch filter inside the `where` object (after the `search` filter):

```typescript
    ...(query.branchId && {
      OR: [
        { branches: { none: {} } },
        { branches: { some: { branchId: query.branchId } } },
      ],
    }),
```

Also update the `isDefaultQuery` check in `findAll` — a query with `branchId` is never the default:
```typescript
    const isDefaultQuery =
      !query.categoryId &&
      !query.search &&
      !query.branchId &&
      (query.isActive === undefined || query.isActive === true) &&
      (query.page === undefined || query.page === 1) &&
      query.perPage === undefined;
```

- [ ] **Step 4: Add `setBranches` and `clearBranches` methods to `ServicesService`**

Add these two methods to `services.service.ts` after the `softDelete` method:

```typescript
  async setBranches(id: string, branchIds: string[]): Promise<void> {
    const service = await this.prisma.service.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!service) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Service not found',
        error: 'NOT_FOUND',
      });
    }

    await this.prisma.$transaction([
      this.prisma.serviceBranch.deleteMany({ where: { serviceId: id } }),
      this.prisma.serviceBranch.createMany({
        data: branchIds.map((branchId) => ({ serviceId: id, branchId })),
        skipDuplicates: true,
      }),
    ]);

    await this.invalidateServicesCache();
  }

  async clearBranches(id: string): Promise<void> {
    const service = await this.prisma.service.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!service) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Service not found',
        error: 'NOT_FOUND',
      });
    }

    await this.prisma.serviceBranch.deleteMany({ where: { serviceId: id } });
    await this.invalidateServicesCache();
  }
```

- [ ] **Step 5: Run tests — confirm they pass**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test -- --testPathPattern="services.service.spec" --no-coverage 2>&1 | tail -20
```

Expected: All branch filtering tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/services/services.service.ts backend/src/modules/services/tests/services.service.spec.ts
git commit -m "feat(services): add branch filtering and setBranches/clearBranches methods"
```

---

## Task 4: Controller — expose `PUT /:id/branches` and `DELETE /:id/branches`

**Files:**
- Modify: `backend/src/modules/services/services.controller.ts`

- [ ] **Step 1: Add the two new endpoints**

Open `backend/src/modules/services/services.controller.ts`.

Add import for the new DTO at the top:
```typescript
import { SetServiceBranchesDto } from './dto/set-service-branches.dto.js';
```

Add the two endpoints to the controller after the `getIntakeForms` endpoint (inside the SERVICES section):

```typescript
  @Put(':id/branches')
  @CheckPermissions({ module: 'services', action: 'edit' })
  async setBranches(
    @Param('id', uuidPipe) id: string,
    @Body() dto: SetServiceBranchesDto,
  ) {
    await this.servicesService.setBranches(id, dto.branchIds);
    return { updated: true };
  }

  @Delete(':id/branches')
  @CheckPermissions({ module: 'services', action: 'edit' })
  async clearBranches(@Param('id', uuidPipe) id: string) {
    await this.servicesService.clearBranches(id);
    return { cleared: true };
  }
```

- [ ] **Step 2: Run full test suite**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test --no-coverage 2>&1 | tail -20
```

Expected: All tests PASS.

- [ ] **Step 3: Typecheck**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/services/services.controller.ts
git commit -m "feat(services): expose PUT/DELETE /:id/branches endpoints"
```

---

## Task 5: Practitioners endpoint — filter by branch

**Files:**
- Modify: `backend/src/modules/services/service-practitioners.service.ts`
- Modify: `backend/src/modules/services/services.controller.ts`

- [ ] **Step 1: Add `branchId` param to `getPractitionersForService`**

Open `backend/src/modules/services/service-practitioners.service.ts`.

Update the method signature and add branch filtering:

```typescript
  async getPractitionersForService(serviceId: string, branchId?: string) {
    await this.services.ensureExists(serviceId);

    return this.prisma.practitionerService.findMany({
      where: {
        serviceId,
        ...(branchId && {
          practitioner: {
            branches: { some: { branchId } },
          },
        }),
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
  }
```

- [ ] **Step 2: Pass `branchId` from the controller**

Open `backend/src/modules/services/services.controller.ts`. Update the `getPractitioners` endpoint:

```typescript
  @Get(':id/practitioners')
  @Public()
  async getPractitioners(
    @Param('id', uuidPipe) id: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.practitionersService.getPractitionersForService(id, branchId);
  }
```

- [ ] **Step 3: Run tests + typecheck**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test --no-coverage 2>&1 | tail -10
npx tsc --noEmit 2>&1 | head -20
```

Expected: All PASS, no type errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/services/service-practitioners.service.ts backend/src/modules/services/services.controller.ts
git commit -m "feat(services): filter practitioners by branchId on GET /:id/practitioners"
```

---

## Task 6: Booking creation — validate service available at branch

**Files:**
- Modify: `backend/src/modules/bookings/booking-creation.service.ts`

- [ ] **Step 1: Locate the service validation block**

Open `backend/src/modules/bookings/booking-creation.service.ts`. The service check is on line 56–64. After the `ps.isActive` check (line 63), add the branch availability check:

```typescript
    // Validate service is available at the booking's branch
    const branchId = await this.resolveBranchContext(dto.practitionerId, dto.branchId);
    const serviceBranchCount = await this.prisma.serviceBranch.count({
      where: { serviceId: dto.serviceId },
    });
    if (serviceBranchCount > 0) {
      const allowed = await this.prisma.serviceBranch.findUnique({
        where: { serviceId_branchId: { serviceId: dto.serviceId, branchId } },
        select: { id: true },
      });
      if (!allowed) {
        throw new BadRequestException({
          statusCode: 422,
          message: 'Service is not available at the selected branch',
          error: 'SERVICE_NOT_AVAILABLE_AT_BRANCH',
        });
      }
    }
```

> Note: `resolveBranchContext` is already called again later in the method (line 66). Remove the duplicate call — replace the existing `const branchId = await this.resolveBranchContext(...)` on line 66 with just `branchId` (it's already declared above).

- [ ] **Step 2: Typecheck**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test --no-coverage 2>&1 | tail -15
```

Expected: All PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/bookings/booking-creation.service.ts
git commit -m "feat(bookings): validate service availability at branch on booking creation"
```

---

## Task 7: Dashboard — branch filter in services list + service form toggle

**Files:**
- Modify: `dashboard/hooks/use-services.ts` (or equivalent TanStack Query hook)
- Modify: `dashboard/app/(dashboard)/services/page.tsx` (services list page)
- Modify: `dashboard/components/features/services/service-form.tsx` (or equivalent)

> Before starting this task, run: `ls dashboard/hooks/` and `ls dashboard/app/(dashboard)/services/` to confirm actual file names.

- [ ] **Step 1: Locate the services hook**

```bash
ls /Users/tariq/Documents/my_programs/CareKit/dashboard/hooks/
```

Find the file that calls `GET /services` (likely `use-services.ts`). Read it.

- [ ] **Step 2: Add `branchId` param support to the hook**

In the services query hook, add `branchId?: string` to the query params type and pass it to the API call, e.g.:

```typescript
export function useServices(params?: { branchId?: string; categoryId?: string; isActive?: boolean }) {
  return useQuery({
    queryKey: ['services', params],
    queryFn: () => api.get('/services', { params }).then(r => r.data),
  });
}
```

- [ ] **Step 3: Add branch filter to FilterBar on services list page**

Read `dashboard/app/(dashboard)/services/page.tsx`. In the FilterBar, add a Branch select dropdown alongside the existing Status filter. The branch list comes from the existing `useBranches()` hook (confirm it exists: `ls dashboard/hooks/`).

The filter passes `branchId` to `useServices({ branchId })`.

- [ ] **Step 4: Add branch restriction toggle to service form**

Read the service form component. Add a section after the existing fields:

```tsx
{/* Branch Availability */}
<div className="space-y-3">
  <Label>توفر الخدمة في الفروع</Label>
  <RadioGroup value={branchMode} onValueChange={setBranchMode}>
    <div className="flex items-center gap-2">
      <RadioGroupItem value="all" id="branch-all" />
      <Label htmlFor="branch-all">متاحة في جميع الفروع</Label>
    </div>
    <div className="flex items-center gap-2">
      <RadioGroupItem value="specific" id="branch-specific" />
      <Label htmlFor="branch-specific">تحديد فروع معينة</Label>
    </div>
  </RadioGroup>
  {branchMode === 'specific' && (
    <BranchMultiSelect
      value={selectedBranchIds}
      onChange={setSelectedBranchIds}
    />
  )}
</div>
```

On form submit:
- If `branchMode === 'all'` → call `DELETE /services/:id/branches`
- If `branchMode === 'specific'` → call `PUT /services/:id/branches` with `{ branchIds: selectedBranchIds }`

On form load (edit mode), if `service.branches.length > 0` → set `branchMode = 'specific'` and `selectedBranchIds = service.branches.map(b => b.branchId)`.

The `findOne` and `findAll` responses must include branches. Update `services.service.ts` `findOne` to include `branches: { select: { branchId: true } }`.

- [ ] **Step 5: Run dashboard typecheck**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/dashboard
npm run typecheck 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add dashboard/hooks/ dashboard/app/\(dashboard\)/services/ dashboard/components/features/services/
git commit -m "feat(dashboard): add branch filter to services list and branch toggle to service form"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `ServiceBranch` M2M join table | Task 1 |
| Empty = all branches filtering rule | Task 3 |
| `GET /services?branchId=` filter | Task 3 |
| `PUT /services/:id/branches` | Task 4 |
| `DELETE /services/:id/branches` | Task 4 |
| `GET /services/:id/practitioners?branchId=` | Task 5 |
| Booking creation validates service at branch | Task 6 |
| Dashboard branch filter in list | Task 7 |
| Dashboard branch toggle in form | Task 7 |
| Online booking follows same branch scoping | ✅ handled by Task 6 (booking validates regardless of type) |

**Placeholder scan:** None found.

**Type consistency:**
- `setBranches(id, branchIds)` — consistent across service method, controller, and test.
- `clearBranches(id)` — consistent.
- `branchId` field name — consistent across DTO, service interface, Prisma query.
- `serviceBranch` Prisma client accessor — matches `@@map("service_branches")` → Prisma generates `serviceBranch`.
- `serviceId_branchId` composite unique key name — matches Prisma convention for `@@unique([serviceId, branchId])`.
