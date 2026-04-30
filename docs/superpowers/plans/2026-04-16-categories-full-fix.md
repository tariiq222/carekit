# Categories Page — Full Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `/categories` to full parity with the departments page (canonical pattern) — fix blocker bugs (403 on departments endpoint, unfillable sortOrder, broken create form, stale delete name), add StatsGrid + status filter + pagination, and translate Arabic-first UI correctly.

**Architecture:** Mirror the departments slice end-to-end. Backend: make `CaslGuard` use `CaslAbilityFactory` (so `user.role` drives abilities, not only the empty `user.permissions`), and add `Department` + `Category` to the `ADMIN` built-in permission set. Frontend: rewrite `useCategories` as a server-driven list hook (search/isActive/page/meta), split dialogs to use `Controller` for the number input, stop storing stale fields in local state.

**Tech Stack:** NestJS 11 + CASL (backend guard), Next.js 15 + React 19 + TanStack Query v5 + React Hook Form + Zod (dashboard), Jest (backend tests), Vitest (dashboard tests).

---

## Context — what's broken today

From live manual testing on `/categories` (admin JWT, 5 seeded categories):

| # | Bug | Evidence |
|---|-----|----------|
| 1 | `GET /dashboard/organization/departments` → 403 for ADMIN | Token has `role=ADMIN, permissions=[]`; `CaslGuard` only reads `user.permissions`, ignores role. ADMIN built-in set in `casl-ability.factory.ts` has no `Department`/`Category`. |
| 2 | Can't create a category | `departmentId` was required in UI schema; `SelectContent` empty (due to #1); backend DTO already has it optional, frontend over-constrained. |
| 3 | "Sort Order" spinbutton unusable | DOM reports `valuemax=0 valuemin=0`; `register("sortOrder")` with `type=number min={0}` + Zod `coerce.number().int().min(0).optional()` is flaky — no `valueAsNumber`, no Controller. |
| 4 | Delete dialog shows wrong name ("حذف نتاتنا؟" when deleting "تالتال") | `description` interpolated against `category?.nameEn` but dropdown closes/reopens re-using a stale row reference; also always shows `nameEn` regardless of locale. |
| 5 | Validation errors in English ("Required") on an Arabic UI | Zod messages hard-coded. |
| 6 | Breadcrumb shows slug "categories" not "الفئات" | `categories` missing from `routeLabels` in `breadcrumbs.tsx`. |
| 7 | Search is client-side only (fetch `limit=200` once) | Does not pass `search=` to backend. List doesn't paginate. |
| 8 | Create vs Edit dialogs have inconsistent required markers | Create marks name fields `*`, Edit doesn't. |
| 9 | Page-anatomy violations | No StatsGrid (4 cards), no status filter, no reset button outside the "has filters" branch, no pagination. |

Backend DTOs are already correct:
- `CreateCategoryDto`: `departmentId` is `@IsOptional()`
- `UpdateCategoryDto`: `departmentId` is optional + nullable
- `ListCategoriesDto` extends `PaginationDto` with `departmentId?`, `isActive?` — **but no `search` yet**

---

## File Structure

### Backend — `apps/backend/`

| File | Status | Responsibility |
|---|---|---|
| `src/common/guards/casl.guard.ts` | Modify | Inject `CaslAbilityFactory`; build ability from `user.role + customRole` instead of `user.permissions`. |
| `src/common/guards/casl.guard.spec.ts` | Modify | Update tests to use role-based stub; add ADMIN-bypass test. |
| `src/modules/identity/casl/casl-ability.factory.ts` | Modify | Extend `BUILT_IN.ADMIN` to include `Department` and `Category` (manage). |
| `src/modules/identity/casl/casl-ability.factory.spec.ts` | Modify | Add assertions for ADMIN can manage Department + Category. |
| `src/common/common.module.ts` (or wherever `CaslGuard` is provided) | Modify | Ensure `CaslAbilityFactory` is available where `CaslGuard` is. |
| `src/api/dashboard/organization-categories.controller.ts` | Modify | Add `@CheckPermissions` decorators for read/create/update (consistency with departments). |
| `src/modules/org-config/categories/list-categories.dto.ts` | Modify | Add `search?: string` filter. |
| `src/modules/org-config/categories/list-categories.handler.ts` | Modify | Apply `search` (OR over `nameAr`/`nameEn`, case-insensitive) + include `_count.services` in result items. |
| `src/modules/org-config/categories/list-categories.handler.spec.ts` | Modify/Create | Add spec for `search` + `_count.services`. |
| `src/modules/org-config/categories/delete-category.handler.ts` | **Create** | Backend never had a delete endpoint. Handler must block deletion if `_count.services > 0`. |
| `src/modules/org-config/categories/delete-category.handler.spec.ts` | **Create** | Two cases: has services → throws; empty → deletes. |
| `src/modules/org-config/categories/categories.module.ts` | Modify | Register `DeleteCategoryHandler`. |
| `src/api/dashboard/organization-categories.controller.ts` | Modify | Add `@Delete('categories/:categoryId')` endpoint. |

### Dashboard — `apps/dashboard/`

