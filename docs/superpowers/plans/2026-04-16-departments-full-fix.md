# Departments Module — Full Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** إصلاح جميع المشاكل الحرجة والمتوسطة في موديول الأقسام (Backend + Frontend) — الحذف المكسور، البحث الصامت، تعارض DTO/Schema، وعدة مشاكل UX.

**Architecture:**
- Backend: إضافة حقول `descriptionAr/descriptionEn/icon` للـ Prisma schema + migration، إضافة DeleteDepartmentHandler، إصلاح search في ListDepartmentsDto/Handler، إصلاح TOCTOU في update.
- Frontend: إضافة `deleteDepartment` في API client + `deleteMut` في hook، إصلاح DeleteDepartmentDialog لتستدعي الـ API فعلاً، تمرير search للباك-إند، إصلاح edit form reset، إضافة بطاقة 4th stats.

**Tech Stack:** NestJS 11, Prisma 7, class-validator, Next.js 15, TanStack Query v5, React Hook Form, Zod, shadcn/ui, next-intl

---

## ملاحظات مهمة قبل البدء

- **Migrations immutable** — أنشئ migration جديدة لكل تغيير schema، لا تعدّل موجودة.
- **Migration naming:** `YYYYMMDDHHMMSS_p11_departments_<description>` (استخدم timestamp حقيقي).
- **بعد كل migration:** شغّل `cd apps/backend && npm run prisma:migrate` للتطبيق.
- **الـ search param في ListDepartmentsDto:** أضفه كـ `@IsOptional() @IsString() @MaxLength(200) search?: string`.
- **TOCTOU fix:** استخدم `updateMany({ where: { id, tenantId }, data })` بدل findFirst ثم update.
- **CheckPermissions:** الدالة موجودة في `apps/backend/src/common/guards/casl.guard.ts` — استخدمها.

---

## File Map

| الملف | الإجراء |
|-------|---------|
| `apps/backend/prisma/schema/organization.prisma` | تعديل: إضافة `descriptionAr`, `descriptionEn`, `icon`, `@@unique([tenantId, nameAr])` |
| `apps/backend/prisma/migrations/[ts]_p11_departments_fields_unique/migration.sql` | إنشاء: migration للحقول الجديدة والـ unique constraint |
| `apps/backend/src/modules/org-config/departments/create-department.dto.ts` | تعديل: حذف descriptionAr/En/icon (هي موجودة قبل migration) |
| `apps/backend/src/modules/org-config/departments/list-departments.dto.ts` | تعديل: إضافة `search` field |
| `apps/backend/src/modules/org-config/departments/list-departments.handler.ts` | تعديل: استخدام `search` في where clause |
| `apps/backend/src/modules/org-config/departments/update-department.handler.ts` | تعديل: fix TOCTOU — استخدام updateMany |
| `apps/backend/src/modules/org-config/departments/delete-department.handler.ts` | إنشاء: جديد |
| `apps/backend/src/modules/org-config/departments/delete-department.dto.ts` | إنشاء: جديد |
| `apps/backend/src/modules/org-config/org-config.module.ts` | تعديل: register DeleteDepartmentHandler |
| `apps/backend/src/api/dashboard/organization-departments.controller.ts` | تعديل: إضافة DELETE endpoint + CheckPermissions |
| `apps/backend/src/modules/org-config/departments/departments.handler.spec.ts` | تعديل: إضافة delete tests + cross-tenant + search tests |
| `apps/dashboard/lib/api/departments.ts` | تعديل: إضافة search param + deleteDepartment |
| `apps/dashboard/hooks/use-departments.ts` | تعديل: إضافة deleteMut |
| `apps/dashboard/components/features/departments/delete-department-dialog.tsx` | تعديل: استدعاء deleteMut فعلياً |
| `apps/dashboard/components/features/departments/edit-department-dialog.tsx` | تعديل: reset form عند الإغلاق |
| `apps/dashboard/components/features/departments/department-list-page.tsx` | تعديل: إضافة 4th stat card |
| `apps/dashboard/lib/schemas/department.schema.ts` | تعديل: رسائل Zod عبر i18n |

---

## Task 1: Prisma Schema — إضافة الحقول الجديدة + unique constraint

