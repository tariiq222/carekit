# Services Module Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 10 confirmed bugs and quality issues in the services module found during code review.

**Architecture:** Surgical fixes only — no feature additions, no refactoring beyond what is explicitly listed. Each task targets one file or one behaviour. Tests are updated where the fix changes observable behaviour.

**Tech Stack:** NestJS 11, Prisma 7, class-validator, TypeScript strict mode, Jest

---

## File Map

| File | Action | Why |
|------|--------|-----|
| `backend/src/modules/services/services.service.ts` | Modify | deleteCategory bug + weak typing + $transaction cleanup + split |
| `backend/src/modules/services/service-categories.service.ts` | **Create** | Extract category logic from services.service.ts (350-line limit) |
| `backend/src/modules/services/service-booking-type.service.ts` | Modify | Sequential await → Promise.all |
| `backend/src/modules/services/services.controller.ts` | Modify | Remove { success, data } wrappers + remove IntakeFormsService injection |
| `backend/src/modules/services/services.module.ts` | Modify | Register ServiceCategoriesService, remove IntakeFormsModule import |
| `backend/src/modules/services/dto/set-booking-types.dto.ts` | Modify | @IsEnum literal array → BookingType enum |
| `backend/src/modules/services/dto/update-service.dto.ts` | Modify | @IsIn → @IsEnum for allowedRecurringPatterns |
| `shared/types/service.ts` | Modify | Add 12 missing fields |
| `backend/src/modules/services/tests/services.service.spec.ts` | Modify | Fix deleteCategory test expectation |

---

## Task 1: Fix `deleteCategory` — only block on active (non-deleted) services

**Files:**
- Modify: `backend/src/modules/services/services.service.ts:93-95`
- Modify: `backend/src/modules/services/tests/services.service.spec.ts:295-302`

**The bug:** Line 93 counts ALL services including soft-deleted ones (`deletedAt != null`). A category whose only services are soft-deleted cannot be deleted — FK constraint is satisfied but the guard incorrectly blocks it.

- [ ] **Step 1: Update the test to document correct behaviour**

In `tests/services.service.spec.ts`, find the `deleteCategory` describe block and add a new test after the existing "should throw ConflictException" test:

```typescript
it('should allow deleting a category whose services are all soft-deleted', async () => {
  mockPrismaService.serviceCategory.findUnique.mockResolvedValue(mockCategory);
  // All services are soft-deleted — count of ACTIVE services = 0
  mockPrismaService.service.count.mockResolvedValue(0);
  mockPrismaService.serviceCategory.delete.mockResolvedValue(mockCategory);

  const result = await service.deleteCategory(mockCategory.id);

  expect(result).toEqual({ deleted: true });
  // Verify the count query excludes soft-deleted services
  expect(mockPrismaService.service.count).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        categoryId: mockCategory.id,
        deletedAt: null,
      }),
    }),
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && npx jest tests/services.service.spec.ts --testNamePattern="should allow deleting a category whose services are all soft-deleted" --no-coverage
```

Expected: FAIL — the count query does not include `deletedAt: null`.

- [ ] **Step 3: Fix the count query in `services.service.ts`**

At line 93, replace:
```typescript
    const serviceCount = await this.prisma.service.count({
      where: { categoryId: id },
    });
```
With:
```typescript
    const serviceCount = await this.prisma.service.count({
      where: { categoryId: id, deletedAt: null },
    });
```

- [ ] **Step 4: Run all deleteCategory tests**

```bash
cd backend && npx jest tests/services.service.spec.ts --testNamePattern="deleteCategory" --no-coverage
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/modules/services/services.service.ts src/modules/services/tests/services.service.spec.ts
git commit -m "fix(services): deleteCategory now ignores soft-deleted services in FK guard"
```

---

## Task 2: Fix `BookingTypeConfigDto` — use `BookingType` enum instead of string literal array

**Files:**
- Modify: `backend/src/modules/services/dto/set-booking-types.dto.ts:1-14,44`

**The bug:** `@IsEnum(['in_person', 'online'])` uses a hardcoded array. If `BookingType` enum changes, this validator won't catch it at compile time. Also, `walk_in` is silently excluded with no documented intent.