| File | Status | Responsibility |
|---|---|---|
| `components/features/breadcrumbs.tsx` | Modify | Add `categories: t("nav.categories")` to `routeLabels`. |
| `lib/translations/ar.common.ts` / `en.common.ts` | Modify | Add `nav.categories`, `common.required`, `common.actions`, `categories.stats.*`, `categories.filters.allStatuses`, `categories.status.*`, and reshape `services.categories.*` keys under `categories.*` (keep aliases if needed). |
| `lib/types/service.ts` | Modify | `departmentId: string \| null`; add `CategoryListMeta` + `CategoryListResponse`. |
| `lib/types/service-payloads.ts` | Modify | `CreateCategoryPayload.departmentId?: string`. |
| `lib/schemas/service.schema.ts` | Modify | `departmentId` optional (nullable); use i18n key sentinel strings (`"validation.required"`) instead of `"Required"`. |
| `lib/api/services.ts` | Modify | `fetchCategories(query)` returns `{items, meta}` and accepts `search/isActive/page/limit`; add `deleteCategory(id)`. |
| `hooks/use-services.ts` | Modify | Rewrite `useCategories` as server-driven (search/isActive/page/meta/reset); keep existing mutations; add `deleteMut`. |
| `components/features/services/category-list-page.tsx` | Rewrite | Match departments layout: Breadcrumbs → PageHeader → StatsGrid → FilterBar (search + status select + reset) → DataTable → Pagination → dialogs. |
| `components/features/services/category-columns.tsx` | Modify | Keep services count (it's real data per `_count.services`); switch to dropdown-with-tooltip trigger (matches departments). Use locale-aware name field. |
| `components/features/services/create-category-dialog.tsx` | Modify | `departmentId` optional; `sortOrder` via `Controller` with `valueAsNumber` + `min=0 max=999`; i18n error messages. |
| `components/features/services/edit-category-dialog.tsx` | Modify | Same fixes; add `*` markers only where required; `sortOrder` Controller; `departmentId` can be cleared (null). |
| `components/features/services/delete-category-dialog.tsx` | Modify | Read the currently-open `category` prop only (already does); show locale-correct name via `locale === "ar" ? nameAr : nameEn`. Freeze snapshot at mount via `useMemo` keyed by `category?.id` to survive re-renders during dropdown close. |

---

## Task 1: Backend — CaslGuard uses CaslAbilityFactory (role-aware)

**Why first:** Everything else on the categories page (department dropdown, pagination, etc.) needs the 403 gone.

**Files:**
- Modify: `apps/backend/src/common/guards/casl.guard.ts`
- Modify: `apps/backend/src/common/guards/casl.guard.spec.ts`
- Modify (if needed): `apps/backend/src/common/common.module.ts`

- [ ] **Step 1.1: Read the failing behavior**

Open `apps/backend/src/common/guards/casl.guard.ts` and confirm `buildAbilityFor` only iterates `user.permissions`. Open `apps/backend/src/modules/identity/casl/casl-ability.factory.ts` and confirm `CaslAbilityFactory.buildForUser({ role, customRole })` exists.

- [ ] **Step 1.2: Update the spec to express the desired behavior**

Replace `apps/backend/src/common/guards/casl.guard.spec.ts` with:

```ts
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslGuard, RequiredPermission } from './casl.guard';
import { CaslAbilityFactory } from '../../modules/identity/casl/casl-ability.factory';

const makeCtx = (
  user: object | undefined,
  required: RequiredPermission[],
) => {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(required);
  return {
    reflector,
    ctx: {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext,
  };
};

describe('CaslGuard (role-aware)', () => {
  const factory = new CaslAbilityFactory();

  it('returns true when no permissions required', () => {
    const { reflector, ctx } = makeCtx({ role: 'EMPLOYEE', customRole: null }, []);
    expect(new CaslGuard(reflector, factory).canActivate(ctx)).toBe(true);
  });

  it('grants SUPER_ADMIN access to anything', () => {
    const { reflector, ctx } = makeCtx(
      { role: 'SUPER_ADMIN', customRole: null },
      [{ action: 'delete', subject: 'Department' }],
    );
    expect(new CaslGuard(reflector, factory).canActivate(ctx)).toBe(true);
  });

  it('grants ADMIN access to Department (built-in)', () => {
    const { reflector, ctx } = makeCtx(
      { role: 'ADMIN', customRole: null },
      [{ action: 'read', subject: 'Department' }],
    );
    expect(new CaslGuard(reflector, factory).canActivate(ctx)).toBe(true);
  });

  it('grants ADMIN access to Category (built-in)', () => {
    const { reflector, ctx } = makeCtx(
      { role: 'ADMIN', customRole: null },
      [{ action: 'manage', subject: 'Category' }],
    );
    expect(new CaslGuard(reflector, factory).canActivate(ctx)).toBe(true);
  });

  it('rejects EMPLOYEE from managing Category', () => {
    const { reflector, ctx } = makeCtx(
      { role: 'EMPLOYEE', customRole: null },
      [{ action: 'delete', subject: 'Category' }],
    );
    expect(() => new CaslGuard(reflector, factory).canActivate(ctx))
      .toThrow(ForbiddenException);
  });

  it('uses customRole permissions when present', () => {
    const { reflector, ctx } = makeCtx(
      { role: 'CUSTOM', customRole: { permissions: [{ action: 'read', subject: 'Booking' }] } },
      [{ action: 'read', subject: 'Booking' }],
    );
    expect(new CaslGuard(reflector, factory).canActivate(ctx)).toBe(true);
  });

  it('throws when no user', () => {
    const { reflector, ctx } = makeCtx(undefined, [{ action: 'read', subject: 'X' }]);
    expect(() => new CaslGuard(reflector, factory).canActivate(ctx))
      .toThrow(ForbiddenException);
  });
});
```

- [ ] **Step 1.3: Run the spec — confirm it fails**

```bash
cd apps/backend && npx jest src/common/guards/casl.guard.spec.ts
```

Expected: at least 4 failures (the new role-based ones) because current guard ignores `user.role`.

- [ ] **Step 1.4: Rewrite the guard to use the factory**

Replace `apps/backend/src/common/guards/casl.guard.ts`:

```ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  CaslAbilityFactory,
  AppAbility,
} from '../../modules/identity/casl/casl-ability.factory';

export type Action = 'manage' | 'create' | 'read' | 'update' | 'delete';
export type Subject = string;

export interface RequiredPermission {
  action: Action;
  subject: Subject;
}

export const CHECK_PERMISSIONS_KEY = 'requiredPermissions';

export const CheckPermissions = (...permissions: RequiredPermission[]) =>
  SetMetadata(CHECK_PERMISSIONS_KEY, permissions);

export type { AppAbility };

type RequestUser = {
  role: string;
  customRole: { permissions: Array<{ action: string; subject: string }> } | null;
};

@Injectable()
export class CaslGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RequiredPermission[]>(
      CHECK_PERMISSIONS_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required || required.length === 0) return true;

    const { user } = ctx
      .switchToHttp()
      .getRequest<{ user?: RequestUser }>();
    if (!user) throw new ForbiddenException('No authenticated user');

    const ability = this.abilityFactory.buildForUser(user);
    const allowed = required.every((p) => ability.can(p.action, p.subject));
    if (!allowed) throw new ForbiddenException('Insufficient permissions');

    return true;
  }
}
```

- [ ] **Step 1.5: Ensure `CaslAbilityFactory` is provided where `CaslGuard` is used**

Search: `apps/backend/src` for `CaslGuard` providers. Open `apps/backend/src/common/common.module.ts` (or wherever `CaslGuard` is exported). If `CaslAbilityFactory` is not already in `providers`/`exports`, import from `../modules/identity/casl/casl-ability.factory` and add it to both `providers` and `exports`.

If identity module already exports it, import `IdentityModule` (or the specific casl sub-module) into `CommonModule` instead.

- [ ] **Step 1.6: Run the guard spec again — confirm green**

```bash
cd apps/backend && npx jest src/common/guards/casl.guard.spec.ts
```

Expected: PASS (all 7 tests).

- [ ] **Step 1.7: Run full backend unit tests to catch collateral damage**

```bash
cd apps/backend && npx jest
```

Expected: PASS. If any controller spec was stubbing `CaslGuard` via `useValue: { canActivate: () => true }` it continues to work.

- [ ] **Step 1.8: Commit**

```bash
git add apps/backend/src/common/guards/casl.guard.ts \
        apps/backend/src/common/guards/casl.guard.spec.ts \
        apps/backend/src/common/common.module.ts
git commit -m "fix(backend/auth): CaslGuard uses CaslAbilityFactory so role grants built-in permissions"
```

---

## Task 2: Backend — add Department + Category to ADMIN built-in permissions

**Files:**
- Modify: `apps/backend/src/modules/identity/casl/casl-ability.factory.ts`
- Modify: `apps/backend/src/modules/identity/casl/casl-ability.factory.spec.ts`

- [ ] **Step 2.1: Extend the spec first**

Open `apps/backend/src/modules/identity/casl/casl-ability.factory.spec.ts` and append:

```ts
it('grants ADMIN manage Department and Category', () => {
  const ability = factory.buildForUser({ role: 'ADMIN', customRole: null });
  expect(ability.can('manage', 'Department')).toBe(true);
  expect(ability.can('read', 'Department')).toBe(true);
  expect(ability.can('manage', 'Category')).toBe(true);
  expect(ability.can('create', 'Category')).toBe(true);
});

it('does not grant EMPLOYEE manage Department', () => {
  const ability = factory.buildForUser({ role: 'EMPLOYEE', customRole: null });
  expect(ability.can('manage', 'Department')).toBe(false);
});
```

(Ensure a `factory` instance exists at the top of the describe block; create one if needed: `const factory = new CaslAbilityFactory();`.)

- [ ] **Step 2.2: Run spec — it should fail on the ADMIN assertions**

```bash
cd apps/backend && npx jest src/modules/identity/casl/casl-ability.factory.spec.ts
```

Expected: FAIL on `manage Department` / `manage Category`.

- [ ] **Step 2.3: Extend `BUILT_IN.ADMIN`**

In `casl-ability.factory.ts`, update the `ADMIN` array:

```ts
ADMIN: [
  { action: 'manage', subject: 'User' },
  { action: 'manage', subject: 'Booking' },
  { action: 'manage', subject: 'Client' },
  { action: 'manage', subject: 'Employee' },
  { action: 'manage', subject: 'Invoice' },
  { action: 'manage', subject: 'Payment' },
  { action: 'manage', subject: 'Report' },
  { action: 'manage', subject: 'Setting' },
  { action: 'manage', subject: 'Department' },
  { action: 'manage', subject: 'Category' },
  { action: 'manage', subject: 'Service' },
  { action: 'manage', subject: 'Branch' },
],
```

(Added `Department`, `Category`, `Service`, `Branch` — admin is supposed to manage all org-config.)

- [ ] **Step 2.4: Run spec — green**

```bash
cd apps/backend && npx jest src/modules/identity/casl/casl-ability.factory.spec.ts
```

Expected: PASS.

- [ ] **Step 2.5: Commit**

```bash
git add apps/backend/src/modules/identity/casl/casl-ability.factory.ts \
        apps/backend/src/modules/identity/casl/casl-ability.factory.spec.ts
git commit -m "feat(backend/auth): ADMIN built-in manages Department, Category, Service, Branch"
```

---

## Task 3: Backend — add `@CheckPermissions` to categories controller

**Files:**
- Modify: `apps/backend/src/api/dashboard/organization-categories.controller.ts`

- [ ] **Step 3.1: Add decorators**

Replace the controller body (imports stay mostly the same; add `CheckPermissions`):

```ts
import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { CreateCategoryHandler } from '../../modules/org-config/categories/create-category.handler';
import { CreateCategoryDto } from '../../modules/org-config/categories/create-category.dto';
import { UpdateCategoryHandler } from '../../modules/org-config/categories/update-category.handler';
import { UpdateCategoryDto } from '../../modules/org-config/categories/update-category.dto';
import { ListCategoriesHandler } from '../../modules/org-config/categories/list-categories.handler';
import { ListCategoriesDto } from '../../modules/org-config/categories/list-categories.dto';
import { DeleteCategoryHandler } from '../../modules/org-config/categories/delete-category.handler';

@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/organization')
export class DashboardOrganizationCategoriesController {
  constructor(
    private readonly createCategory: CreateCategoryHandler,
    private readonly updateCategory: UpdateCategoryHandler,
    private readonly listCategories: ListCategoriesHandler,
    private readonly deleteCategory: DeleteCategoryHandler,
  ) {}

  @Post('categories')
  @CheckPermissions({ action: 'create', subject: 'Category' })
  createCategoryEndpoint(
    @TenantId() tenantId: string,
    @Body() body: CreateCategoryDto,
  ) {
    return this.createCategory.execute({ tenantId, ...body });
  }

  @Get('categories')
  @CheckPermissions({ action: 'read', subject: 'Category' })
  listCategoriesEndpoint(
    @TenantId() tenantId: string,
    @Query() query: ListCategoriesDto,
  ) {
    return this.listCategories.execute({ tenantId, ...query });
  }

  @Patch('categories/:categoryId')
  @CheckPermissions({ action: 'update', subject: 'Category' })
  updateCategoryEndpoint(
    @TenantId() tenantId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() body: UpdateCategoryDto,
  ) {
    return this.updateCategory.execute({ tenantId, categoryId, ...body });
  }

  @Delete('categories/:categoryId')
  @CheckPermissions({ action: 'delete', subject: 'Category' })
  deleteCategoryEndpoint(
    @TenantId() tenantId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.deleteCategory.execute({ tenantId, categoryId });
  }
}
```

(Delete endpoint + handler wired in Task 5.)

- [ ] **Step 3.2: Do not run the app yet** — `DeleteCategoryHandler` is added in Task 5 and the controller will fail to compile until then. Move to Task 4/5 before restarting the backend.

- [ ] **Step 3.3: Commit**

```bash
git add apps/backend/src/api/dashboard/organization-categories.controller.ts
git commit -m "feat(backend/categories): add @CheckPermissions + delete endpoint wiring"
```

(Build may be red at this point — the next tasks complete it.)

---

## Task 4: Backend — add `search` + `_count.services` to list-categories

**Files:**
- Modify: `apps/backend/src/modules/org-config/categories/list-categories.dto.ts`
- Modify: `apps/backend/src/modules/org-config/categories/list-categories.handler.ts`
- Modify/Create: `apps/backend/src/modules/org-config/categories/list-categories.handler.spec.ts`

- [ ] **Step 4.1: Extend DTO**

Replace `list-categories.dto.ts`:

```ts
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto';

export class ListCategoriesDto extends PaginationDto {
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsBoolean() @Type(() => Boolean) isActive?: boolean;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
}
```

- [ ] **Step 4.2: Write / extend the handler spec**

Open (or create) `list-categories.handler.spec.ts`. Add cases:

```ts
it('filters by search across nameAr and nameEn (case-insensitive)', async () => {
  const prisma = {
    $transaction: jest.fn().mockResolvedValue([[{ id: '1' }], 1]),
    serviceCategory: {
      findMany: jest.fn().mockResolvedValue([{ id: '1' }]),
      count: jest.fn().mockResolvedValue(1),
    },
  } as any;
  const handler = new ListCategoriesHandler(prisma);

  await handler.execute({ tenantId: 't1', search: 'dental' });

  const [findManyCall] = prisma.$transaction.mock.calls[0][0];
  expect(findManyCall).toEqual(expect.anything());
  // Inspect the actual call structure:
  expect(prisma.serviceCategory.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 't1',
        OR: [
          { nameAr: { contains: 'dental', mode: 'insensitive' } },
          { nameEn: { contains: 'dental', mode: 'insensitive' } },
        ],
      }),
    }),
  );
});

it('includes _count.services', async () => {
  const prisma = {
    $transaction: jest.fn().mockResolvedValue([[{ id: '1', _count: { services: 3 } }], 1]),
    serviceCategory: {
      findMany: jest.fn().mockResolvedValue([{ id: '1', _count: { services: 3 } }]),
      count: jest.fn().mockResolvedValue(1),
    },
  } as any;
  const handler = new ListCategoriesHandler(prisma);

  await handler.execute({ tenantId: 't1' });

  expect(prisma.serviceCategory.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      include: { _count: { select: { services: true } } },
    }),
  );
});
```

- [ ] **Step 4.3: Run spec — fails**

```bash
cd apps/backend && npx jest src/modules/org-config/categories/list-categories.handler.spec.ts
```

- [ ] **Step 4.4: Implement**

Replace `list-categories.handler.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { toListResponse } from '../../../common/dto';
import { ListCategoriesDto } from './list-categories.dto';

export type ListCategoriesQuery = ListCategoriesDto & { tenantId: string };

@Injectable()
export class ListCategoriesHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: ListCategoriesQuery) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      tenantId: dto.tenantId,
      ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.search && {
        OR: [
          { nameAr: { contains: dto.search, mode: 'insensitive' as const } },
          { nameEn: { contains: dto.search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.serviceCategory.findMany({
        where,
        skip,
        take: limit,
        include: { _count: { select: { services: true } } },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.serviceCategory.count({ where }),
    ]);

    return toListResponse(items, total, page, limit);
  }
}
```

- [ ] **Step 4.5: Run spec — green**

```bash
cd apps/backend && npx jest src/modules/org-config/categories/list-categories.handler.spec.ts
```

- [ ] **Step 4.6: Commit**

```bash
git add apps/backend/src/modules/org-config/categories/list-categories.{dto,handler,handler.spec}.ts
git commit -m "feat(backend/categories): add search filter + services count on list"
```

---

## Task 5: Backend — delete-category handler (blocks when services exist)

**Files:**
- Create: `apps/backend/src/modules/org-config/categories/delete-category.handler.ts`
- Create: `apps/backend/src/modules/org-config/categories/delete-category.handler.spec.ts`
- Modify: `apps/backend/src/modules/org-config/categories/categories.module.ts` (find real path first)

- [ ] **Step 5.1: Find the categories module file**

```bash
find apps/backend/src/modules/org-config/categories -name "*.module.ts"
```

Note the real path for Step 5.4.

- [ ] **Step 5.2: Create the spec**

Create `delete-category.handler.spec.ts`:

```ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DeleteCategoryHandler } from './delete-category.handler';

describe('DeleteCategoryHandler', () => {
  function build(prisma: unknown) {
    return new DeleteCategoryHandler(prisma as never);
  }

  it('throws NotFound when category does not belong to tenant', async () => {
    const prisma = {
      serviceCategory: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    await expect(
      build(prisma).execute({ tenantId: 't1', categoryId: 'c1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequest when category still has services', async () => {
    const prisma = {
      serviceCategory: {
        findFirst: jest.fn().mockResolvedValue({ id: 'c1', _count: { services: 2 } }),
      },
    };
    await expect(
      build(prisma).execute({ tenantId: 't1', categoryId: 'c1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('deletes when empty', async () => {
    const prisma = {
      serviceCategory: {
        findFirst: jest.fn().mockResolvedValue({ id: 'c1', _count: { services: 0 } }),
        delete: jest.fn().mockResolvedValue({ id: 'c1' }),
      },
    };
    const result = await build(prisma).execute({ tenantId: 't1', categoryId: 'c1' });
    expect(result).toEqual({ id: 'c1' });
    expect(prisma.serviceCategory.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
  });
});
```

- [ ] **Step 5.3: Run spec — fails (no handler)**

```bash
cd apps/backend && npx jest src/modules/org-config/categories/delete-category.handler.spec.ts
```

- [ ] **Step 5.4: Implement the handler**

Create `delete-category.handler.ts`:

```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface DeleteCategoryCommand {
  tenantId: string;
  categoryId: string;
}

@Injectable()
export class DeleteCategoryHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ tenantId, categoryId }: DeleteCategoryCommand) {
    const existing = await this.prisma.serviceCategory.findFirst({
      where: { id: categoryId, tenantId },
      include: { _count: { select: { services: true } } },
    });
    if (!existing) throw new NotFoundException('Category not found');
    if (existing._count.services > 0) {
      throw new BadRequestException('Category still has services; reassign or delete them first');
    }
    return this.prisma.serviceCategory.delete({ where: { id: categoryId } });
  }
}
```

- [ ] **Step 5.5: Register handler in module**

Open the module file from Step 5.1 (likely `apps/backend/src/modules/org-config/categories/categories.module.ts`). Add `DeleteCategoryHandler` to both `providers` and `exports`.

- [ ] **Step 5.6: Run the spec — green**

```bash
cd apps/backend && npx jest src/modules/org-config/categories/delete-category.handler.spec.ts
```

- [ ] **Step 5.7: Run full backend test suite**

```bash
cd apps/backend && npx jest
```

Expected: PASS.

- [ ] **Step 5.8: Start backend and sanity-check the 403 is gone**

```bash
cd apps/backend && npm run dev
```

Then in another shell:
```bash
TOKEN=$(curl -s -X POST http://localhost:5100/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@deqah-test.com","password":"Admin@1234"}' | jq -r .accessToken)

curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5100/api/v1/dashboard/organization/departments?page=1&limit=5"
```

Expected: `200`.

- [ ] **Step 5.9: Commit**

```bash
git add apps/backend/src/modules/org-config/categories/delete-category.handler.ts \
        apps/backend/src/modules/org-config/categories/delete-category.handler.spec.ts \
        apps/backend/src/modules/org-config/categories/categories.module.ts \
        apps/backend/src/api/dashboard/organization-categories.controller.ts
git commit -m "feat(backend/categories): delete endpoint + handler (blocks when services exist)"
```

---

## Task 6: Dashboard — i18n + breadcrumb label for `categories`

**Files:**
- Modify: `apps/dashboard/components/features/breadcrumbs.tsx`
- Modify: `apps/dashboard/lib/translations/ar.common.ts` (or wherever `nav.*` lives — confirm with `grep "nav.dashboard" apps/dashboard/lib/translations`)
- Modify: `apps/dashboard/lib/translations/en.common.ts`
- Modify: `apps/dashboard/lib/translations/ar.services.ts`
- Modify: `apps/dashboard/lib/translations/en.services.ts`

- [ ] **Step 6.1: Locate where `nav.*` lives**

```bash
grep -rn "\"nav.dashboard\"" apps/dashboard/lib/translations | head
```

Use that file for the next edits.

- [ ] **Step 6.2: Add `nav.categories` + `common.required` + `common.actions` to both AR and EN `.common` translation files**

AR (append in the nav section):
```ts
"nav.categories": "الفئات",
"common.required": "هذا الحقل مطلوب",
"common.actions": "إجراءات",
```

EN:
```ts
"nav.categories": "Categories",
"common.required": "Required",
"common.actions": "Actions",
```

- [ ] **Step 6.3: Add `categories` to breadcrumbs routeLabels**

In `apps/dashboard/components/features/breadcrumbs.tsx`, inside `generateBreadcrumbs`, extend `routeLabels`:

```ts
  categories: t("nav.categories"),
```

- [ ] **Step 6.4: Add stats + filter labels to AR services translations**

Append to `apps/dashboard/lib/translations/ar.services.ts` (end of the categories block around line 146):

```ts
"services.categories.stats.total": "الإجمالي",
"services.categories.stats.active": "نشطة",
"services.categories.stats.inactive": "غير نشطة",
"services.categories.stats.newThisMonth": "جديدة هذا الشهر",
"services.categories.filters.allStatuses": "كل الحالات",
"services.categories.status.active": "نشطة",
"services.categories.status.inactive": "غير نشطة",
"services.categories.action.edit": "تعديل",
"services.categories.action.delete": "حذف",
"services.categories.empty.searchTitle": "لا توجد نتائج",
"services.categories.empty.searchDescription": "جرّب تعديل البحث أو إعادة ضبط الفلاتر.",
```

- [ ] **Step 6.5: Mirror in EN translations**

Append to `apps/dashboard/lib/translations/en.services.ts`:

```ts
"services.categories.stats.total": "Total",
"services.categories.stats.active": "Active",
"services.categories.stats.inactive": "Inactive",
"services.categories.stats.newThisMonth": "New this month",
"services.categories.filters.allStatuses": "All statuses",
"services.categories.status.active": "Active",
"services.categories.status.inactive": "Inactive",
"services.categories.action.edit": "Edit",
"services.categories.action.delete": "Delete",
"services.categories.empty.searchTitle": "No results",
"services.categories.empty.searchDescription": "Try adjusting the search or resetting filters.",
```

- [ ] **Step 6.6: Typecheck**

```bash
cd apps/dashboard && npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 6.7: Commit**

```bash
git add apps/dashboard/components/features/breadcrumbs.tsx \
        apps/dashboard/lib/translations/ar.common.ts \
        apps/dashboard/lib/translations/en.common.ts \
        apps/dashboard/lib/translations/ar.services.ts \
        apps/dashboard/lib/translations/en.services.ts
git commit -m "feat(dashboard/i18n): translate breadcrumb + add categories stats/filter strings"
```

---

## Task 7: Dashboard — types + schemas (departmentId optional, null-safe)

**Files:**
- Modify: `apps/dashboard/lib/types/service.ts`
- Modify: `apps/dashboard/lib/types/service-payloads.ts`
- Modify: `apps/dashboard/lib/schemas/service.schema.ts`

- [ ] **Step 7.1: Update `ServiceCategory` type**

In `apps/dashboard/lib/types/service.ts`, change:

```ts
export interface ServiceCategory {
  id: string
  nameEn: string | null
  nameAr: string
  sortOrder: number
  isActive: boolean
  departmentId: string | null
  department?: { id: string; nameEn: string | null; nameAr: string } | null
  createdAt: string
  _count?: { services: number }
}
```

Add below it:

```ts
export interface CategoryListQuery extends PaginatedQuery {
  search?: string
  isActive?: boolean
  departmentId?: string
}
```

- [ ] **Step 7.2: Update payloads**

In `apps/dashboard/lib/types/service-payloads.ts`, find `CreateCategoryPayload` / `UpdateCategoryPayload`. Change `departmentId` to:

```ts
departmentId?: string | null
nameEn?: string          // already optional in backend
```

- [ ] **Step 7.3: Update Zod schemas**

Replace `apps/dashboard/lib/schemas/service.schema.ts`:

```ts
import { z } from "zod"

const REQUIRED = "validation.required"

export const createCategorySchema = z.object({
  nameAr: z.string().trim().min(1, REQUIRED).max(200),
  nameEn: z.string().trim().max(200).optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
  departmentId: z.union([z.string().uuid(), z.literal("")]).optional().transform((v) => (v ? v : undefined)),
})

export type CreateCategoryFormData = z.infer<typeof createCategorySchema>

export const editCategorySchema = z.object({
  nameAr: z.string().trim().min(1, REQUIRED).max(200).optional(),
  nameEn: z.string().trim().max(200).optional(),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
  departmentId: z.union([z.string().uuid(), z.literal(""), z.null()]).optional(),
})

export type EditCategoryFormData = z.infer<typeof editCategorySchema>
```

- [ ] **Step 7.4: Typecheck**

```bash
cd apps/dashboard && npm run typecheck
```

Fix any resulting cascade errors in `lib/api/services.ts` or column files by aligning the types.

- [ ] **Step 7.5: Commit**

```bash
git add apps/dashboard/lib/types/service.ts \
        apps/dashboard/lib/types/service-payloads.ts \
        apps/dashboard/lib/schemas/service.schema.ts
git commit -m "feat(dashboard/categories): types/schemas — departmentId optional, nameEn optional, sortOrder bounded"
```

---

## Task 8: Dashboard — API client (`fetchCategories(query)` + `deleteCategory`)

**Files:**
- Modify: `apps/dashboard/lib/api/services.ts`

- [ ] **Step 8.1: Rewrite the categories slice of the API**

In `apps/dashboard/lib/api/services.ts`, replace the Categories section (lines ~50–78):

```ts
/* ─── Categories ─── */

export async function fetchCategories(
  query: CategoryListQuery = {},
): Promise<PaginatedResponse<ServiceCategory>> {
  return api.get<PaginatedResponse<ServiceCategory>>("/dashboard/organization/categories", {
    page: query.page,
    limit: query.perPage,
    search: query.search,
    isActive: query.isActive,
    departmentId: query.departmentId,
  })
}

export async function createCategory(
  payload: CreateCategoryPayload,
): Promise<ServiceCategory> {
  return api.post<ServiceCategory>(
    "/dashboard/organization/categories",
    payload,
  )
}

export async function updateCategory(
  id: string,
  payload: UpdateCategoryPayload,
): Promise<ServiceCategory> {
  return api.patch<ServiceCategory>(
    `/dashboard/organization/categories/${id}`,
    payload,
  )
}

export async function deleteCategory(id: string): Promise<void> {
  await api.delete(`/dashboard/organization/categories/${id}`)
}
```

Update the imports at the top of the file to include `CategoryListQuery` from `@/lib/types/service`.

- [ ] **Step 8.2: Typecheck**

```bash
cd apps/dashboard && npm run typecheck
```

- [ ] **Step 8.3: Commit**

```bash
git add apps/dashboard/lib/api/services.ts
git commit -m "feat(dashboard/categories): fetchCategories(query) returns paginated response"
```

---

## Task 9: Dashboard — rewrite `useCategories` (server-driven) + export `useCategoryMutations` with `deleteMut`

**Files:**
- Modify: `apps/dashboard/hooks/use-services.ts`
- Modify (if needed): `apps/dashboard/lib/query-keys.ts`

- [ ] **Step 9.1: Update `queryKeys.services.categories`**

Open `apps/dashboard/lib/query-keys.ts`. If `categories()` takes no args, change to:

```ts
categories: (query?: CategoryListQuery) =>
  [...queryKeys.services.all, "categories", query ?? {}] as const,
```

Import `CategoryListQuery` at the top.

- [ ] **Step 9.2: Replace `useCategories` in `apps/dashboard/hooks/use-services.ts`**

Replace the `/* ─── Categories ─── */` section (around lines 101–109):

```ts
export function useCategories() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [isActive, setIsActive] = useState<boolean | undefined>()

  const query: CategoryListQuery = {
    page,
    perPage: 20,
    search: search || undefined,
    isActive,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.services.categories(query),
    queryFn: () => fetchCategories(query),
    staleTime: 5 * 60 * 1000,
  })

  const resetFilters = useCallback(() => {
    setSearch("")
    setIsActive(undefined)
    setPage(1)
  }, [])

  return {
    categories: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error instanceof Error ? error.message : null,
    page,
    setPage,
    search,
    setSearch: (s: string) => { setSearch(s); setPage(1) },
    isActive,
    setIsActive: (v: boolean | undefined) => { setIsActive(v); setPage(1) },
    resetFilters,
    refetch,
  }
}
```

Add `import type { CategoryListQuery } from "@/lib/types/service"` at the top.

- [ ] **Step 9.3: Confirm `useCategoryMutations` already exposes `deleteMut`**

It does (current file lines 139–161). Leave unchanged — but since `fetchCategories` now returns paginated data, verify `invalidate` still works: queryKey prefix `queryKeys.services.categories()` must match all variations.

If `categories()` now requires an argument, change `invalidate` to:

```ts
const invalidate = () =>
  queryClient.invalidateQueries({ queryKey: [...queryKeys.services.all, "categories"] })