**Files:**
- Modify: `apps/backend/prisma/schema/organization.prisma`
- Create: `apps/backend/prisma/migrations/[timestamp]_p11_departments_fields_unique/migration.sql`

- [ ] **Step 1: تعديل Prisma schema**

في `apps/backend/prisma/schema/organization.prisma`، عدّل model `Department` ليصبح:

```prisma
model Department {
  id            String   @id @default(uuid())
  tenantId      String
  nameAr        String
  nameEn        String?
  descriptionAr String?
  descriptionEn String?
  icon          String?
  isVisible     Boolean  @default(true)
  sortOrder     Int      @default(0)
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  categories ServiceCategory[]

  @@unique([tenantId, nameAr])
  @@index([tenantId])
  @@index([tenantId, isActive])
}
```

- [ ] **Step 2: إنشاء migration**

```bash
cd apps/backend && npx prisma migrate dev --name p11_departments_fields_unique
```

Expected: migration file created in `prisma/migrations/`.

- [ ] **Step 3: تحقق أن schema يتطابق**

```bash
cd apps/backend && npx prisma validate
```

Expected: `The schema at ... is valid 🚀`

- [ ] **Step 4: Commit**

```bash
git add apps/backend/prisma/schema/organization.prisma apps/backend/prisma/migrations/
git commit -m "feat(backend/departments): add descriptionAr/En, icon fields + unique(tenantId,nameAr)"
```

---

## Task 2: Backend — إصلاح CreateDepartmentHandler + DTO (استخدام الحقول الجديدة)

**Files:**
- Modify: `apps/backend/src/modules/org-config/departments/create-department.dto.ts`
- Modify: `apps/backend/src/modules/org-config/departments/create-department.handler.ts`

- [ ] **Step 1: DTO يجب أن يبقى كما هو (الحقول موجودة الآن في schema)**

الـ `CreateDepartmentDto` يقبل بالفعل `descriptionAr`, `descriptionEn`, `icon` — الآن بعد إضافة الحقول للـ schema، نحتاج فقط نحدّث الـ handler ليخزّنها.

عدّل `apps/backend/src/modules/org-config/departments/create-department.handler.ts`:

```typescript
import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateDepartmentDto } from './create-department.dto';

export type CreateDepartmentCommand = CreateDepartmentDto & { tenantId: string };

@Injectable()
export class CreateDepartmentHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CreateDepartmentCommand) {
    const existing = await this.prisma.department.findFirst({
      where: { tenantId: dto.tenantId, nameAr: dto.nameAr },
    });
    if (existing) throw new ConflictException('Department with this Arabic name already exists');

    return this.prisma.department.create({
      data: {
        tenantId: dto.tenantId,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        descriptionAr: dto.descriptionAr,
        descriptionEn: dto.descriptionEn,
        icon: dto.icon,
        isActive: dto.isActive ?? true,
        isVisible: dto.isVisible ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }
}
```

- [ ] **Step 2: شغّل tests الموجودة للتأكد ما كسرنا شيء**

```bash
cd apps/backend && npx jest src/modules/org-config/departments/departments.handler.spec.ts --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/org-config/departments/create-department.handler.ts
git commit -m "fix(backend/departments): persist descriptionAr/En + icon, check duplicate nameAr"
```

---

## Task 3: Backend — إضافة search للـ ListDepartmentsHandler

**Files:**
- Modify: `apps/backend/src/modules/org-config/departments/list-departments.dto.ts`
- Modify: `apps/backend/src/modules/org-config/departments/list-departments.handler.ts`

- [ ] **Step 1: إضافة search للـ DTO**

عدّل `apps/backend/src/modules/org-config/departments/list-departments.dto.ts`:

```typescript
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto';

export class ListDepartmentsDto extends PaginationDto {
  @IsOptional() @IsBoolean() @Type(() => Boolean) isActive?: boolean;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
}
```

- [ ] **Step 2: استخدام search في الـ Handler**