- [ ] **Step 1: Update the import and decorator**

Open `dto/set-booking-types.dto.ts`. Replace the file content:

```typescript
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { BookingType } from '@prisma/client';

export class DurationOptionInput {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsOptional()
  @IsString()
  labelAr?: string;

  @IsInt()
  @Min(5)
  @Max(480)
  durationMinutes!: number;

  @IsInt()
  @Min(0)
  price!: number; // halalat

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class BookingTypeConfigDto {
  // walk_in is excluded: booking types on a service only cover bookable types
  @IsEnum(BookingType)
  bookingType!: BookingType;

  @IsInt()
  @Min(0)
  price!: number; // halalat

  @IsInt()
  @Min(5)
  @Max(480)
  duration!: number; // minutes

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DurationOptionInput)
  durationOptions?: DurationOptionInput[];
}

export class SetServiceBookingTypesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingTypeConfigDto)
  types!: BookingTypeConfigDto[];
}
```

- [ ] **Step 2: Fix the cast in `service-booking-type.service.ts` line 32**

The old cast `typeConfig.bookingType as BookingType` was needed because the field was typed as `string`. Now that `bookingType` is typed as `BookingType`, the cast is no longer needed but is still harmless. Leave it — removing it is optional cleanup.

- [ ] **Step 3: Run typecheck**

```bash
cd backend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd backend && git add src/modules/services/dto/set-booking-types.dto.ts
git commit -m "fix(services): use BookingType enum in BookingTypeConfigDto instead of string literal array"
```

---

## Task 3: Fix `allowedRecurringPatterns` — use `@IsEnum` consistently in `UpdateServiceDto`

**Files:**
- Modify: `backend/src/modules/services/dto/update-service.dto.ts:1,96`

**The bug:** `CreateServiceDto` uses `@IsEnum(RecurringPattern, { each: true })` but `UpdateServiceDto` uses `@IsIn(Object.values(RecurringPattern), { each: true })`. These produce different error messages and `@IsIn` does not benefit from Prisma enum tracking.

- [ ] **Step 1: Replace `@IsIn` with `@IsEnum` and remove `IsIn` import**

In `dto/update-service.dto.ts`, line 1 — replace the imports:

```typescript
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
```

(Remove `IsIn`, add `IsEnum` — note: check if `IsEnum` is already present; if not add it.)

Then at lines 95-97, replace:
```typescript
  @IsIn(Object.values(RecurringPattern), { each: true })
  allowedRecurringPatterns?: RecurringPattern[];
```
With:
```typescript
  @IsEnum(RecurringPattern, { each: true })
  allowedRecurringPatterns?: RecurringPattern[];
```

- [ ] **Step 2: Run typecheck**

```bash
cd backend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd backend && git add src/modules/services/dto/update-service.dto.ts
git commit -m "fix(services): unify allowedRecurringPatterns validation to @IsEnum in UpdateServiceDto"
```

---

## Task 4: Fix `queryServices` weak typing — use `Prisma.ServiceWhereInput`

**Files:**
- Modify: `backend/src/modules/services/services.service.ts:305,341`

**The bug:** `where: Record<string, unknown>` loses Prisma's type inference. `buildFindAllResult`'s `rawItems: Array<Record<string, unknown>>` loses item shape entirely.

- [ ] **Step 1: Add Prisma import and fix `queryServices`**

At the top of `services.service.ts`, the existing import is:
```typescript
import { RecurringPattern } from '@prisma/client';
```
Replace with:
```typescript
import { Prisma, RecurringPattern } from '@prisma/client';
```

Then in `queryServices` (around line 305), replace:
```typescript
    const where: Record<string, unknown> = {
      deletedAt: null,
      isActive: query.isActive ?? true,
    };
```
With:
```typescript
    const where: Prisma.ServiceWhereInput = {
      deletedAt: null,
      isActive: query.isActive ?? true,
    };
```

- [ ] **Step 2: Fix `buildFindAllResult` parameter type**

Find `buildFindAllResult` (around line 340). The `rawItems` parameter and the `findMany` return type need to align. Replace the method signature:

