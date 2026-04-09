# Departments Feature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Department` model as an optional organizational layer above `ServiceCategory`, controlled by a feature flag.

**Architecture:** New Prisma model `Department` with a nullable `departmentId` on `ServiceCategory`. New NestJS module `departments/` behind a reusable `FeatureFlagGuard`. Dashboard list page following the Branches pattern. Feature flag `departments` in FeatureFlag table (default: disabled).

**Tech Stack:** NestJS 11, Prisma 7 (PostgreSQL), Next.js 15, TanStack Query v5, shadcn/ui, Tailwind 4, Zod, React Hook Form, HugeIcons.

**Spec:** `docs/superpowers/specs/2026-04-09-departments-design.md`

---

## File Map

### Backend — New Files

| File | Responsibility |
|------|----------------|
| `backend/src/common/decorators/require-feature.decorator.ts` | `@RequireFeature(key)` metadata decorator |
| `backend/src/common/guards/feature-flag.guard.ts` | Guard that checks FeatureFlag + License |
| `backend/src/modules/departments/departments.module.ts` | NestJS module registration |
| `backend/src/modules/departments/departments.controller.ts` | HTTP endpoints (6 routes) |
| `backend/src/modules/departments/departments.service.ts` | CRUD + cache + reorder logic |
| `backend/src/modules/departments/dto/create-department.dto.ts` | Input validation for create |
| `backend/src/modules/departments/dto/update-department.dto.ts` | Input validation for update |
| `backend/src/modules/departments/dto/reorder-departments.dto.ts` | Input validation for reorder |
| `backend/src/modules/departments/dto/department-list-query.dto.ts` | Query params validation |

### Backend — Modified Files

| File | Change |
|------|--------|
| `backend/prisma/schema/services.prisma` | Add `Department` model + `departmentId` on `ServiceCategory` |
| `backend/prisma/schema/license.prisma` | Add `hasDepartments` field |
| `backend/prisma/seed.data.ts` | Add `departments` to MODULES, FEATURE_FLAGS, ROLES, LICENSE_DEFAULTS |
| `backend/src/modules/license/license.service.ts` | Add `departments` to `FLAG_TO_LICENSE` |
| `backend/src/config/constants/cache.ts` | Add `DEPARTMENTS_ACTIVE` key + TTL |
| `backend/src/app.module.ts` | Import `DepartmentsModule` |
| `backend/src/modules/services/dto/create-category.dto.ts` | Add optional `departmentId` |
| `backend/src/modules/services/dto/update-category.dto.ts` | Add optional `departmentId` |
| `backend/src/modules/services/service-categories.service.ts` | Pass `departmentId` in create/update |

### Dashboard — New Files

| File | Responsibility |
|------|----------------|
| `dashboard/app/(dashboard)/departments/page.tsx` | Route entry point |
| `dashboard/components/features/departments/department-list-page.tsx` | List page with stats, filters, table |
| `dashboard/components/features/departments/department-columns.tsx` | TanStack Table column definitions |
| `dashboard/components/features/departments/create-department-dialog.tsx` | Sheet for creating department |
| `dashboard/components/features/departments/edit-department-dialog.tsx` | Sheet for editing department |
| `dashboard/components/features/departments/delete-department-dialog.tsx` | AlertDialog for delete confirmation |
| `dashboard/hooks/use-departments.ts` | TanStack Query hooks + filter state |
| `dashboard/lib/api/departments.ts` | API client functions |
| `dashboard/lib/types/department.ts` | TypeScript interfaces |
| `dashboard/lib/schemas/department.schema.ts` | Zod validation schema |

### Dashboard — Modified Files

| File | Change |
|------|--------|
| `dashboard/lib/query-keys.ts` | Add `departments` key group |
| `dashboard/components/sidebar-config.ts` | Add departments nav item |
| `dashboard/hooks/use-sidebar-nav.ts` | Add feature flag mapping |
| `dashboard/lib/translations/en.ops.ts` | Add department translation keys |
| `dashboard/lib/translations/ar.ops.ts` | Add department translation keys |

---

## Task 1: Schema Migration

**Files:**
- Modify: `backend/prisma/schema/services.prisma`
- Modify: `backend/prisma/schema/license.prisma`

- [ ] **Step 1: Add Department model to services.prisma**

Add before the `ServiceCategory` model in `backend/prisma/schema/services.prisma`:

```prisma
model Department {
  id             String    @id @default(uuid())
  nameAr         String    @map("name_ar")
  nameEn         String    @map("name_en")
  descriptionAr  String?   @map("description_ar")
  descriptionEn  String?   @map("description_en")
  icon           String?
  sortOrder      Int       @default(0) @map("sort_order")
  isActive       Boolean   @default(true) @map("is_active")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")
  deletedAt      DateTime? @map("deleted_at")

  categories ServiceCategory[]

  @@index([isActive, sortOrder])
  @@map("departments")
}
```

- [ ] **Step 2: Add departmentId to ServiceCategory**

Add these three lines to the `ServiceCategory` model in `backend/prisma/schema/services.prisma`, after the `updatedAt` field:

```prisma
  departmentId String?     @map("department_id")
  department   Department? @relation(fields: [departmentId], references: [id], onDelete: SetNull)
```

And add this index inside the model (before `@@map`):

```prisma
  @@index([departmentId])
```

- [ ] **Step 3: Add hasDepartments to LicenseConfig**