```

- [ ] **Step 9.4: Typecheck**

```bash
cd apps/dashboard && npm run typecheck
```

- [ ] **Step 9.5: Commit**

```bash
git add apps/dashboard/hooks/use-services.ts apps/dashboard/lib/query-keys.ts
git commit -m "feat(dashboard/categories): useCategories server-driven (search/isActive/pagination/meta)"
```

---

## Task 10: Dashboard — rewrite `CategoryListPage` to match departments

**Files:**
- Rewrite: `apps/dashboard/components/features/services/category-list-page.tsx`

- [ ] **Step 10.1: Replace file contents**

```tsx
"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Tag01Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  CalendarAdd02Icon,
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

import { getCategoryColumns } from "./category-columns"
import { CreateCategoryDialog } from "./create-category-dialog"
import { EditCategoryDialog } from "./edit-category-dialog"
import { DeleteCategoryDialog } from "./delete-category-dialog"

import { useCategories } from "@/hooks/use-services"
import { useLocale } from "@/components/locale-provider"
import type { ServiceCategory } from "@/lib/types/service"

export function CategoryListPage() {
  const { t, locale } = useLocale()
  const {
    categories, meta, isLoading, error,
    search, setSearch, isActive, setIsActive,
    page, setPage, resetFilters, refetch,
  } = useCategories()

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ServiceCategory | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ServiceCategory | null>(null)

  const activeCount = categories.filter((c) => c.isActive).length
  const inactiveCount = categories.filter((c) => !c.isActive).length
  const now = new Date()
  const newThisMonth = categories.filter((c) => {
    const created = new Date(c.createdAt)
    return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth()
  }).length

  const columns = getCategoryColumns(
    locale,
    t,
    (c) => setEditTarget(c),
    (c) => setDeleteTarget(c),
  )

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={t("services.categories.title")}
        description={t("services.categories.description")}
      >
        <Button className="gap-2 rounded-full px-5" onClick={() => setCreateOpen(true)}>
          <HugeiconsIcon icon={Add01Icon} size={16} />
          {t("services.categories.addCategory")}
        </Button>
      </PageHeader>

      {isLoading && !meta ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : (
        <StatsGrid className="sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title={t("services.categories.stats.total")} value={meta?.total ?? 0} icon={Tag01Icon} iconColor="primary" />
          <StatCard title={t("services.categories.stats.active")} value={activeCount} icon={CheckmarkCircle02Icon} iconColor="success" />
          <StatCard title={t("services.categories.stats.inactive")} value={inactiveCount} icon={Cancel01Icon} iconColor="warning" />
          <StatCard title={t("services.categories.stats.newThisMonth")} value={newThisMonth} icon={CalendarAdd02Icon} iconColor="accent" />
        </StatsGrid>
      )}

      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: t("services.categories.searchPlaceholder") }}
        selects={[
          {
            key: "status",
            value: isActive === undefined ? "all" : isActive ? "active" : "inactive",
            placeholder: t("services.categories.filters.allStatuses"),
            options: [
              { value: "all", label: t("services.categories.filters.allStatuses") },
              { value: "active", label: t("services.categories.status.active") },
              { value: "inactive", label: t("services.categories.status.inactive") },
            ],
            onValueChange: (v) => setIsActive(v === "all" ? undefined : v === "active"),
          },
        ]}
        hasFilters={search.length > 0 || isActive !== undefined}
        onReset={resetFilters}
        resultCount={meta && !isLoading ? `${meta.total} ${t("services.categories.stats.total")}` : undefined}
      />

      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}

      {isLoading && categories.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={categories}
          emptyTitle={
            search || isActive !== undefined
              ? t("services.categories.empty.searchTitle")
              : t("services.categories.empty.title")
          }
          emptyDescription={
            search || isActive !== undefined
              ? t("services.categories.empty.searchDescription")
              : t("services.categories.empty.description")
          }
          emptyAction={
            search || isActive !== undefined
              ? undefined
              : { label: t("services.categories.addCategory"), onClick: () => setCreateOpen(true) }
          }
        />
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground tabular-nums">{page} / {meta.totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("table.previous")}</Button>
            <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>{t("table.next")}</Button>
          </div>
        </div>
      )}

      <CreateCategoryDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditCategoryDialog category={editTarget} open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null) }} />
      <DeleteCategoryDialog category={deleteTarget} open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }} />
    </ListPageShell>
  )
}
```

- [ ] **Step 10.2: Typecheck**

```bash
cd apps/dashboard && npm run typecheck
```

- [ ] **Step 10.3: Commit**

```bash
git add apps/dashboard/components/features/services/category-list-page.tsx
git commit -m "feat(dashboard/categories): rewrite list page — StatsGrid + status filter + pagination"
```

---

## Task 11: Dashboard — columns (locale-aware, dropdown-with-tooltip actions)

**Files:**
- Rewrite: `apps/dashboard/components/features/services/category-columns.tsx`

- [ ] **Step 11.1: Replace file**

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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ServiceCategory } from "@/lib/types/service"

type TFn = (key: string) => string

export function getCategoryColumns(
  locale: "en" | "ar" = "en",
  t: TFn,
  onEdit?: (c: ServiceCategory) => void,
  onDelete?: (c: ServiceCategory) => void,
): ColumnDef<ServiceCategory>[] {
  const label = (key: string, fallback: string) => t?.(key) ?? fallback

  return [
    {
      id: "name",
      header: label("services.categories.col.name", "Category"),
      enableSorting: false,
      cell: ({ row }) => {
        const c = row.original
        const primary = locale === "ar" ? c.nameAr : (c.nameEn ?? c.nameAr)
        const secondary = locale === "ar" ? c.nameEn : c.nameAr
        return (
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{primary}</span>
            {secondary && primary !== secondary && (
              <span className="text-xs text-muted-foreground">{secondary}</span>
            )}
          </div>
        )
      },
    },
    {
      id: "services",
      header: label("services.categories.col.services", "Services"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {row.original._count?.services ?? 0}
        </span>
      ),
    },
    {
      accessorKey: "sortOrder",
      header: label("services.categories.col.order", "Sort Order"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">{row.original.sortOrder}</span>
      ),
    },
    {
      id: "status",
      header: label("services.categories.col.status", "Status"),
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
            ? label("services.categories.status.active", "Active")
            : label("services.categories.status.inactive", "Inactive")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const c = row.original
        return (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
                    <span className="sr-only">{label("common.actions", "Actions")}</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="top">{label("common.actions", "Actions")}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="glass-solid">
              <DropdownMenuItem onClick={() => onEdit?.(c)}>
                <HugeiconsIcon icon={PencilEdit01Icon} size={14} />
                {label("services.categories.action.edit", "Edit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete?.(c)}
                className="text-destructive focus:text-destructive"
              >
                <HugeiconsIcon icon={Delete02Icon} size={14} />
                {label("services.categories.action.delete", "Delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]
}
```