```typescript
  private buildFindAllResult(
    rawItems: Array<Record<string, unknown>>,
    total: number,
    page: number,
    perPage: number,
  ) {
```
With:
```typescript
  private buildFindAllResult(
    rawItems: Awaited<ReturnType<typeof this.prisma.service.findMany>>,
    total: number,
    page: number,
    perPage: number,
  ) {
```

- [ ] **Step 3: Run typecheck**

```bash
cd backend && npx tsc --noEmit
```

Expected: No errors. If Prisma complains about `where` property assignments (e.g. `where.OR = [...]`), the fix is to use object spread instead of mutation:

```typescript
    const where: Prisma.ServiceWhereInput = {
      deletedAt: null,
      isActive: query.isActive ?? true,
      ...(!query.includeHidden && { isHidden: false }),
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.search && {
        OR: [
          { nameEn: { contains: query.search, mode: 'insensitive' } },
          { nameAr: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };
```

If you use the spread approach, remove the four `if` blocks that mutate `where` below it, and also remove the `skip`/`take` call from `parsePaginationParams` (it's still called above) — the destructuring at line 303 is unchanged.

- [ ] **Step 4: Run unit tests**

```bash
cd backend && npx jest tests/services.service.spec.ts --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/modules/services/services.service.ts
git commit -m "refactor(services): replace Record<string,unknown> with Prisma typed where clause"
```

---

## Task 5: Fix sequential `await` in `setBookingTypes` loop

**Files:**
- Modify: `backend/src/modules/services/service-booking-type.service.ts:28-53`

**The bug:** `for (const typeConfig of dto.types) { await tx.serviceBookingType.create(...) }` runs creates one-by-one. `Promise.all` parallelises them inside the transaction.

- [ ] **Step 1: Replace the loop with `Promise.all`**

In `service-booking-type.service.ts`, replace lines 28-53:

```typescript
      // Create new booking types with their duration options
      for (const typeConfig of dto.types) {
        await tx.serviceBookingType.create({
          data: {
            serviceId,
            bookingType: typeConfig.bookingType as BookingType,
            price: typeConfig.price,
            duration: typeConfig.duration,
            isActive: typeConfig.isActive ?? true,
            durationOptions: typeConfig.durationOptions?.length
              ? {
                  createMany: {
                    data: typeConfig.durationOptions.map((o, i) => ({
                      serviceId,
                      label: o.label,
                      labelAr: o.labelAr,
                      durationMinutes: o.durationMinutes,
                      price: o.price,
                      isDefault: o.isDefault ?? false,
                      sortOrder: o.sortOrder ?? i,
                    })),
                  },
                }
              : undefined,
          },
        });
      }
```

With:

```typescript
      // Create new booking types with their duration options (parallel within transaction)
      await Promise.all(
        dto.types.map((typeConfig) =>
          tx.serviceBookingType.create({
            data: {
              serviceId,
              bookingType: typeConfig.bookingType as BookingType,
              price: typeConfig.price,
              duration: typeConfig.duration,
              isActive: typeConfig.isActive ?? true,
              durationOptions: typeConfig.durationOptions?.length
                ? {
                    createMany: {
                      data: typeConfig.durationOptions.map((o, i) => ({
                        serviceId,
                        label: o.label,
                        labelAr: o.labelAr,
                        durationMinutes: o.durationMinutes,
                        price: o.price,
                        isDefault: o.isDefault ?? false,
                        sortOrder: o.sortOrder ?? i,
                      })),
                    },
                  }
                : undefined,
            },
          }),
        ),
      );
```

- [ ] **Step 2: Run typecheck**

```bash
cd backend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd backend && git add src/modules/services/service-booking-type.service.ts
git commit -m "perf(services): parallelise booking type creates inside transaction with Promise.all"
```

---

## Task 6: Remove unnecessary `$transaction` array wrapper in `create()`

**Files:**
- Modify: `backend/src/modules/services/services.service.ts:152-164`

**The bug:** `$transaction([single_operation])` wraps one operation in an array-form transaction unnecessarily. A plain `prisma.service.create(...)` is atomic on its own.

- [ ] **Step 1: Simplify the create with employeeIds path**

In `services.service.ts`, find lines 152-164:

```typescript
    if (dto.employeeIds && dto.employeeIds.length > 0) {
      const [created] = await this.prisma.$transaction([
        this.prisma.service.create({
          data: {
            ...serviceData,
            employeeServices: {
              create: dto.employeeIds.map((employeeId) => ({ employeeId })),
            },
          },
          include: { category: true },
        }),
      ]);
      service = created;
    } else {
      service = await this.prisma.service.create({
        data: serviceData,
        include: { category: true },
      });
    }
```

Replace with:

```typescript
    service = await this.prisma.service.create({
      data: {
        ...serviceData,
        ...(dto.employeeIds?.length && {
          employeeServices: {
            create: dto.employeeIds.map((employeeId) => ({ employeeId })),
          },
        }),
      },
      include: { category: true },
    });
```

Also remove the `let service` declaration on the line above (around line 150):
```typescript
    let service: Awaited<ReturnType<typeof this.prisma.service.create>>;
```
Since `service` is now a direct `const`:
```typescript
    const service = await this.prisma.service.create({
```

- [ ] **Step 2: Run typecheck and tests**

```bash
cd backend && npx tsc --noEmit && npx jest tests/services.service.spec.ts --no-coverage
```

Expected: No errors, all tests PASS.

- [ ] **Step 3: Commit**

```bash
cd backend && git add src/modules/services/services.service.ts
git commit -m "refactor(services): remove unnecessary \$transaction array wrapper in service create"
```

---

## Task 7: Fix controller — remove `{ success: true, data }` wrappers

**Files:**
- Modify: `backend/src/modules/services/services.controller.ts:115-118,146-148,156-159,165-168`

**The bug:** Three endpoints return `{ success: true, data }` while all others return the raw result. This inconsistency forces the dashboard to handle two response shapes.

The affected endpoints:
- `getIntakeForms` (line 115): wraps with `{ success: true, data }`
- `getEmployees` (line 143): wraps with `{ success: true, data }`
- `getBookingTypes` (line 154): wraps with `{ success: true, data }`
- `setBookingTypes` (line 162): wraps with `{ success: true, data }`

- [ ] **Step 1: Remove wrappers from all four endpoints**

Replace `getIntakeForms`:
```typescript
  @Get(':id/intake-forms/all')
  @Public()
  async getIntakeForms(@Param('id', uuidPipe) id: string) {
    return this.intakeFormsService.listForms({ serviceId: id });
  }
```

Replace `getEmployees`:
```typescript
  @Get(':id/employees')
  @Public()
  async getEmployees(@Param('id', uuidPipe) id: string) {
    return this.employeesService.getEmployeesForService(id);
  }
```

Replace `getBookingTypes`:
```typescript
  @Get(':id/booking-types')
  @Public()
  async getBookingTypes(@Param('id', uuidPipe) id: string) {
    return this.bookingTypeService.getByService(id);
  }
```

Replace `setBookingTypes`:
```typescript
  @Put(':id/booking-types')
  @CheckPermissions({ module: 'services', action: 'edit' })
  async setBookingTypes(
    @Param('id', uuidPipe) id: string,
    @Body() dto: SetServiceBookingTypesDto,
  ) {
    return this.bookingTypeService.setBookingTypes(id, dto);
  }
```

- [ ] **Step 2: Run typecheck**

```bash
cd backend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Check if dashboard uses `data` field from these endpoints**

```bash
grep -r "\.data" /Users/tariq/Documents/my_programs/Deqah/dashboard/lib/api/services.ts
grep -r "\.data" /Users/tariq/Documents/my_programs/Deqah/dashboard/hooks/use-services.ts
```

If any call does `response.data` for employees, booking-types, or intake-forms endpoints, update those calls to use the response directly. The API functions in `dashboard/lib/api/services.ts` use axios which already returns `response.data` from the HTTP layer — so the question is whether the functions do an additional `.data` unwrap. If found, remove the extra `.data`.

- [ ] **Step 4: Commit**

```bash
cd backend && git add src/modules/services/services.controller.ts
git commit -m "fix(services): remove inconsistent {success,data} wrappers from controller endpoints"
```

---

## Task 8: Fix controller — move `IntakeFormsService` out of controller

**Files:**
- Modify: `backend/src/modules/services/services.controller.ts`
- Modify: `backend/src/modules/services/services.service.ts`
- Modify: `backend/src/modules/services/services.module.ts`

**The bug:** The controller directly injects and calls `IntakeFormsService`. The controller should only call `ServicesService`. Business delegation belongs in the service layer.

- [ ] **Step 1: Add `getIntakeForms` method to `ServicesService`**

At the top of `services.service.ts`, add to imports:
```typescript
import { IntakeFormsService } from '../intake-forms/intake-forms.service.js';
```

Add to the constructor:
```typescript
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly intakeForms: IntakeFormsService,
  ) {}