Add to `backend/prisma/schema/license.prisma`, after the `hasZatca` line:

```prisma
  hasDepartments Boolean  @default(true) @map("has_departments")
```

- [ ] **Step 4: Run the migration**

```bash
cd backend && npx prisma migrate dev --name add-departments
```

Expected: Migration created successfully. Prisma client regenerated.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema/services.prisma backend/prisma/schema/license.prisma backend/prisma/migrations/
git commit -m "feat: add Department model and departmentId on ServiceCategory"
```

---

## Task 2: Seed Data & License Mapping

**Files:**
- Modify: `backend/prisma/seed.data.ts`
- Modify: `backend/src/modules/license/license.service.ts`
- Modify: `backend/src/config/constants/cache.ts`

- [ ] **Step 1: Add departments to MODULES array**

In `backend/prisma/seed.data.ts`, add `'departments'` to the `MODULES` array (after `'activity-log'`):

```typescript
export const MODULES = [
  'users',
  'roles',
  'practitioners',
  'bookings',
  'services',
  'payments',
  'invoices',
  'reports',
  'notifications',
  'chatbot',
  'whitelabel',
  'patients',
  'ratings',
  'coupons',
  'branches',
  'intake_forms',
  'gift-cards',
  'activity-log',
  'departments',
  'license',
  'clinic-settings',
  'clinic-integrations',
  'feature-flags',
] as const;
```

- [ ] **Step 2: Add departments feature flag**

In `backend/prisma/seed.data.ts`, add to the `FEATURE_FLAGS` array (after the `zatca` entry):

```typescript
  // Organizational
  { key: 'departments', nameEn: 'Departments', nameAr: 'الأقسام', descriptionEn: 'Enable department-based organization for services', descriptionAr: 'تفعيل تنظيم الخدمات حسب الأقسام', enabled: false },
```

- [ ] **Step 3: Add departments permissions to roles**

In `backend/prisma/seed.data.ts`, add `departments` to the role permissions:

For `Receptionist` (add after `services` line):
```typescript
      departments: ['view'],
```

For `Accountant` (add after `notifications` line):
```typescript
      departments: ['view'],
```

For `Practitioner` (add after `practitioners` line):
```typescript
      departments: ['view'],
```

For `Patient` (add after `services` line):
```typescript
      departments: ['view'],
```

Note: `super_admin` and `admin` already get all MODULES permissions via `Object.fromEntries(MODULES.map(...))`.

- [ ] **Step 4: Add hasDepartments to LICENSE_DEFAULTS**

In `backend/prisma/seed.data.ts`, add to `LICENSE_DEFAULTS` (after `hasZatca`):

```typescript
  hasDepartments: true,
```

- [ ] **Step 5: Add departments to FLAG_TO_LICENSE**

In `backend/src/modules/license/license.service.ts`, add to the `FLAG_TO_LICENSE` map (after the `zatca` entry):

```typescript
  departments: 'hasDepartments',
```

- [ ] **Step 6: Add cache constants**

In `backend/src/config/constants/cache.ts`, add to `CACHE_TTL`:

```typescript
  /** Departments list — 15 minutes */
  DEPARTMENTS_LIST: 900,
```

Add to `CACHE_KEYS`:

```typescript
  DEPARTMENTS_ACTIVE: 'cache:departments:active',
```

- [ ] **Step 7: Run seed to verify**

```bash
cd backend && npx prisma db seed
```

Expected: Seed completes without errors. New `departments` permission and feature flag created.

- [ ] **Step 8: Commit**

```bash
git add backend/prisma/seed.data.ts backend/src/modules/license/license.service.ts backend/src/config/constants/cache.ts
git commit -m "feat: add departments to seed data, license mapping, and cache constants"
```

---

## Task 3: FeatureFlag Guard & Decorator (Reusable)

**Files:**
- Create: `backend/src/common/decorators/require-feature.decorator.ts`
- Create: `backend/src/common/guards/feature-flag.guard.ts`

- [ ] **Step 1: Create the @RequireFeature decorator**

Create `backend/src/common/decorators/require-feature.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common';

export const REQUIRE_FEATURE_KEY = 'require_feature';
export const RequireFeature = (featureKey: string) =>
  SetMetadata(REQUIRE_FEATURE_KEY, featureKey);
```

- [ ] **Step 2: Create the FeatureFlagGuard**

Create `backend/src/common/guards/feature-flag.guard.ts`:

```typescript
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagsService } from '../../modules/feature-flags/feature-flags.service.js';
import { REQUIRE_FEATURE_KEY } from '../decorators/require-feature.decorator.js';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureKey = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRE_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!featureKey) return true;

    const enabled = await this.featureFlagsService.isEnabled(featureKey);
    if (!enabled) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'This feature is not available',
        error: 'FEATURE_NOT_ENABLED',
      });
    }

    return true;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/common/decorators/require-feature.decorator.ts backend/src/common/guards/feature-flag.guard.ts
git commit -m "feat: add reusable FeatureFlagGuard and @RequireFeature decorator"
```

---

## Task 4: Departments Backend Module

**Files:**
- Create: `backend/src/modules/departments/dto/create-department.dto.ts`
- Create: `backend/src/modules/departments/dto/update-department.dto.ts`
- Create: `backend/src/modules/departments/dto/reorder-departments.dto.ts`
- Create: `backend/src/modules/departments/dto/department-list-query.dto.ts`
- Create: `backend/src/modules/departments/departments.service.ts`
- Create: `backend/src/modules/departments/departments.controller.ts`
- Create: `backend/src/modules/departments/departments.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Create DTOs**