عدّل `apps/backend/src/modules/org-config/departments/list-departments.handler.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { toListResponse } from '../../../common/dto';
import { ListDepartmentsDto } from './list-departments.dto';

export type ListDepartmentsQuery = ListDepartmentsDto & { tenantId: string };

@Injectable()
export class ListDepartmentsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: ListDepartmentsQuery) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      tenantId: dto.tenantId,
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.search && {
        nameAr: { contains: dto.search, mode: 'insensitive' as const },
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.department.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: { categories: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
      }),
      this.prisma.department.count({ where }),
    ]);

    return toListResponse(items, total, page, limit);
  }
}
```

- [ ] **Step 3: شغّل tests**

```bash
cd apps/backend && npx jest src/modules/org-config/departments/departments.handler.spec.ts --no-coverage
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/org-config/departments/list-departments.dto.ts \
        apps/backend/src/modules/org-config/departments/list-departments.handler.ts
git commit -m "feat(backend/departments): add search filter to list endpoint"
```

---

## Task 4: Backend — إصلاح TOCTOU في UpdateDepartmentHandler

**Files:**
- Modify: `apps/backend/src/modules/org-config/departments/update-department.handler.ts`

- [ ] **Step 1: تعديل Handler باستخدام updateMany**

عدّل `apps/backend/src/modules/org-config/departments/update-department.handler.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { UpdateDepartmentDto } from './update-department.dto';

export type UpdateDepartmentCommand = UpdateDepartmentDto & { tenantId: string; departmentId: string };

@Injectable()
export class UpdateDepartmentHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: UpdateDepartmentCommand) {
    const result = await this.prisma.department.updateMany({
      where: { id: dto.departmentId, tenantId: dto.tenantId },
      data: {
        ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
        ...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
        ...(dto.isVisible !== undefined && { isVisible: dto.isVisible }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    if (result.count === 0) throw new NotFoundException('Department not found');

    return this.prisma.department.findFirst({
      where: { id: dto.departmentId, tenantId: dto.tenantId },
    });
  }
}
```

- [ ] **Step 2: تحديث mock في spec للـ updateMany**

في `departments.handler.spec.ts`، أضف `updateMany` للـ mock داخل `buildPrisma()`:

```typescript
const buildPrisma = () => ({
  department: {
    create: jest.fn().mockResolvedValue(mockDept),
    findMany: jest.fn().mockResolvedValue([mockDept]),
    count: jest.fn().mockResolvedValue(1),
    findFirst: jest.fn().mockResolvedValue(mockDept),
    update: jest.fn().mockResolvedValue(mockDept),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    delete: jest.fn().mockResolvedValue(mockDept),
  },
  $transaction: jest.fn().mockImplementation((promises) => Promise.all(promises as unknown as unknown[])),
});
```

- [ ] **Step 3: شغّل tests**

```bash
cd apps/backend && npx jest src/modules/org-config/departments/departments.handler.spec.ts --no-coverage
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/org-config/departments/update-department.handler.ts \
        apps/backend/src/modules/org-config/departments/departments.handler.spec.ts
git commit -m "fix(backend/departments): atomic update via updateMany — fix TOCTOU"
```

---

## Task 5: Backend — إضافة DeleteDepartmentHandler + endpoint

**Files:**
- Create: `apps/backend/src/modules/org-config/departments/delete-department.dto.ts`
- Create: `apps/backend/src/modules/org-config/departments/delete-department.handler.ts`
- Modify: `apps/backend/src/modules/org-config/org-config.module.ts`
- Modify: `apps/backend/src/api/dashboard/organization-departments.controller.ts`

- [ ] **Step 1: إنشاء DeleteDepartmentDto**

أنشئ `apps/backend/src/modules/org-config/departments/delete-department.dto.ts`:

```typescript
export class DeleteDepartmentDto {
  tenantId!: string;
  departmentId!: string;
}
```

- [ ] **Step 2: إنشاء DeleteDepartmentHandler**

أنشئ `apps/backend/src/modules/org-config/departments/delete-department.handler.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export type DeleteDepartmentCommand = { tenantId: string; departmentId: string };

@Injectable()
export class DeleteDepartmentHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: DeleteDepartmentCommand) {
    const result = await this.prisma.department.deleteMany({
      where: { id: dto.departmentId, tenantId: dto.tenantId },
    });

    if (result.count === 0) throw new NotFoundException('Department not found');

    return { deleted: true };
  }
}
```