```

Add a new public method at the end of the SERVICES section (before the PRIVATE HELPERS section):
```typescript
  async getIntakeForms(serviceId: string) {
    return this.intakeForms.listForms({ serviceId });
  }
```

- [ ] **Step 2: Update the controller**

In `services.controller.ts`:

1. Remove `IntakeFormsService` from the import line:
```typescript
import { IntakeFormsService } from '../intake-forms/intake-forms.service.js';
```
Delete this line entirely.

2. Remove from constructor:
```typescript
    private readonly intakeFormsService: IntakeFormsService,
```
Delete this line.

3. Update `getIntakeForms` to call via `servicesService`:
```typescript
  @Get(':id/intake-forms/all')
  @Public()
  async getIntakeForms(@Param('id', uuidPipe) id: string) {
    return this.servicesService.getIntakeForms(id);
  }
```

- [ ] **Step 3: Update the module**

`services.module.ts` currently imports `IntakeFormsModule` so the controller can use `IntakeFormsService`. Now `ServicesService` uses it instead — the module import stays the same (NestJS resolves providers from imports regardless of which class in the module uses them). No change needed to `services.module.ts`.

- [ ] **Step 4: Run typecheck and tests**

```bash
cd backend && npx tsc --noEmit && npx jest tests/services.service.spec.ts --no-coverage
```

Expected: No errors. Note: unit tests mock `PrismaService` but not `IntakeFormsService`. The constructor now has 3 params. Add `IntakeFormsService` mock to the test module in `services.service.spec.ts`:

In the `beforeEach` block, update the `TestingModule`:
```typescript
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
        { provide: IntakeFormsService, useValue: { listForms: jest.fn() } },
      ],
    }).compile();