Note the signature change: `(locale, t, onEdit, onDelete)` matches departments.

- [ ] **Step 11.2: Typecheck**

```bash
cd apps/dashboard && npm run typecheck
```

- [ ] **Step 11.3: Commit**

```bash
git add apps/dashboard/components/features/services/category-columns.tsx
git commit -m "feat(dashboard/categories): locale-aware columns + dropdown-with-tooltip actions"
```

---

## Task 12: Dashboard — Create dialog (departmentId optional, Controller-based sortOrder, i18n errors)

**Files:**
- Rewrite: `apps/dashboard/components/features/services/create-category-dialog.tsx`

- [ ] **Step 12.1: Replace file**

```tsx
"use client"

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCategoryMutations } from "@/hooks/use-services"
import { useDepartmentOptions } from "@/hooks/use-departments"
import { useLocale } from "@/components/locale-provider"
import {
  createCategorySchema,
  type CreateCategoryFormData,
} from "@/lib/schemas/service.schema"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const NO_DEPT = "__none"

export function CreateCategoryDialog({ open, onOpenChange }: Props) {
  const { t, locale } = useLocale()
  const { createMut } = useCategoryMutations()
  const { options: departments } = useDepartmentOptions()

  const form = useForm<CreateCategoryFormData>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: { nameAr: "", nameEn: "", sortOrder: 0, departmentId: undefined },
  })

  const translateError = (msg?: string) => (msg ? t(msg) : undefined)

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await createMut.mutateAsync({
        nameAr: data.nameAr,
        nameEn: data.nameEn || undefined,
        sortOrder: data.sortOrder,
        departmentId: data.departmentId || undefined,
      })
      toast.success(t("services.categories.create.success"))
      form.reset()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("services.categories.create.error"))
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("services.categories.create.title")}</DialogTitle>
          <DialogDescription>{t("services.categories.create.description")}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="create-category-form" onSubmit={onSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.categories.create.nameAr")} *</Label>
                <Input {...form.register("nameAr")} dir="rtl" />
                {form.formState.errors.nameAr && (
                  <p className="text-xs text-destructive">
                    {translateError(form.formState.errors.nameAr.message)}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.categories.create.nameEn")}</Label>
                <Input {...form.register("nameEn")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.categories.create.department")}</Label>
                <Controller
                  control={form.control}
                  name="departmentId"
                  render={({ field }) => (
                    <Select
                      value={field.value || NO_DEPT}
                      onValueChange={(v) => field.onChange(v === NO_DEPT ? undefined : v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("services.categories.create.departmentPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_DEPT}>
                          {t("services.categories.create.departmentPlaceholder")}
                        </SelectItem>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {locale === "ar" ? d.nameAr : d.nameEn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.categories.create.sortOrder")}</Label>
                <Controller
                  control={form.control}
                  name="sortOrder"
                  render={({ field }) => (
                    <Input
                      type="number"
                      min={0}
                      max={999}
                      value={field.value ?? 0}
                      onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                    />
                  )}
                />
              </div>
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("services.categories.create.cancel")}
          </Button>
          <Button type="submit" form="create-category-form" disabled={createMut.isPending}>
            {createMut.isPending
              ? t("services.categories.create.submitting")
              : t("services.categories.create.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 12.2: Filter departments to active-only**

`useDepartmentOptions` already requests `isActive: true` in `apps/dashboard/hooks/use-departments.ts:62`. No change needed.

- [ ] **Step 12.3: Typecheck**

```bash
cd apps/dashboard && npm run typecheck
```

- [ ] **Step 12.4: Commit**

```bash
git add apps/dashboard/components/features/services/create-category-dialog.tsx
git commit -m "fix(dashboard/categories): create dialog — optional department, Controller sortOrder, i18n errors"
```

---

## Task 13: Dashboard — Edit dialog (same fixes + consistent required markers)

**Files:**
- Rewrite: `apps/dashboard/components/features/services/edit-category-dialog.tsx`

- [ ] **Step 13.1: Replace file**

```tsx
"use client"

import { useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCategoryMutations } from "@/hooks/use-services"
import { useDepartmentOptions } from "@/hooks/use-departments"
import { useLocale } from "@/components/locale-provider"
import type { ServiceCategory } from "@/lib/types/service"
import {
  editCategorySchema,
  type EditCategoryFormData,
} from "@/lib/schemas/service.schema"

interface Props {
  category: ServiceCategory | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const NO_DEPT = "__none"

export function EditCategoryDialog({ category, open, onOpenChange }: Props) {
  const { t, locale } = useLocale()
  const { updateMut } = useCategoryMutations()
  const { options: departments } = useDepartmentOptions()

  const form = useForm<EditCategoryFormData>({
    resolver: zodResolver(editCategorySchema),
  })

  useEffect(() => {
    if (category) {
      form.reset({
        nameAr: category.nameAr,
        nameEn: category.nameEn ?? "",
        sortOrder: category.sortOrder,
        isActive: category.isActive,
        departmentId: category.departmentId ?? undefined,
      })
    }
  }, [category, form])

  const translateError = (msg?: string) => (msg ? t(msg) : undefined)

  const onSubmit = form.handleSubmit(async (data) => {
    if (!category) return
    try {
      await updateMut.mutateAsync({
        id: category.id,
        nameAr: data.nameAr,
        nameEn: data.nameEn || undefined,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
        departmentId: data.departmentId ? data.departmentId : null,
      })
      toast.success(t("services.categories.edit.success"))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("services.categories.edit.error"))
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("services.categories.edit.title")}</DialogTitle>
          <DialogDescription>{t("services.categories.edit.description")}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="edit-category-form" onSubmit={onSubmit} className="flex flex-col gap-5">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="edit-cat-active" className="cursor-pointer">
                {t("services.categories.edit.isActive")}
              </Label>
              <Switch
                id="edit-cat-active"
                checked={!!form.watch("isActive")}
                onCheckedChange={(v) => form.setValue("isActive", v)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.categories.create.nameAr")} *</Label>
                <Input {...form.register("nameAr")} dir="rtl" />
                {form.formState.errors.nameAr && (
                  <p className="text-xs text-destructive">
                    {translateError(form.formState.errors.nameAr.message)}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.categories.create.nameEn")}</Label>
                <Input {...form.register("nameEn")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.categories.edit.department")}</Label>
                <Controller
                  control={form.control}
                  name="departmentId"
                  render={({ field }) => (
                    <Select
                      value={(field.value as string | undefined) || NO_DEPT}
                      onValueChange={(v) => field.onChange(v === NO_DEPT ? undefined : v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("services.categories.edit.departmentPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_DEPT}>
                          {t("services.categories.edit.departmentPlaceholder")}
                        </SelectItem>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {locale === "ar" ? d.nameAr : d.nameEn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.categories.create.sortOrder")}</Label>
                <Controller
                  control={form.control}
                  name="sortOrder"
                  render={({ field }) => (
                    <Input
                      type="number"
                      min={0}
                      max={999}
                      value={field.value ?? 0}
                      onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                    />
                  )}
                />
              </div>
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("services.categories.edit.cancel")}
          </Button>
          <Button type="submit" form="edit-category-form" disabled={updateMut.isPending}>
            {updateMut.isPending
              ? t("services.categories.edit.submitting")
              : t("services.categories.edit.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 13.2: Typecheck**

```bash
cd apps/dashboard && npm run typecheck
```

- [ ] **Step 13.3: Commit**

```bash
git add apps/dashboard/components/features/services/edit-category-dialog.tsx
git commit -m "fix(dashboard/categories): edit dialog — optional department, Controller sortOrder, required markers"
```

---

## Task 14: Dashboard — Delete dialog (locale-correct, stale-name fix)

**Files:**
- Rewrite: `apps/dashboard/components/features/services/delete-category-dialog.tsx`

- [ ] **Step 14.1: Replace file**

```tsx
"use client"

import { useMemo } from "react"
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
import { useCategoryMutations } from "@/hooks/use-services"
import { useLocale } from "@/components/locale-provider"
import type { ServiceCategory } from "@/lib/types/service"

interface Props {
  category: ServiceCategory | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteCategoryDialog({ category, open, onOpenChange }: Props) {
  const { t, locale } = useLocale()
  const { deleteMut } = useCategoryMutations()

  // Freeze the display name at the moment the dialog opens so re-renders
  // during dropdown teardown do not swap in another row's data.
  const displayName = useMemo(() => {
    if (!category) return ""
    return locale === "ar" ? category.nameAr : (category.nameEn ?? category.nameAr)
  }, [category, locale])

  const handleDelete = async () => {
    if (!category) return
    try {
      await deleteMut.mutateAsync(category.id)
      toast.success(t("services.categories.delete.success"))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("services.categories.delete.error"))
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("services.categories.delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("services.categories.delete.description").replace("{name}", displayName)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMut.isPending}>
            {t("services.categories.delete.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMut.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMut.isPending
              ? t("services.categories.delete.submitting")
              : t("services.categories.delete.submit")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **Step 14.2: Typecheck**

```bash
cd apps/dashboard && npm run typecheck
```

- [ ] **Step 14.3: Commit**

```bash
git add apps/dashboard/components/features/services/delete-category-dialog.tsx
git commit -m "fix(dashboard/categories): delete dialog — locale-aware name frozen at open"
```

---

## Task 15: Manual end-to-end verification in the browser

This replaces automated Playwright coverage — the scope is UI fidelity, not test coverage.

- [ ] **Step 15.1: Make sure both servers are running**

```bash
cd apps/backend && npm run dev    # background tab 1
cd apps/dashboard && npm run dev  # background tab 2
```

- [ ] **Step 15.2: Login and open categories**

Navigate: `http://localhost:5103/categories`.

Confirm:
- Breadcrumb reads "الرئيسية ‹ الفئات" (NOT "categories")
- StatsGrid renders 4 cards
- FilterBar has search + status select + reset button (only highlighted when filters active)
- DevTools Network tab: `GET /api/v1/dashboard/organization/departments` → **200**, not 403

- [ ] **Step 15.3: Search behavior**

Type "PW" in the search — wait 300ms. Confirm new `GET /categories?search=PW` request fires. Click reset — state clears.

- [ ] **Step 15.4: Status filter**

Select "غير نشطة" → expect `isActive=false` on the query and only inactive categories in the table (or empty state if none).

- [ ] **Step 15.5: Create flow**

Click "إضافة فئة":
- Leave all fields blank → submit → expect Arabic error "هذا الحقل مطلوب" under `nameAr` (not "Required")
- Fill `nameAr = "فئة تجريبية 1"`, leave department unchanged (defaults to "بدون قسم"), set `sortOrder = 5` (confirm typing works — this was broken before)
- Submit → toast success; row appears in table

- [ ] **Step 15.6: Create with department**

Create another: `nameAr = "فئة تجريبية 2"`, select a real active department. Submit → success; table reflects it.

- [ ] **Step 15.7: Edit flow**

Click ... → تعديل on "فئة تجريبية 1":
- Dialog opens pre-filled with correct values
- Toggle `isActive` off, change sortOrder to 7, pick a different department
- Save → toast success; stats update (active count -1, inactive +1)

- [ ] **Step 15.8: Delete — wrong-name bug**

Click ... → حذف on "فئة تجريبية 2":
- Confirm dialog says: `هل أنت متأكد من حذف فئة تجريبية 2؟` (exactly the right name)
- Click إلغاء — nothing happens
- Click ... → حذف on the other row — name in dialog must now match the NEW row

- [ ] **Step 15.9: Delete — blocked by existing services**

Pick a seeded category that has services (create a quick service against it if none exist) — delete → expect 400 with the backend message toasted.

- [ ] **Step 15.10: Delete — happy path**

Delete "فئة تجريبية 1" (no services) → success; row removed; stats update.

- [ ] **Step 15.11: Dark mode + RTL smoke**

Toggle dark mode button: no contrast regressions. The entire page remains RTL; icons/spacing flip correctly.

- [ ] **Step 15.12: Typecheck + lint + test across workspace**

```bash
cd apps/backend && npm run test && cd ../dashboard && npm run typecheck && npm run lint
```

Expected: green across the board.

- [ ] **Step 15.13: Final commit of anything leftover (docs, screenshots)**

If any minor tweaks came out of manual QA, batch them into a single commit:

```bash
git add -A
git commit -m "chore(dashboard/categories): manual-QA polish"
```

---

## Self-Review — Spec coverage

| Reported bug | Covered in |
|---|---|
| #1 403 on departments | Tasks 1 + 2 (+ verified in 5.8, 15.2) |
| #2 Can't create category | Tasks 7, 8, 12 |
| #3 Sort Order unusable | Tasks 12, 13 (`Controller` + `valueAsNumber`), verified 15.5 |
| #4 Wrong delete name | Task 14 (`useMemo` freeze), verified 15.8 |
| #5 English "Required" on AR UI | Tasks 6 (i18n key) + 7 (schema message) + 12/13 (translate on render) |
| #6 Breadcrumb slug | Task 6 |
| #7 Server-side search | Tasks 4, 8, 9, 10 |
| #8 Inconsistent required markers | Tasks 12 vs 13 (both mark `nameAr *`, nothing else) |
| #9 Missing StatsGrid / status filter / pagination | Task 10 |
| Delete endpoint missing on backend | Task 5 |
| Admin needs Department + Category in CASL | Task 2 |
| Guard must consider role, not just permissions | Task 1 |

No placeholders detected. Types line up: `CategoryListQuery` defined in Task 7 and consumed in Tasks 8/9; `useCategories` return shape defined in Task 9 and consumed in Task 10.