- [ ] **Step 3: تسجيل Handler في org-config.module.ts**

في `apps/backend/src/modules/org-config/org-config.module.ts`، أضف `DeleteDepartmentHandler` للـ `departmentHandlers` array ولـ `exports`. أولاً اقرأ الملف ثم عدّله لتضيف:
```typescript
import { DeleteDepartmentHandler } from './departments/delete-department.handler';
```
وأضفه في `departmentHandlers` و`exports`.

- [ ] **Step 4: إضافة DELETE endpoint للـ controller**

عدّل `apps/backend/src/api/dashboard/organization-departments.controller.ts` بالكامل:

```typescript
import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { CreateDepartmentHandler } from '../../modules/org-config/departments/create-department.handler';
import { CreateDepartmentDto } from '../../modules/org-config/departments/create-department.dto';
import { UpdateDepartmentHandler } from '../../modules/org-config/departments/update-department.handler';
import { UpdateDepartmentDto } from '../../modules/org-config/departments/update-department.dto';
import { ListDepartmentsHandler } from '../../modules/org-config/departments/list-departments.handler';
import { ListDepartmentsDto } from '../../modules/org-config/departments/list-departments.dto';
import { DeleteDepartmentHandler } from '../../modules/org-config/departments/delete-department.handler';

@ApiTags('Departments')
@ApiBearerAuth()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/organization')
export class DashboardOrganizationDepartmentsController {
  constructor(
    private readonly createDepartment: CreateDepartmentHandler,
    private readonly updateDepartment: UpdateDepartmentHandler,
    private readonly listDepartments: ListDepartmentsHandler,
    private readonly deleteDepartment: DeleteDepartmentHandler,
  ) {}

  @Post('departments')
  @CheckPermissions(['create', 'Department'])
  createDepartmentEndpoint(
    @TenantId() tenantId: string,
    @Body() body: CreateDepartmentDto,
  ) {
    return this.createDepartment.execute({ tenantId, ...body });
  }

  @Get('departments')
  @CheckPermissions(['read', 'Department'])
  listDepartmentsEndpoint(
    @TenantId() tenantId: string,
    @Query() query: ListDepartmentsDto,
  ) {
    return this.listDepartments.execute({ tenantId, ...query });
  }

  @Patch('departments/:departmentId')
  @CheckPermissions(['update', 'Department'])
  updateDepartmentEndpoint(
    @TenantId() tenantId: string,
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Body() body: UpdateDepartmentDto,
  ) {
    return this.updateDepartment.execute({ tenantId, departmentId, ...body });
  }

  @Delete('departments/:departmentId')
  @CheckPermissions(['delete', 'Department'])
  deleteDepartmentEndpoint(
    @TenantId() tenantId: string,
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
  ) {
    return this.deleteDepartment.execute({ tenantId, departmentId });
  }
}
```

- [ ] **Step 5: شغّل typecheck والـ tests**

```bash
cd apps/backend && npx tsc --noEmit && npx jest src/modules/org-config/departments/ --no-coverage
```

Expected: 0 type errors, tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/org-config/departments/delete-department.dto.ts \
        apps/backend/src/modules/org-config/departments/delete-department.handler.ts \
        apps/backend/src/modules/org-config/org-config.module.ts \
        apps/backend/src/api/dashboard/organization-departments.controller.ts
git commit -m "feat(backend/departments): add DELETE endpoint + CheckPermissions on all routes"
```

---

## Task 6: Backend — إضافة test coverage للـ delete + cross-tenant + search

**Files:**
- Modify: `apps/backend/src/modules/org-config/departments/departments.handler.spec.ts`

- [ ] **Step 1: إضافة tests للـ DeleteDepartmentHandler**

في `apps/backend/src/modules/org-config/departments/departments.handler.spec.ts`، أضف في نهاية الملف:

```typescript
import { DeleteDepartmentHandler } from './delete-department.handler';