```

Also add to imports at the top of the test file:
```typescript
import { CacheService } from '../../../common/services/cache.service.js';
import { IntakeFormsService } from '../../intake-forms/intake-forms.service.js';
```

- [ ] **Step 5: Run tests again**

```bash
cd backend && npx jest tests/services.service.spec.ts --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
cd backend && git add src/modules/services/services.service.ts src/modules/services/services.controller.ts src/modules/services/tests/services.service.spec.ts
git commit -m "refactor(services): move IntakeFormsService delegation from controller to ServicesService"
```

---

## Task 9: Split `services.service.ts` — extract categories to `service-categories.service.ts`

**Files:**
- **Create**: `backend/src/modules/services/service-categories.service.ts`
- Modify: `backend/src/modules/services/services.service.ts`
- Modify: `backend/src/modules/services/services.controller.ts`
- Modify: `backend/src/modules/services/services.module.ts`

**Why:** `services.service.ts` is at 356 lines (limit: 350). Category logic is an independent domain. Splitting also removes the need for `ServicesService` to call `invalidateServicesCache` after category mutations — the new service handles it.

- [ ] **Step 1: Create `service-categories.service.ts`**

Create `backend/src/modules/services/service-categories.service.ts`:

```typescript
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CacheService } from '../../common/services/cache.service.js';
import { CACHE_TTL, CACHE_KEYS } from '../../config/constants.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Injectable()
export class ServiceCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async create(dto: CreateCategoryDto) {
    const category = await this.prisma.serviceCategory.create({
      data: {
        nameEn: dto.nameEn,
        nameAr: dto.nameAr,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    await this.invalidateCache();
    return category;
  }

  async findAll() {
    const cached = await this.cache.get<
      Awaited<ReturnType<typeof this.prisma.serviceCategory.findMany>>
    >(CACHE_KEYS.CATEGORIES_ACTIVE);
    if (cached) return cached;

    const categories = await this.prisma.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    await this.cache.set(
      CACHE_KEYS.CATEGORIES_ACTIVE,
      categories,
      CACHE_TTL.CATEGORIES_LIST,
    );

    return categories;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Category not found',
        error: 'NOT_FOUND',
      });
    }