Create `backend/src/modules/departments/dto/create-department.dto.ts`:

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateDepartmentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  nameAr!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  nameEn!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descriptionAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descriptionEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

Create `backend/src/modules/departments/dto/update-department.dto.ts`:

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateDepartmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  nameAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  nameEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descriptionAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descriptionEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

Create `backend/src/modules/departments/dto/reorder-departments.dto.ts`:

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

class ReorderItem {
  @ApiProperty()
  @IsUUID()
  id!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class ReorderDepartmentsDto {
  @ApiProperty({ type: [ReorderItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItem)
  items!: ReorderItem[];
}
```

Create `backend/src/modules/departments/dto/department-list-query.dto.ts`:

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class DepartmentListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  isActive?: boolean;
}
```

- [ ] **Step 2: Create DepartmentsService**

Create `backend/src/modules/departments/departments.service.ts`:

```typescript
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CacheService } from '../../common/services/cache.service.js';
import { CACHE_TTL, CACHE_KEYS } from '../../config/constants.js';
import { CreateDepartmentDto } from './dto/create-department.dto.js';
import { UpdateDepartmentDto } from './dto/update-department.dto.js';
import { ReorderDepartmentsDto } from './dto/reorder-departments.dto.js';
import { DepartmentListQueryDto } from './dto/department-list-query.dto.js';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async findAll(query: DepartmentListQueryDto) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = { deletedAt: null };
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.OR = [
        { nameAr: { contains: query.search, mode: 'insensitive' } },
        { nameEn: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.department.findMany({
        where,
        include: {
          _count: { select: { categories: { where: { isActive: true } } } },
        },
        orderBy: { sortOrder: 'asc' },
        skip,
        take: perPage,
      }),
      this.prisma.department.count({ where }),
    ]);

    const totalPages = Math.ceil(total / perPage);

    return {
      items,
      meta: {
        total,
        page,
        perPage,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: string) {
    const department = await this.prisma.department.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: { select: { categories: { where: { isActive: true } } } },
      },
    });

    if (!department) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Department not found',
        error: 'NOT_FOUND',
      });
    }

    return department;
  }

  async create(dto: CreateDepartmentDto) {
    const department = await this.prisma.department.create({
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        descriptionAr: dto.descriptionAr,
        descriptionEn: dto.descriptionEn,
        icon: dto.icon,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    await this.invalidateCache();
    return department;
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    await this.findOne(id);

    const updated = await this.prisma.department.update({
      where: { id },
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        descriptionAr: dto.descriptionAr,
        descriptionEn: dto.descriptionEn,
        icon: dto.icon,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });

    await this.invalidateCache();
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.department.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.invalidateCache();
    return { deleted: true };
  }

  async reorder(dto: ReorderDepartmentsDto) {
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.department.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );

    await this.invalidateCache();
    return { reordered: true };
  }

  private async invalidateCache(): Promise<void> {
    await this.cache.del(CACHE_KEYS.DEPARTMENTS_ACTIVE);
  }
}
```

- [ ] **Step 3: Create DepartmentsController**

Create `backend/src/modules/departments/departments.controller.ts`:

Note: The `reorder` route MUST be declared BEFORE `:id` routes to avoid NestJS treating "reorder" as an ID parameter.

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { FeatureFlagGuard } from '../../common/guards/feature-flag.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { RequireFeature } from '../../common/decorators/require-feature.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { DepartmentsService } from './departments.service.js';
import { CreateDepartmentDto } from './dto/create-department.dto.js';
import { UpdateDepartmentDto } from './dto/update-department.dto.js';
import { ReorderDepartmentsDto } from './dto/reorder-departments.dto.js';
import { DepartmentListQueryDto } from './dto/department-list-query.dto.js';

@ApiTags('Departments')
@ApiBearerAuth()
@Controller('departments')
@UseGuards(JwtAuthGuard, PermissionsGuard, FeatureFlagGuard)
@RequireFeature('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List departments' })
  findAll(@Query() query: DepartmentListQueryDto) {
    return this.departmentsService.findAll(query);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Reorder departments' })
  @CheckPermissions({ module: 'departments', action: 'edit' })
  reorder(@Body() dto: ReorderDepartmentsDto) {
    return this.departmentsService.reorder(dto);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get department by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.departmentsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create department' })
  @CheckPermissions({ module: 'departments', action: 'create' })
  create(@Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update department' })
  @CheckPermissions({ module: 'departments', action: 'edit' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete department' })
  @CheckPermissions({ module: 'departments', action: 'delete' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.departmentsService.remove(id);
  }
}
```

- [ ] **Step 4: Create DepartmentsModule**

Create `backend/src/modules/departments/departments.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module.js';
import { DepartmentsController } from './departments.controller.js';
import { DepartmentsService } from './departments.service.js';

@Module({
  imports: [FeatureFlagsModule],
  controllers: [DepartmentsController],
  providers: [DepartmentsService],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}
```

- [ ] **Step 5: Register in AppModule**

In `backend/src/app.module.ts`, add the import at the top (after `ClinicIntegrationsModule`):

```typescript
import { DepartmentsModule } from './modules/departments/departments.module.js';
```

Add `DepartmentsModule` to the `imports` array (after `ClinicIntegrationsModule`).

- [ ] **Step 6: Verify backend compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/departments/ backend/src/app.module.ts
git commit -m "feat: add departments backend module with CRUD and FeatureFlagGuard"
```

---

## Task 5: Update ServiceCategory DTOs

**Files:**
- Modify: `backend/src/modules/services/dto/create-category.dto.ts`
- Modify: `backend/src/modules/services/dto/update-category.dto.ts`
- Modify: `backend/src/modules/services/service-categories.service.ts`

- [ ] **Step 1: Add departmentId to CreateCategoryDto**

In `backend/src/modules/services/dto/create-category.dto.ts`, add these imports and field:

Add import `IsUUID` to the class-validator import.

Add this field after `sortOrder`:

```typescript
  @IsOptional()
  @IsUUID()
  departmentId?: string;
```

- [ ] **Step 2: Add departmentId to UpdateCategoryDto**

In `backend/src/modules/services/dto/update-category.dto.ts`, add `IsUUID` import and this field:

```typescript
  @IsOptional()
  @IsUUID()
  departmentId?: string | null;
```

- [ ] **Step 3: Update ServiceCategoriesService**

In `backend/src/modules/services/service-categories.service.ts`:

Update the `create` method — add `departmentId` to the `data` object:

```typescript
  async create(dto: CreateCategoryDto) {
    const category = await this.prisma.serviceCategory.create({
      data: {
        nameEn: dto.nameEn,
        nameAr: dto.nameAr,
        sortOrder: dto.sortOrder ?? 0,
        departmentId: dto.departmentId ?? null,
      },
    });
    await this.invalidateCache();
    return category;
  }
```

Update the `update` method — add `departmentId` to the `data` object:

```typescript
    const updated = await this.prisma.serviceCategory.update({
      where: { id },
      data: {
        nameEn: dto.nameEn,
        nameAr: dto.nameAr,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
        departmentId: dto.departmentId,
      },
    });
```

- [ ] **Step 4: Verify compilation**

```bash
cd backend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/services/dto/create-category.dto.ts backend/src/modules/services/dto/update-category.dto.ts backend/src/modules/services/service-categories.service.ts
git commit -m "feat: add departmentId to ServiceCategory create/update flow"
```

---

## Task 6: Dashboard — Types, Schema, API, Query Keys

**Files:**
- Create: `dashboard/lib/types/department.ts`
- Create: `dashboard/lib/schemas/department.schema.ts`
- Create: `dashboard/lib/api/departments.ts`
- Modify: `dashboard/lib/query-keys.ts`

- [ ] **Step 1: Create types**

Create `dashboard/lib/types/department.ts`:

```typescript
export interface Department {
  id: string
  nameAr: string
  nameEn: string
  descriptionAr: string | null
  descriptionEn: string | null
  icon: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count?: { categories: number }
}

export interface DepartmentListQuery {
  page?: number
  perPage?: number
  search?: string
  isActive?: boolean
}

export interface CreateDepartmentPayload {
  nameAr: string
  nameEn: string
  descriptionAr?: string
  descriptionEn?: string
  icon?: string
  sortOrder?: number
  isActive?: boolean
}

export interface UpdateDepartmentPayload {
  nameAr?: string
  nameEn?: string
  descriptionAr?: string
  descriptionEn?: string
  icon?: string
  sortOrder?: number
  isActive?: boolean
}
```

- [ ] **Step 2: Create Zod schema**

Create `dashboard/lib/schemas/department.schema.ts`:

```typescript
import { z } from "zod"

export const departmentSchema = z.object({
  nameAr: z.string().min(1, "Required").max(255),
  nameEn: z.string().min(1, "Required").max(255),
  descriptionAr: z.string().max(1000).optional().or(z.literal("")),
  descriptionEn: z.string().max(1000).optional().or(z.literal("")),
  icon: z.string().max(100).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
})

export type DepartmentFormData = z.infer<typeof departmentSchema>
```

- [ ] **Step 3: Create API functions**

Create `dashboard/lib/api/departments.ts`:

```typescript
import { api } from "@/lib/api"
import type {
  Department,
  DepartmentListQuery,
  CreateDepartmentPayload,
  UpdateDepartmentPayload,
} from "@/lib/types/department"
import type { PaginatedResponse } from "@/lib/types/common"

export async function fetchDepartments(
  query: DepartmentListQuery = {},
): Promise<PaginatedResponse<Department>> {
  return api.get("/departments", query)
}

export async function fetchDepartment(id: string): Promise<Department> {
  return api.get(`/departments/${id}`)
}

export async function createDepartment(
  payload: CreateDepartmentPayload,
): Promise<Department> {
  return api.post("/departments", payload)
}

export async function updateDepartment(
  id: string,
  payload: UpdateDepartmentPayload,
): Promise<Department> {
  return api.patch(`/departments/${id}`, payload)
}

export async function deleteDepartment(id: string): Promise<void> {
  return api.delete(`/departments/${id}`)
}
```

- [ ] **Step 4: Add query keys**

In `dashboard/lib/query-keys.ts`, add this block (follow the existing pattern, e.g., after `branches`):

```typescript
  /* ─── Departments ─── */
  departments: {
    all: ["departments"] as const,
    list: (filters?: object) =>
      ["departments", "list", filters] as const,
    detail: (id: string) => ["departments", "detail", id] as const,
  },
```

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/types/department.ts dashboard/lib/schemas/department.schema.ts dashboard/lib/api/departments.ts dashboard/lib/query-keys.ts
git commit -m "feat: add department types, schema, API, and query keys"
```

---

## Task 7: Dashboard — Hook

**Files:**
- Create: `dashboard/hooks/use-departments.ts`

- [ ] **Step 1: Create the hook**

Create `dashboard/hooks/use-departments.ts`:

```typescript
"use client"

import { useState, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "@/lib/api/departments"
import type { DepartmentListQuery } from "@/lib/types/department"

export function useDepartments() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [isActive, setIsActive] = useState<boolean | undefined>()

  const query: DepartmentListQuery = {
    page,
    perPage: 20,
    search: search || undefined,
    isActive,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.departments.list(query),
    queryFn: () => fetchDepartments(query),
    staleTime: 5 * 60 * 1000,
  })

  const resetFilters = useCallback(() => {
    setSearch("")
    setIsActive(undefined)
    setPage(1)
  }, [])

  return {
    departments: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error instanceof Error ? error.message : null,
    page,
    setPage,
    search,
    setSearch: (s: string) => {
      setSearch(s)
      setPage(1)
    },
    isActive,
    setIsActive: (v: boolean | undefined) => {
      setIsActive(v)
      setPage(1)
    },
    resetFilters,
    refetch,
  }
}

export function useDepartmentMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.departments.all })

  const createMut = useMutation({
    mutationFn: createDepartment,
    onSuccess: invalidate,
  })

  const updateMut = useMutation({
    mutationFn: ({
      id,
      ...payload
    }: { id: string } & Parameters<typeof updateDepartment>[1]) =>
      updateDepartment(id, payload),
    onSuccess: invalidate,
  })

  const deleteMut = useMutation({
    mutationFn: deleteDepartment,
    onSuccess: invalidate,
  })

  return { createMut, updateMut, deleteMut }
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/hooks/use-departments.ts
git commit -m "feat: add useDepartments and useDepartmentMutations hooks"
```

---

## Task 8: Dashboard — Translations

**Files:**
- Modify: `dashboard/lib/translations/en.ops.ts`
- Modify: `dashboard/lib/translations/ar.ops.ts`

- [ ] **Step 1: Add English translations**

In `dashboard/lib/translations/en.ops.ts`, add before the closing `}`:

```typescript
  // ─── Departments ───
  "nav.departments": "Departments",
  "departments.title": "Departments",
  "departments.description": "Manage clinic departments and service organization",
  "departments.addDepartment": "Add Department",
  "departments.searchPlaceholder": "Search departments...",
  "departments.stats.total": "Total",
  "departments.stats.active": "Active",
  "departments.stats.inactive": "Inactive",
  "departments.empty.title": "No departments",
  "departments.empty.description": "Create a department to organize your services.",
  "departments.col.name": "Name",
  "departments.col.categories": "Categories",
  "departments.col.status": "Status",
  "departments.status.active": "Active",
  "departments.status.inactive": "Inactive",
  "departments.action.edit": "Edit",
  "departments.action.delete": "Delete",
  "departments.filters.allStatuses": "All Statuses",
  "departments.field.nameEn": "Name (English)",
  "departments.field.nameAr": "Name (Arabic)",
  "departments.field.descriptionEn": "Description (English)",
  "departments.field.descriptionAr": "Description (Arabic)",
  "departments.field.icon": "Icon",
  "departments.field.isActive": "Active",
  "departments.create.title": "New Department",
  "departments.create.description": "Create a new department",
  "departments.create.submit": "Create",
  "departments.create.submitting": "Creating...",
  "departments.create.cancel": "Cancel",
  "departments.create.success": "Department created",
  "departments.create.error": "Failed to create department",
  "departments.edit.title": "Edit Department",
  "departments.edit.submit": "Save",
  "departments.edit.submitting": "Saving...",
  "departments.edit.cancel": "Cancel",
  "departments.edit.success": "Department updated",
  "departments.edit.error": "Failed to update department",
  "departments.delete.title": "Delete Department",
  "departments.delete.description": "Are you sure you want to delete \"{name}\"? Categories under it will become unassigned.",
  "departments.delete.submit": "Delete",
  "departments.delete.submitting": "Deleting...",
  "departments.delete.cancel": "Cancel",
  "departments.delete.success": "Department deleted",
  "departments.delete.error": "Failed to delete department",
```

- [ ] **Step 2: Add Arabic translations**

In `dashboard/lib/translations/ar.ops.ts`, add before the closing `}`:

```typescript
  // ─── Departments ───
  "nav.departments": "الأقسام",
  "departments.title": "الأقسام",
  "departments.description": "إدارة أقسام العيادة وتنظيم الخدمات",
  "departments.addDepartment": "إضافة قسم",
  "departments.searchPlaceholder": "بحث في الأقسام...",
  "departments.stats.total": "الإجمالي",
  "departments.stats.active": "نشط",
  "departments.stats.inactive": "غير نشط",
  "departments.empty.title": "لا توجد أقسام",
  "departments.empty.description": "أنشئ قسماً لتنظيم خدماتك.",
  "departments.col.name": "الاسم",
  "departments.col.categories": "التصنيفات",
  "departments.col.status": "الحالة",
  "departments.status.active": "نشط",
  "departments.status.inactive": "غير نشط",
  "departments.action.edit": "تعديل",
  "departments.action.delete": "حذف",
  "departments.filters.allStatuses": "جميع الحالات",
  "departments.field.nameEn": "الاسم (إنجليزي)",
  "departments.field.nameAr": "الاسم (عربي)",
  "departments.field.descriptionEn": "الوصف (إنجليزي)",
  "departments.field.descriptionAr": "الوصف (عربي)",
  "departments.field.icon": "الأيقونة",
  "departments.field.isActive": "نشط",
  "departments.create.title": "قسم جديد",
  "departments.create.description": "إنشاء قسم جديد",
  "departments.create.submit": "إنشاء",
  "departments.create.submitting": "جارٍ الإنشاء...",
  "departments.create.cancel": "إلغاء",
  "departments.create.success": "تم إنشاء القسم",
  "departments.create.error": "فشل إنشاء القسم",
  "departments.edit.title": "تعديل القسم",
  "departments.edit.submit": "حفظ",
  "departments.edit.submitting": "جارٍ الحفظ...",
  "departments.edit.cancel": "إلغاء",
  "departments.edit.success": "تم تحديث القسم",
  "departments.edit.error": "فشل تحديث القسم",
  "departments.delete.title": "حذف القسم",
  "departments.delete.description": "هل أنت متأكد من حذف \"{name}\"؟ التصنيفات التابعة ستصبح بدون قسم.",
  "departments.delete.submit": "حذف",
  "departments.delete.submitting": "جارٍ الحذف...",
  "departments.delete.cancel": "إلغاء",
  "departments.delete.success": "تم حذف القسم",
  "departments.delete.error": "فشل حذف القسم",
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/lib/translations/en.ops.ts dashboard/lib/translations/ar.ops.ts
git commit -m "feat: add department AR+EN translations"
```

---

## Task 9: Dashboard — Sidebar Integration

**Files:**
- Modify: `dashboard/components/sidebar-config.ts`
- Modify: `dashboard/hooks/use-sidebar-nav.ts`

- [ ] **Step 1: Add nav item to sidebar-config.ts**

In `dashboard/components/sidebar-config.ts`, add the import for the department icon:

```typescript
import { Clinic01Icon } from "@hugeicons/core-free-icons"
```

Add the departments nav item to `clinicNav` array (after `branches`):

```typescript
  { titleKey: "nav.departments", href: "/departments", icon: Clinic01Icon, permission: "departments:view" },
```

- [ ] **Step 2: Add feature flag mapping**

In `dashboard/hooks/use-sidebar-nav.ts`, add to the `FEATURE_FLAG_MAP` object:

```typescript
  "/departments": "departments",
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/sidebar-config.ts dashboard/hooks/use-sidebar-nav.ts
git commit -m "feat: add departments to sidebar with feature flag gating"
```

---

## Task 10: Dashboard — List Page Components

**Files:**
- Create: `dashboard/components/features/departments/department-columns.tsx`
- Create: `dashboard/components/features/departments/delete-department-dialog.tsx`
- Create: `dashboard/components/features/departments/create-department-dialog.tsx`
- Create: `dashboard/components/features/departments/edit-department-dialog.tsx`
- Create: `dashboard/components/features/departments/department-list-page.tsx`
- Create: `dashboard/app/(dashboard)/departments/page.tsx`

- [ ] **Step 1: Create column definitions**

Create `dashboard/components/features/departments/department-columns.tsx`:

```tsx
"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  MoreHorizontalIcon,
  PencilEdit01Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Department } from "@/lib/types/department"

export function getDepartmentColumns(
  locale: "en" | "ar",
  t: (key: string) => string,
  onEdit?: (d: Department) => void,
  onDelete?: (d: Department) => void,
): ColumnDef<Department>[] {
  return [
    {
      id: "name",
      header: t("departments.col.name"),
      enableSorting: false,
      cell: ({ row }) => {
        const d = row.original
        return (
          <div className="flex flex-col">
            <span className="font-medium text-foreground">
              {locale === "ar" ? d.nameAr : d.nameEn}
            </span>
            <span className="text-xs text-muted-foreground">
              {locale === "ar" ? d.nameEn : d.nameAr}
            </span>
          </div>
        )
      },
    },
    {
      id: "categories",
      header: t("departments.col.categories"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {row.original._count?.categories ?? 0}
        </span>
      ),
    },
    {
      id: "status",
      header: t("departments.col.status"),
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={
            row.original.isActive
              ? "border-success/30 bg-success/10 text-success"
              : "border-muted-foreground/30 bg-muted text-muted-foreground"
          }
        >
          {row.original.isActive
            ? t("departments.status.active")
            : t("departments.status.inactive")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const d = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-solid">
              <DropdownMenuItem onClick={() => onEdit?.(d)}>
                <HugeiconsIcon icon={PencilEdit01Icon} size={14} className="me-2" />
                {t("departments.action.edit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete?.(d)}
                className="text-destructive focus:text-destructive"
              >
                <HugeiconsIcon icon={Delete02Icon} size={14} className="me-2" />
                {t("departments.action.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]
}
```

- [ ] **Step 2: Create delete dialog**

Create `dashboard/components/features/departments/delete-department-dialog.tsx`:

```tsx
"use client"

import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useDepartmentMutations } from "@/hooks/use-departments"
import { useLocale } from "@/components/locale-provider"
import type { Department } from "@/lib/types/department"

interface Props {
  department: Department | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteDepartmentDialog({ department, open, onOpenChange }: Props) {
  const { t, locale } = useLocale()
  const { deleteMut } = useDepartmentMutations()

  const name = department
    ? (locale === "ar" ? department.nameAr : department.nameEn)
    : ""

  const handleDelete = async () => {
    if (!department) return
    try {
      await deleteMut.mutateAsync(department.id)
      toast.success(t("departments.delete.success"))
      onOpenChange(false)
    } catch {
      toast.error(t("departments.delete.error"))
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("departments.delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("departments.delete.description").replace("{name}", name)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMut.isPending}>
            {t("departments.delete.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMut.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMut.isPending
              ? t("departments.delete.submitting")
              : t("departments.delete.submit")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **Step 3: Create create dialog**

Create `dashboard/components/features/departments/create-department-dialog.tsx`:

```tsx
"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useDepartmentMutations } from "@/hooks/use-departments"
import { useLocale } from "@/components/locale-provider"
import {
  departmentSchema,
  type DepartmentFormData,
} from "@/lib/schemas/department.schema"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateDepartmentDialog({ open, onOpenChange }: Props) {
  const { t } = useLocale()
  const { createMut } = useDepartmentMutations()

  const form = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { nameAr: "", nameEn: "", descriptionAr: "", descriptionEn: "", icon: "", isActive: true },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await createMut.mutateAsync({
        nameAr: data.nameAr,
        nameEn: data.nameEn,
        descriptionAr: data.descriptionAr || undefined,
        descriptionEn: data.descriptionEn || undefined,
        icon: data.icon || undefined,
        isActive: data.isActive,
      })
      toast.success(t("departments.create.success"))
      form.reset()
      onOpenChange(false)
    } catch {
      toast.error(t("departments.create.error"))
    }
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end">
        <SheetHeader>
          <SheetTitle>{t("departments.create.title")}</SheetTitle>
          <SheetDescription>{t("departments.create.description")}</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <form id="create-dept" onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("departments.field.nameEn")} *</Label>
                <Input {...form.register("nameEn")} />
                {form.formState.errors.nameEn && (
                  <p className="text-xs text-destructive">{form.formState.errors.nameEn.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("departments.field.nameAr")} *</Label>
                <Input {...form.register("nameAr")} dir="rtl" />
                {form.formState.errors.nameAr && (
                  <p className="text-xs text-destructive">{form.formState.errors.nameAr.message}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("departments.field.descriptionEn")}</Label>
                <Input {...form.register("descriptionEn")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("departments.field.descriptionAr")}</Label>
                <Input {...form.register("descriptionAr")} dir="rtl" />
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="create-dept-active" className="cursor-pointer">
                {t("departments.field.isActive")}
              </Label>
              <Switch
                id="create-dept-active"
                checked={form.watch("isActive")}
                onCheckedChange={(v) => form.setValue("isActive", v)}
              />
            </div>
          </form>
        </SheetBody>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("departments.create.cancel")}
          </Button>
          <Button type="submit" form="create-dept" disabled={createMut.isPending}>
            {createMut.isPending ? t("departments.create.submitting") : t("departments.create.submit")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 4: Create edit dialog**

Create `dashboard/components/features/departments/edit-department-dialog.tsx`:

```tsx
"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useDepartmentMutations } from "@/hooks/use-departments"
import { useLocale } from "@/components/locale-provider"
import {
  departmentSchema,
  type DepartmentFormData,
} from "@/lib/schemas/department.schema"
import type { Department } from "@/lib/types/department"

interface Props {
  department: Department | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditDepartmentDialog({ department, open, onOpenChange }: Props) {
  const { t } = useLocale()
  const { updateMut } = useDepartmentMutations()

  const form = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { nameAr: "", nameEn: "", descriptionAr: "", descriptionEn: "", icon: "", isActive: true },
  })

  useEffect(() => {
    if (department && open) {
      form.reset({
        nameAr: department.nameAr,
        nameEn: department.nameEn,
        descriptionAr: department.descriptionAr ?? "",
        descriptionEn: department.descriptionEn ?? "",
        icon: department.icon ?? "",
        isActive: department.isActive,
      })
    }
  }, [department, open, form])

  const onSubmit = form.handleSubmit(async (data) => {
    if (!department) return
    try {
      await updateMut.mutateAsync({
        id: department.id,
        nameAr: data.nameAr,
        nameEn: data.nameEn,
        descriptionAr: data.descriptionAr || undefined,
        descriptionEn: data.descriptionEn || undefined,
        icon: data.icon || undefined,
        isActive: data.isActive,
      })
      toast.success(t("departments.edit.success"))
      onOpenChange(false)
    } catch {
      toast.error(t("departments.edit.error"))
    }
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end">
        <SheetHeader>
          <SheetTitle>{t("departments.edit.title")}</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <form id="edit-dept" onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("departments.field.nameEn")} *</Label>
                <Input {...form.register("nameEn")} />
                {form.formState.errors.nameEn && (
                  <p className="text-xs text-destructive">{form.formState.errors.nameEn.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("departments.field.nameAr")} *</Label>
                <Input {...form.register("nameAr")} dir="rtl" />
                {form.formState.errors.nameAr && (
                  <p className="text-xs text-destructive">{form.formState.errors.nameAr.message}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("departments.field.descriptionEn")}</Label>
                <Input {...form.register("descriptionEn")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("departments.field.descriptionAr")}</Label>
                <Input {...form.register("descriptionAr")} dir="rtl" />
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="edit-dept-active" className="cursor-pointer">
                {t("departments.field.isActive")}
              </Label>
              <Switch
                id="edit-dept-active"
                checked={form.watch("isActive")}
                onCheckedChange={(v) => form.setValue("isActive", v)}
              />
            </div>
          </form>
        </SheetBody>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("departments.edit.cancel")}
          </Button>
          <Button type="submit" form="edit-dept" disabled={updateMut.isPending}>
            {updateMut.isPending ? t("departments.edit.submitting") : t("departments.edit.submit")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 5: Create list page component**

Create `dashboard/components/features/departments/department-list-page.tsx`:

```tsx
"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Clinic01Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { StatsGrid } from "@/components/features/stats-grid"
import { StatCard } from "@/components/features/stat-card"
import { DataTable } from "@/components/features/data-table"
import { FilterBar } from "@/components/features/filter-bar"
import { ErrorBanner } from "@/components/features/error-banner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getDepartmentColumns } from "./department-columns"
import { CreateDepartmentDialog } from "./create-department-dialog"
import { EditDepartmentDialog } from "./edit-department-dialog"
import { DeleteDepartmentDialog } from "./delete-department-dialog"
import { useDepartments } from "@/hooks/use-departments"
import { useLocale } from "@/components/locale-provider"
import type { Department } from "@/lib/types/department"

export function DepartmentListPage() {
  const { t, locale } = useLocale()
  const {
    departments, meta, isLoading, error,
    search, setSearch, isActive, setIsActive,
    page, setPage, resetFilters, refetch,
  } = useDepartments()

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Department | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null)

  const columns = getDepartmentColumns(locale, t, setEditTarget, setDeleteTarget)

  const activeCount = departments.filter((d) => d.isActive).length
  const inactiveCount = departments.filter((d) => !d.isActive).length

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader title={t("departments.title")} description={t("departments.description")}>
        <Button className="gap-2 rounded-full px-5" onClick={() => setCreateOpen(true)}>
          <HugeiconsIcon icon={Add01Icon} size={16} />
          {t("departments.addDepartment")}
        </Button>
      </PageHeader>

      {isLoading && !meta ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-lg" />
          ))}
        </div>
      ) : (
        <StatsGrid className="sm:grid-cols-3 lg:grid-cols-3">
          <StatCard title={t("departments.stats.total")} value={meta?.total ?? 0} icon={Clinic01Icon} iconColor="primary" />
          <StatCard title={t("departments.stats.active")} value={activeCount} icon={CheckmarkCircle02Icon} iconColor="success" />
          <StatCard title={t("departments.stats.inactive")} value={inactiveCount} icon={Cancel01Icon} iconColor="warning" />
        </StatsGrid>
      )}

      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: t("departments.searchPlaceholder") }}
        selects={[{
          key: "status",
          value: isActive === undefined ? "all" : isActive ? "active" : "inactive",
          placeholder: t("departments.filters.allStatuses"),
          options: [
            { value: "all", label: t("departments.filters.allStatuses") },
            { value: "active", label: t("departments.status.active") },
            { value: "inactive", label: t("departments.status.inactive") },
          ],
          onValueChange: (v) => setIsActive(v === "all" ? undefined : v === "active"),
        }]}
        hasFilters={search.length > 0 || isActive !== undefined}
        onReset={resetFilters}
      />

      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}

      {isLoading && departments.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={departments}
          emptyTitle={t("departments.empty.title")}
          emptyDescription={t("departments.empty.description")}
          emptyAction={{ label: t("departments.addDepartment"), onClick: () => setCreateOpen(true) }}
        />
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground tabular-nums">{page} / {meta.totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              {t("table.previous")}
            </Button>
            <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>
              {t("table.next")}
            </Button>
          </div>
        </div>
      )}

      <CreateDepartmentDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditDepartmentDialog department={editTarget} open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null) }} />
      <DeleteDepartmentDialog department={deleteTarget} open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }} />
    </ListPageShell>
  )
}
```

- [ ] **Step 6: Create the page route**

Create `dashboard/app/(dashboard)/departments/page.tsx`:

```tsx
"use client"

import { DepartmentListPage } from "@/components/features/departments/department-list-page"

export default function DepartmentsRoute() {
  return <DepartmentListPage />
}
```

- [ ] **Step 7: Verify dashboard compiles**

```bash
cd dashboard && npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add dashboard/components/features/departments/ dashboard/app/\(dashboard\)/departments/
git commit -m "feat: add departments dashboard page with CRUD dialogs"
```

---

## Task 11: Verification

- [ ] **Step 1: Run backend tests**

```bash
cd backend && npm run test
```

Expected: All existing tests pass.

- [ ] **Step 2: Run dashboard lint**

```bash
cd dashboard && npm run lint
```

Expected: 0 errors.

- [ ] **Step 3: Verify feature flag gating**

Start the backend, then test:

```bash
# Feature disabled (default) — should return 403
curl -s http://localhost:5000/departments | jq .

# Enable the feature flag in DB, then retry — should return 200
```

- [ ] **Step 4: Verify file sizes**

No file should exceed 350 lines. Check:

```bash
wc -l backend/src/modules/departments/*.ts backend/src/modules/departments/dto/*.ts dashboard/components/features/departments/*.tsx dashboard/hooks/use-departments.ts dashboard/lib/api/departments.ts
```

Expected: All files under 350 lines.