describe('DeleteDepartmentHandler', () => {
  it('deletes department scoped to tenant', async () => {
    const prisma = buildPrisma();
    const handler = new DeleteDepartmentHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1', departmentId: 'dept-1' });
    expect(prisma.department.deleteMany).toHaveBeenCalledWith({
      where: { id: 'dept-1', tenantId: 'tenant-1' },
    });
    expect(result).toEqual({ deleted: true });
  });

  it('throws NotFoundException when department not found or belongs to another tenant', async () => {
    const prisma = buildPrisma();
    prisma.department.deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const handler = new DeleteDepartmentHandler(prisma as never);
    await expect(
      handler.execute({ tenantId: 'tenant-2', departmentId: 'dept-1' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('ListDepartmentsHandler — search', () => {
  it('passes search term to where clause', async () => {
    const prisma = buildPrisma();
    const handler = new ListDepartmentsHandler(prisma as never);
    await handler.execute({ tenantId: 'tenant-1', page: 1, limit: 10, search: 'طب' });
    const call = (prisma.department.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where).toMatchObject({
      tenantId: 'tenant-1',
      nameAr: { contains: 'طب', mode: 'insensitive' },
    });
  });

  it('omits search clause when search is undefined', async () => {
    const prisma = buildPrisma();
    const handler = new ListDepartmentsHandler(prisma as never);
    await handler.execute({ tenantId: 'tenant-1', page: 1, limit: 10 });
    const call = (prisma.department.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where).not.toHaveProperty('nameAr');
  });
});

describe('UpdateDepartmentHandler — cross-tenant protection', () => {
  it('throws NotFoundException when departmentId belongs to another tenant', async () => {
    const prisma = buildPrisma();
    prisma.department.updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const handler = new UpdateDepartmentHandler(prisma as never);
    await expect(
      handler.execute({ tenantId: 'tenant-2', departmentId: 'dept-1', nameAr: 'x' }),
    ).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: شغّل tests**

```bash
cd apps/backend && npx jest src/modules/org-config/departments/departments.handler.spec.ts --no-coverage --verbose
```

Expected: 10+ tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/org-config/departments/departments.handler.spec.ts
git commit -m "test(backend/departments): add delete, cross-tenant, search coverage"
```

---

## Task 7: Frontend — إصلاح API client (search param + deleteDepartment)

**Files:**
- Modify: `apps/dashboard/lib/api/departments.ts`

- [ ] **Step 1: تعديل departments API client**

استبدل محتوى `apps/dashboard/lib/api/departments.ts` بالكامل:

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
  return api.get("/dashboard/organization/departments", {
    page: query.page,
    limit: query.perPage,
    isActive: query.isActive,
    search: query.search,
  })
}

export async function createDepartment(
  payload: CreateDepartmentPayload,
): Promise<Department> {
  return api.post("/dashboard/organization/departments", payload)
}

export async function updateDepartment(
  id: string,
  payload: UpdateDepartmentPayload,
): Promise<Department> {
  return api.patch(`/dashboard/organization/departments/${id}`, payload)
}

export async function deleteDepartment(id: string): Promise<{ deleted: boolean }> {
  return api.delete(`/dashboard/organization/departments/${id}`)
}
```

- [ ] **Step 2: typecheck**

```bash
cd apps/dashboard && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors (أو نفس الأخطاء الموجودة قبل التعديل)

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/lib/api/departments.ts
git commit -m "fix(dashboard/departments): pass search param to API + add deleteDepartment"
```

---

## Task 8: Frontend — إضافة deleteMut للـ hook

**Files:**
- Modify: `apps/dashboard/hooks/use-departments.ts`

- [ ] **Step 1: إضافة deleteMut**

في `apps/dashboard/hooks/use-departments.ts`، عدّل الـ imports وأضف `deleteMut` في `useDepartmentMutations`:

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

/** Flat list of active departments for use in dropdowns/selects */
export function useDepartmentOptions() {
  const query: DepartmentListQuery = { page: 1, perPage: 100, isActive: true }
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.departments.list(query),
    queryFn: () => fetchDepartments(query),
    staleTime: 5 * 60 * 1000,
  })
  return {
    options: data?.items ?? [],
    isLoading,
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
    mutationFn: (id: string) => deleteDepartment(id),
    onSuccess: invalidate,
  })

  return { createMut, updateMut, deleteMut }
}
```

- [ ] **Step 2: typecheck**

```bash
cd apps/dashboard && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 new errors

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/hooks/use-departments.ts
git commit -m "feat(dashboard/departments): add deleteMut to useDepartmentMutations hook"
```

---

## Task 9: Frontend — إصلاح DeleteDepartmentDialog

**Files:**
- Modify: `apps/dashboard/components/features/departments/delete-department-dialog.tsx`

- [ ] **Step 1: استبدال dialog بالكامل**

استبدل `apps/dashboard/components/features/departments/delete-department-dialog.tsx` بالكامل:

```typescript
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
import { useLocale } from "@/components/locale-provider"
import { useDepartmentMutations } from "@/hooks/use-departments"
import type { Department } from "@/lib/types/department"

interface DeleteDepartmentDialogProps {
  department: Department | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteDepartmentDialog({
  department,
  open,
  onOpenChange,
}: DeleteDepartmentDialogProps) {
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("departments.delete.error"))
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

- [ ] **Step 2: typecheck**

```bash
cd apps/dashboard && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 new errors

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/components/features/departments/delete-department-dialog.tsx
git commit -m "fix(dashboard/departments): wire delete dialog to actual API call"
```

---

## Task 10: Frontend — إصلاح edit form reset + 4th stat card + Zod i18n

**Files:**
- Modify: `apps/dashboard/components/features/departments/edit-department-dialog.tsx`
- Modify: `apps/dashboard/components/features/departments/department-list-page.tsx`
- Modify: `apps/dashboard/lib/schemas/department.schema.ts`

- [ ] **Step 1: إصلاح edit form reset عند الإغلاق**

في `apps/dashboard/components/features/departments/edit-department-dialog.tsx`، الـ `useEffect` الحالي يُعيد ضبط الفورم فقط عند `open=true`. أضف reset عند الإغلاق:

```typescript
useEffect(() => {
  if (department && open) {
    form.reset({
      nameAr: department.nameAr,
      nameEn: department.nameEn,
      descriptionAr: department.descriptionAr ?? "",
      descriptionEn: department.descriptionEn ?? "",
      icon: department.icon ?? "",
      sortOrder: department.sortOrder ?? 0,
      isActive: department.isActive,
    })
  } else if (!open) {
    form.reset({
      nameAr: "",
      nameEn: "",
      descriptionAr: "",
      descriptionEn: "",
      icon: "",
      sortOrder: 0,
      isActive: true,
    })
  }
}, [department, open, form])
```

- [ ] **Step 2: إضافة 4th stat card (New this month)**

في `apps/dashboard/components/features/departments/department-list-page.tsx`، أضف import لـ `CalendarAdd02Icon`:

```typescript
import {
  Add01Icon,
  Building06Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  CalendarAdd02Icon,
} from "@hugeicons/core-free-icons"
```

وأضف حساب الأقسام الجديدة هذا الشهر بعد `const inactiveCount`:

```typescript
const now = new Date()
const newThisMonth = departments.filter((d) => {
  const created = new Date(d.createdAt)
  return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth()
}).length
```

وعدّل `StatsGrid` ليكون 4 cards (غيّر `sm:grid-cols-3 lg:grid-cols-3` إلى `sm:grid-cols-2 lg:grid-cols-4`):

```tsx
<StatsGrid className="sm:grid-cols-2 lg:grid-cols-4">
  <StatCard title={t("departments.stats.total")} value={meta?.total ?? 0} icon={Building06Icon} iconColor="primary" />
  <StatCard title={t("departments.stats.active")} value={activeCount} icon={CheckmarkCircle02Icon} iconColor="success" />
  <StatCard title={t("departments.stats.inactive")} value={inactiveCount} icon={Cancel01Icon} iconColor="warning" />
  <StatCard title={t("departments.stats.newThisMonth")} value={newThisMonth} icon={CalendarAdd02Icon} iconColor="accent" />
</StatsGrid>
```

وعدّل skeleton ليكون 4 بدل 3:

```tsx
{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
```

- [ ] **Step 3: إضافة مفتاح translation للـ 4th stat**

في `apps/dashboard/lib/translations/ar.departments.ts`، أضف:
```typescript
"departments.stats.newThisMonth": "جديد هذا الشهر",
```

في `apps/dashboard/lib/translations/en.departments.ts`، أضف:
```typescript
"departments.stats.newThisMonth": "New This Month",
```

- [ ] **Step 4: إصلاح Zod error messages**

عدّل `apps/dashboard/lib/schemas/department.schema.ts`:

```typescript
import { z } from "zod"

export const departmentSchema = z.object({
  nameAr: z.string().min(1, { message: "validation.required" }).max(255, { message: "validation.maxLength" }),
  nameEn: z.string().min(1, { message: "validation.required" }).max(255, { message: "validation.maxLength" }),
  descriptionAr: z.string().max(1000).optional().or(z.literal("")),
  descriptionEn: z.string().max(1000).optional().or(z.literal("")),
  icon: z.string().max(100).optional().or(z.literal("")),
  sortOrder: z.number().int().min(0),
  isActive: z.boolean(),
})

export type DepartmentFormData = z.infer<typeof departmentSchema>
```

أضف في كلا ملفي translations:

`ar.departments.ts`:
```typescript
"validation.required": "هذا الحقل مطلوب",
"validation.maxLength": "تجاوز الحد الأقصى للطول",
```

`en.departments.ts`:
```typescript
"validation.required": "This field is required",
"validation.maxLength": "Exceeds maximum length",
```

**ملاحظة:** إذا كانت `validation.*` keys موجودة بالفعل في ملف translations مشترك (common translations)، لا تضيفها مرة ثانية — تحقق أولاً.

- [ ] **Step 5: typecheck**

```bash
cd apps/dashboard && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 new errors

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/components/features/departments/edit-department-dialog.tsx \
        apps/dashboard/components/features/departments/department-list-page.tsx \
        apps/dashboard/lib/schemas/department.schema.ts \
        apps/dashboard/lib/translations/ar.departments.ts \
        apps/dashboard/lib/translations/en.departments.ts
git commit -m "fix(dashboard/departments): edit form reset, 4th stat card, Zod i18n errors"
```

---

## Task 11: تحقق نهائي شامل

- [ ] **Step 1: Backend — شغّل كل tests الـ departments**

```bash
cd apps/backend && npx jest src/modules/org-config/departments/ --no-coverage --verbose
```

Expected: جميع الـ tests PASS (10+ tests)

- [ ] **Step 2: Dashboard — typecheck + lint**

```bash
cd apps/dashboard && npx tsc --noEmit && npm run lint 2>&1 | tail -10
```

Expected: 0 errors

- [ ] **Step 3: تحقق من الباك-إند يعمل**

```bash
cd apps/backend && npm run build 2>&1 | tail -5
```

Expected: build ينجح

- [ ] **Step 4: Final commit message summary**

```bash
git log --oneline -8
```

تأكد أن الـ commits تغطي كل المهام الـ 10.

---

## ملخص التغييرات

| المجال | المشكلة | الإصلاح |
|--------|---------|---------|
| Backend Schema | حقول DTO بلا columns | أضف descriptionAr/En/icon للـ model + migration |
| Backend Schema | لا unique constraint | أضف @@unique([tenantId, nameAr]) |
| Backend List | search يُتجاهل | أضف search لـ DTO + where clause |
| Backend Update | TOCTOU race | استخدم updateMany بدل findFirst+update |
| Backend Delete | مفقود كلياً | DeleteDepartmentHandler + DELETE /departments/:id |
| Backend Permissions | لا @CheckPermissions | أضف للـ 4 endpoints |
| Frontend API | search لا يُرسل | أضف `search` لـ api.get call |
| Frontend API | deleteDepartment مفقود | أضفه |
| Frontend Hook | deleteMut مفقود | أضفه في useDepartmentMutations |
| Frontend Dialog | حذف وهمي | استدعِ deleteMut.mutateAsync فعلياً |
| Frontend Form | لا reset عند الإغلاق | أضف reset في useEffect |
| Frontend Stats | 3 cards بدل 4 | أضف "جديد هذا الشهر" |
| Frontend Zod | أخطاء بالإنجليزي | استخدم i18n keys |