    const updated = await this.prisma.serviceCategory.update({
      where: { id },
      data: {
        nameEn: dto.nameEn,
        nameAr: dto.nameAr,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });
    await this.invalidateCache();
    return updated;
  }

  async delete(id: string) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Category not found',
        error: 'NOT_FOUND',
      });
    }

    // Only block on active (non-soft-deleted) services
    const serviceCount = await this.prisma.service.count({
      where: { categoryId: id, deletedAt: null },
    });
    if (serviceCount > 0) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Cannot delete category with assigned services',
        error: 'CONFLICT',
      });
    }

    await this.prisma.serviceCategory.delete({ where: { id } });
    await this.invalidateCache();
    return { deleted: true };
  }

  private async invalidateCache(): Promise<void> {
    await Promise.all([
      this.cache.del(CACHE_KEYS.CATEGORIES_ACTIVE),
      this.cache.del(CACHE_KEYS.SERVICES_ACTIVE),
    ]);
  }
}
```

- [ ] **Step 2: Add cache keys and TTL constants**

Open `backend/src/config/constants.ts`. Find `CACHE_KEYS` and `CACHE_TTL`. Add:

```typescript
// In CACHE_KEYS:
CATEGORIES_ACTIVE: 'cache:categories:active',

// In CACHE_TTL:
CATEGORIES_LIST: 900, // 15 minutes
```

Run typecheck to confirm the file accepts these additions:
```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 3: Remove category methods from `services.service.ts`**

Delete the entire `SERVICE CATEGORIES` section (lines 31-107): `createCategory`, `findAllCategories`, `updateCategory`, `deleteCategory`, and their section comment block.

Also remove the category DTO imports that are no longer needed:
```typescript
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
```

- [ ] **Step 4: Update the controller to inject `ServiceCategoriesService`**

In `services.controller.ts`:

Add import:
```typescript
import { ServiceCategoriesService } from './service-categories.service.js';
```

Add to constructor:
```typescript
    private readonly categoriesService: ServiceCategoriesService,
```

Update the four category endpoints:
```typescript
  @Get('categories')
  @Public()
  async findAllCategories() {
    return this.categoriesService.findAll();
  }

  @Post('categories')
  @CheckPermissions({ module: 'services', action: 'create' })
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Patch('categories/:id')
  @CheckPermissions({ module: 'services', action: 'edit' })
  async updateCategory(
    @Param('id', uuidPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, dto);
  }

  @Delete('categories/:id')
  @CheckPermissions({ module: 'services', action: 'delete' })
  async deleteCategory(@Param('id', uuidPipe) id: string) {
    return this.categoriesService.delete(id);
  }
```

- [ ] **Step 5: Update `services.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ServicesController } from './services.controller.js';
import { ServicesService } from './services.service.js';
import { ServiceCategoriesService } from './service-categories.service.js';
import { DurationOptionsService } from './duration-options.service.js';
import { ServiceBookingTypeService } from './service-booking-type.service.js';
import { ServiceEmployeesService } from './service-employees.service.js';
import { IntakeFormsModule } from '../intake-forms/intake-forms.module.js';

@Module({
  imports: [IntakeFormsModule],
  controllers: [ServicesController],
  providers: [
    ServicesService,
    ServiceCategoriesService,
    DurationOptionsService,
    ServiceBookingTypeService,
    ServiceEmployeesService,
  ],
  exports: [
    ServicesService,
    ServiceCategoriesService,
    DurationOptionsService,
    ServiceBookingTypeService,
    ServiceEmployeesService,
  ],
})
export class ServicesModule {}
```

- [ ] **Step 6: Run typecheck and tests**

```bash
cd backend && npx tsc --noEmit && npx jest tests/services.service.spec.ts --no-coverage
```

Expected: No errors, all tests PASS.

Also check `services.service.ts` line count is under 350:
```bash
wc -l backend/src/modules/services/services.service.ts
```

Expected: Under 300 lines.

- [ ] **Step 7: Commit**

```bash
cd backend && git add \
  src/modules/services/service-categories.service.ts \
  src/modules/services/services.service.ts \
  src/modules/services/services.controller.ts \
  src/modules/services/services.module.ts \
  src/config/constants.ts
git commit -m "refactor(services): extract ServiceCategoriesService with categories cache"
```

---

## Task 10: Sync `shared/types/service.ts` with Prisma schema

**Files:**
- Modify: `shared/types/service.ts`

**The bug:** 12 fields present in the Prisma schema are missing from the shared type. Dashboard and mobile consumers get no TypeScript errors when they omit these fields.

- [ ] **Step 1: Replace `shared/types/service.ts`**

```typescript
export interface ServiceCategory {
  id: string;
  nameAr: string;
  nameEn: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Service {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  categoryId: string;
  price: number; // halalat (100 = 1 SAR)
  duration: number; // minutes
  isActive: boolean;
  isHidden: boolean;
  hidePriceOnBooking: boolean;
  hideDurationOnBooking: boolean;
  calendarColor: string | null;
  bufferMinutes: number;
  depositEnabled: boolean;
  depositPercent: number | null;
  allowRecurring: boolean;
  allowedRecurringPatterns: string[];
  maxRecurrences: number | null;
  maxParticipants: number;
  minLeadMinutes: number | null;
  maxAdvanceDays: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceWithCategory extends Service {
  category: ServiceCategory;
}

export interface ServiceDurationOption {
  id: string;
  serviceId: string;
  label: string;
  labelAr: string | null;
  durationMinutes: number;
  price: number; // halalat
  isDefault: boolean;
  sortOrder: number;
}

export interface ServiceBookingType {
  id: string;
  serviceId: string;
  bookingType: 'in_person' | 'online' | 'walk_in';
  price: number; // halalat
  duration: number; // minutes
  isActive: boolean;
  durationOptions: ServiceDurationOption[];
}
```

- [ ] **Step 2: Run typecheck from the root to catch any dashboard/mobile breakage**

```bash
cd /Users/tariq/Documents/my_programs/Deqah/dashboard && npx tsc --noEmit
```

Fix any type errors that surface (they indicate the dashboard was silently using incomplete types).

- [ ] **Step 3: Commit**

```bash
cd /Users/tariq/Documents/my_programs/Deqah && git add shared/types/service.ts
git commit -m "fix(shared): sync Service type with Prisma schema — add 12 missing fields"
```

---

## Task 11: Final verification

- [ ] **Step 1: Run full backend tests**

```bash
cd backend && npm run test
```

Expected: All suites PASS, no regressions.

- [ ] **Step 2: Run typecheck across the monorepo**

```bash
cd /Users/tariq/Documents/my_programs/Deqah/backend && npx tsc --noEmit
cd /Users/tariq/Documents/my_programs/Deqah/dashboard && npx tsc --noEmit
```

Expected: Zero errors in both.

- [ ] **Step 3: Verify line counts**

```bash
wc -l \
  backend/src/modules/services/services.service.ts \
  backend/src/modules/services/service-categories.service.ts \
  backend/src/modules/services/service-booking-type.service.ts \
  backend/src/modules/services/services.controller.ts
```

Expected: Every file under 350 lines.

---

## Summary of Changes

| Task | Files Changed | Risk |
|------|--------------|------|
| 1 — deleteCategory bug | services.service.ts, spec | Low |
| 2 — BookingType enum | set-booking-types.dto.ts | Low |
| 3 — @IsEnum consistency | update-service.dto.ts | Low |
| 4 — Prisma where typing | services.service.ts | Low |
| 5 — Promise.all booking types | service-booking-type.service.ts | Low |
| 6 — Remove $transaction wrapper | services.service.ts | Low |
| 7 — Remove wrapper inconsistency | services.controller.ts | Medium* |
| 8 — IntakeForms delegation | services.service.ts, controller, spec | Medium |
| 9 — Split categories service | 5 files + new file | Medium |
| 10 — Sync shared types | shared/types/service.ts | Medium* |
| 11 — Final verification | — | — |

\* Task 7 and 10 can affect the dashboard. Dashboard API layer must be verified after these tasks.
