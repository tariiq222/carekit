# Dashboard ↔ Backend Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ربط الداشبورد بالباك الجديد بالكامل — تصحيح الـ API paths، إضافة الـ endpoints المفقودة، وبناء Feature Flags من الصفر.

**Architecture:** الخطة مقسّمة على 7 موجات مرتّبة حسب الأولوية. الموجات 1-2 تُصلح الداشبورد مباشرة (تعديل paths). الموجات 3-7 تُضيف endpoints مفقودة في الباك. كل موجة commit مستقل.

**Tech Stack:** NestJS 11, Prisma 7, Next.js 15, TanStack Query v5, TypeScript strict

---

## ملف البنية — الملفات المتأثرة

### الداشبورد (تعديل paths فقط)
- `apps/dashboard/lib/api/employees.ts` — prefix fix
- `apps/dashboard/lib/api/branches.ts` — prefix fix
- `apps/dashboard/lib/api/departments.ts` — prefix fix
- `apps/dashboard/lib/api/services.ts` — prefix fix
- `apps/dashboard/lib/api/ratings.ts` — prefix fix
- `apps/dashboard/lib/api/problem-reports.ts` — prefix fix
- `apps/dashboard/lib/api/chatbot-kb.ts` — prefix fix
- `apps/dashboard/lib/api/feature-flags.ts` — prefix fix

### الباك (إضافات)
- `apps/backend/src/api/public/auth.controller.ts` — إضافة GET /me + PATCH /password/change
- `apps/backend/src/modules/identity/users/change-password.handler.ts` — جديد
- `apps/backend/src/modules/identity/identity.module.ts` — تسجيل handlers + controllers جديدة
- `apps/backend/src/api/dashboard/identity.controller.ts` — جديد (users + roles + permissions)
- `apps/backend/src/modules/platform/feature-flags/feature-flag.entity.ts` — جديد (Prisma already has FeatureFlag)
- `apps/backend/src/modules/platform/feature-flags/list-feature-flags.handler.ts` — جديد
- `apps/backend/src/modules/platform/feature-flags/get-feature-flag-map.handler.ts` — جديد
- `apps/backend/src/modules/platform/feature-flags/update-feature-flag.handler.ts` — جديد
- `apps/backend/src/modules/platform/feature-flags/update-feature-flag.dto.ts` — جديد
- `apps/backend/src/modules/platform/platform.module.ts` — تسجيل feature flag handlers
- `apps/backend/src/api/dashboard/platform.controller.ts` — إضافة feature flag endpoints

---

## الموجة 1 — تصحيح API Paths في الداشبورد

### Task 1: تصحيح prefix ملف employees.ts

**Files:**
- Modify: `apps/dashboard/lib/api/employees.ts`

- [ ] **Step 1: تصحيح كل paths في الملف**

في `apps/dashboard/lib/api/employees.ts`، استبدل:
```ts
// كل السطور التي تحتوي على "/employees"
// قبل:
api.get<PaginatedResponse<RawEmployee>>("/employees", {
// بعد:
api.get<PaginatedResponse<RawEmployee>>("/dashboard/people/employees", {
```

```ts
// قبل:
api.get<RawEmployee>(`/employees/${id}`)
// بعد:
api.get<RawEmployee>(`/dashboard/people/employees/${id}`)
```

```ts
// قبل:
api.post<Employee>("/employees", payload)
// بعد:
api.post<Employee>("/dashboard/people/employees", payload)
```

```ts
// قبل:
api.post<OnboardEmployeeResponse>("/employees/onboard", payload)
// بعد:
api.post<OnboardEmployeeResponse>(`/dashboard/people/employees/${payload.employeeId}/onboarding`, payload)
```

```ts
// قبل:
api.patch<Employee>(`/employees/${id}`, payload)
// بعد:
api.patch<Employee>(`/dashboard/people/employees/${id}`, payload)
```

```ts
// قبل:
api.delete(`/employees/${id}`)
// بعد:
api.delete(`/dashboard/people/employees/${id}`)
```

وفي `employees-schedule.ts`، استبدل كل `/employees/${id}/` بـ `/dashboard/people/employees/${id}/`

- [ ] **Step 2: تحقق من TypeScript**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -i employee | head -20
```

Expected: لا أخطاء متعلقة بـ employees

---

### Task 2: تصحيح prefix ملفات branches, departments, services, ratings, problem-reports, chatbot-kb

**Files:**
- Modify: `apps/dashboard/lib/api/branches.ts`
- Modify: `apps/dashboard/lib/api/departments.ts`
- Modify: `apps/dashboard/lib/api/services.ts`
- Modify: `apps/dashboard/lib/api/ratings.ts`
- Modify: `apps/dashboard/lib/api/problem-reports.ts`
- Modify: `apps/dashboard/lib/api/chatbot-kb.ts`
- Modify: `apps/dashboard/lib/api/feature-flags.ts`

- [ ] **Step 1: تصحيح branches.ts**

```ts
// قبل:
api.get<PaginatedResponse<Branch>>("/branches", {
// بعد:
api.get<PaginatedResponse<Branch>>("/dashboard/organization/branches", {

// قبل:
api.get<Branch>(`/branches/${id}`)
// بعد:
api.get<Branch>(`/dashboard/organization/branches/${id}`)

// قبل:
api.post<Branch>("/branches", payload)
// بعد:
api.post<Branch>("/dashboard/organization/branches", payload)

// قبل:
api.patch<Branch>(`/branches/${id}`, payload)
// بعد:
api.patch<Branch>(`/dashboard/organization/branches/${id}`, payload)
```

- [ ] **Step 2: تصحيح departments.ts**

```ts
// قبل:
api.get<PaginatedResponse<Department>>("/departments", {
// بعد:
api.get<PaginatedResponse<Department>>("/dashboard/organization/departments", {

// قبل:
api.post<Department>("/departments", payload)
// بعد:
api.post<Department>("/dashboard/organization/departments", payload)

// قبل:
api.patch<Department>(`/departments/${id}`, payload)
// بعد:
api.patch<Department>(`/dashboard/organization/departments/${id}`, payload)
```

- [ ] **Step 3: تصحيح services.ts**

```ts
// قبل:
api.get<PaginatedResponse<Service>>("/services", {
// بعد:
api.get<PaginatedResponse<Service>>("/dashboard/organization/services", {

// قبل:
api.post<Service>("/services", payload)
// بعد:
api.post<Service>("/dashboard/organization/services", payload)

// قبل:
api.patch<Service>(`/services/${id}`, payload)
// بعد:
api.patch<Service>(`/dashboard/organization/services/${id}`, payload)

// قبل:
api.delete(`/services/${id}`)
// بعد:
api.delete(`/dashboard/organization/services/${id}`)
```

ابحث أيضًا عن أي استخدام لـ `/dashboard/organization/categories` في نفس الملف — إذا كان موجودًا فهو صحيح وابقه كما هو.

- [ ] **Step 4: تصحيح ratings.ts**

```ts
// قبل: (أي path يبدأ بـ /ratings)
api.get<PaginatedResponse<Rating>>("/ratings", {
// بعد:
api.get<PaginatedResponse<Rating>>("/dashboard/organization/ratings", {

// قبل:
api.post<Rating>("/ratings", payload)
// بعد:
api.post<Rating>("/dashboard/organization/ratings", payload)
```

- [ ] **Step 5: تصحيح problem-reports.ts**

```ts
// قبل: (أي path يبدأ بـ /problem-reports)
"/problem-reports"
// بعد:
"/dashboard/platform/problem-reports"

// قبل:
`/problem-reports/${id}/status`
// بعد:
`/dashboard/platform/problem-reports/${id}/status`
```

- [ ] **Step 6: تصحيح chatbot-kb.ts**

```ts
// قبل:
"/chatbot/knowledge-base"
// بعد:
"/dashboard/ai/knowledge-base"

// قبل:
"/chatbot/knowledge-base/sync"
// بعد:
"/dashboard/ai/knowledge-base/sync"

// قبل:
`/chatbot/knowledge-base/${id}`
// بعد:
`/dashboard/ai/knowledge-base/${id}`
```

- [ ] **Step 7: تصحيح feature-flags.ts**

```ts
// قبل:
api.get<FeatureFlag[]>("/feature-flags")
// بعد:
api.get<FeatureFlag[]>("/dashboard/platform/feature-flags")

// قبل:
api.get<FeatureFlagMap>("/feature-flags/map")
// بعد:
api.get<FeatureFlagMap>("/dashboard/platform/feature-flags/map")

// قبل:
api.patch<FeatureFlag>(`/feature-flags/${key}`, { enabled })
// بعد:
api.patch<FeatureFlag>(`/dashboard/platform/feature-flags/${key}`, { enabled })
```

- [ ] **Step 8: typecheck + commit**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -v "node_modules" | head -30
```

Expected: 0 أخطاء

```bash
git add apps/dashboard/lib/api/
git commit -m "fix(dashboard): correct API paths to match new backend routes"
```

---

## الموجة 2 — Auth المفقود في الباك

### Task 3: إضافة GET /auth/me

**Files:**
- Modify: `apps/backend/src/api/public/auth.controller.ts`

- [ ] **Step 1: أضف import للـ handler و decorator**

في `auth.controller.ts`، أضف للـ imports:
```ts
import {
  Controller, Post, Get, Patch, Body, HttpCode, HttpStatus, UnauthorizedException,
} from '@nestjs/common';
import { GetCurrentUserHandler } from '../../modules/identity/get-current-user/get-current-user.handler';
import { GetCurrentUserQuery } from '../../modules/identity/get-current-user/get-current-user.query';
import { UserId } from '../../common/tenant/tenant.decorator';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { UseGuards } from '@nestjs/common';
```

- [ ] **Step 2: أضف GetCurrentUserHandler في constructor**

```ts
constructor(
  private readonly login: LoginHandler,
  private readonly logout: LogoutHandler,
  private readonly prisma: PrismaService,
  private readonly tokens: TokenService,
  private readonly getCurrentUser: GetCurrentUserHandler,  // أضف هذا
) {}
```

- [ ] **Step 3: أضف endpoint GET /auth/me**

أضف بعد `logoutEndpoint`:
```ts
@Get('me')
@UseGuards(JwtGuard)
async meEndpoint(
  @UserId() userId: string,
  @TenantId() tenantId: string,
) {
  return this.getCurrentUser.execute({ userId, tenantId } satisfies GetCurrentUserQuery);
}
```

- [ ] **Step 4: تحقق أن GetCurrentUserHandler مُصدَّر من IdentityModule**

```bash
grep "GetCurrentUserHandler" apps/backend/src/modules/identity/identity.module.ts
```

Expected: يظهر في `exports`

- [ ] **Step 5: run typecheck**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Expected: 0 أخطاء

---

### Task 4: إضافة PATCH /auth/password/change

**Files:**
- Create: `apps/backend/src/modules/identity/users/change-password.handler.ts`
- Modify: `apps/backend/src/modules/identity/identity.module.ts`
- Modify: `apps/backend/src/api/public/auth.controller.ts`

- [ ] **Step 1: اكتب الـ failing test**

أنشئ `apps/backend/src/modules/identity/users/change-password.handler.spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { ChangePasswordHandler } from './change-password.handler';
import { PrismaService } from '../../../infrastructure/database';
import { PasswordService } from '../shared/password.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ChangePasswordHandler', () => {
  let handler: ChangePasswordHandler;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };
  let passwordService: { verify: jest.Mock; hash: jest.Mock };

  beforeEach(async () => {
    prisma = { user: { findUnique: jest.fn(), update: jest.fn() } };
    passwordService = { verify: jest.fn(), hash: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ChangePasswordHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordService, useValue: passwordService },
      ],
    }).compile();

    handler = module.get(ChangePasswordHandler);
  });

  it('throws NotFoundException when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      handler.execute({ userId: 'u1', tenantId: 't1', currentPassword: 'old', newPassword: 'new123' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when current password is wrong', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', tenantId: 't1', passwordHash: 'hash' });
    passwordService.verify.mockResolvedValue(false);
    await expect(
      handler.execute({ userId: 'u1', tenantId: 't1', currentPassword: 'wrong', newPassword: 'new123' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('updates password when current password is correct', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', tenantId: 't1', passwordHash: 'hash' });
    passwordService.verify.mockResolvedValue(true);
    passwordService.hash.mockResolvedValue('newHash');
    prisma.user.update.mockResolvedValue({});

    await handler.execute({ userId: 'u1', tenantId: 't1', currentPassword: 'old', newPassword: 'new123' });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { passwordHash: 'newHash' },
    });
  });
});
```

- [ ] **Step 2: شغّل الـ test للتأكد أنه يفشل**

```bash
cd apps/backend && npx jest change-password.handler.spec.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module './change-password.handler'`

- [ ] **Step 3: اكتب الـ handler**

أنشئ `apps/backend/src/modules/identity/users/change-password.handler.ts`:
```ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { PasswordService } from '../shared/password.service';

export interface ChangePasswordCommand {
  userId: string;
  tenantId: string;
  currentPassword: string;
  newPassword: string;
}

@Injectable()
export class ChangePasswordHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
  ) {}

  async execute(cmd: ChangePasswordCommand): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: cmd.userId } });
    if (!user || user.tenantId !== cmd.tenantId) throw new NotFoundException('User not found');

    const isValid = await this.password.verify(cmd.currentPassword, user.passwordHash);
    if (!isValid) throw new BadRequestException('Current password is incorrect');

    const newHash = await this.password.hash(cmd.newPassword);
    await this.prisma.user.update({ where: { id: cmd.userId }, data: { passwordHash: newHash } });
  }
}
```

- [ ] **Step 4: شغّل الـ test للتأكد أنه ينجح**

```bash
cd apps/backend && npx jest change-password.handler.spec.ts --no-coverage 2>&1 | tail -10
```

Expected: PASS — 3 tests passed

- [ ] **Step 5: سجّل Handler في IdentityModule**

في `apps/backend/src/modules/identity/identity.module.ts`:
```ts
// أضف import:
import { ChangePasswordHandler } from './users/change-password.handler';

// أضف في handlers array:
const handlers = [
  LoginHandler, RefreshTokenHandler, LogoutHandler,
  GetCurrentUserHandler, CreateUserHandler, UpdateUserHandler, ListUsersHandler, DeactivateUserHandler,
  CreateRoleHandler, AssignPermissionsHandler, ListRolesHandler,
  ChangePasswordHandler,  // أضف هنا
];
```

- [ ] **Step 6: أضف endpoint في auth.controller.ts**

أضف DTO inline (بسيط جداً لا يستحق ملف منفصل):
```ts
import { IsString, MinLength } from 'class-validator';

class ChangePasswordDto {
  @IsString() currentPassword!: string;
  @IsString() @MinLength(8) newPassword!: string;
}
```

ثم أضف الـ endpoint:
```ts
@Patch('password/change')
@UseGuards(JwtGuard)
@HttpCode(HttpStatus.NO_CONTENT)
async changePasswordEndpoint(
  @UserId() userId: string,
  @TenantId() tenantId: string,
  @Body() body: ChangePasswordDto,
) {
  await this.changePassword.execute({
    userId,
    tenantId,
    currentPassword: body.currentPassword,
    newPassword: body.newPassword,
  });
}
```

وأضف `ChangePasswordHandler` في constructor:
```ts
constructor(
  private readonly login: LoginHandler,
  private readonly logout: LogoutHandler,
  private readonly prisma: PrismaService,
  private readonly tokens: TokenService,
  private readonly getCurrentUser: GetCurrentUserHandler,
  private readonly changePassword: ChangePasswordHandler,
) {}
```

- [ ] **Step 7: typecheck + commit**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Expected: 0 أخطاء

```bash
git add apps/backend/src/api/public/auth.controller.ts \
  apps/backend/src/modules/identity/users/change-password.handler.ts \
  apps/backend/src/modules/identity/users/change-password.handler.spec.ts \
  apps/backend/src/modules/identity/identity.module.ts
git commit -m "feat(backend): add GET /auth/me and PATCH /auth/password/change"
```

---

## الموجة 3 — Users + Roles + Permissions Controller

### Task 5: إنشاء DashboardIdentityController

**Files:**
- Create: `apps/backend/src/api/dashboard/identity.controller.ts`
- Modify: `apps/backend/src/modules/identity/identity.module.ts`

- [ ] **Step 1: اكتب الـ failing test**

أنشئ `apps/backend/src/api/dashboard/identity.controller.spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { DashboardIdentityController } from './identity.controller';
import { ListUsersHandler } from '../../modules/identity/users/list-users.handler';
import { CreateUserHandler } from '../../modules/identity/users/create-user.handler';
import { UpdateUserHandler } from '../../modules/identity/users/update-user.handler';
import { DeactivateUserHandler } from '../../modules/identity/users/deactivate-user.handler';
import { ListRolesHandler } from '../../modules/identity/roles/list-roles.handler';
import { CreateRoleHandler } from '../../modules/identity/roles/create-role.handler';
import { AssignPermissionsHandler } from '../../modules/identity/roles/assign-permissions.handler';
import { CaslAbilityFactory } from '../../modules/identity/casl/casl-ability.factory';
import { Reflector } from '@nestjs/core';

describe('DashboardIdentityController', () => {
  let controller: DashboardIdentityController;
  const mockListUsers = { execute: jest.fn() };
  const mockCreateUser = { execute: jest.fn() };
  const mockUpdateUser = { execute: jest.fn() };
  const mockDeactivate = { execute: jest.fn() };
  const mockListRoles = { execute: jest.fn() };
  const mockCreateRole = { execute: jest.fn() };
  const mockAssignPermissions = { execute: jest.fn() };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [DashboardIdentityController],
      providers: [
        { provide: ListUsersHandler, useValue: mockListUsers },
        { provide: CreateUserHandler, useValue: mockCreateUser },
        { provide: UpdateUserHandler, useValue: mockUpdateUser },
        { provide: DeactivateUserHandler, useValue: mockDeactivate },
        { provide: ListRolesHandler, useValue: mockListRoles },
        { provide: CreateRoleHandler, useValue: mockCreateRole },
        { provide: AssignPermissionsHandler, useValue: mockAssignPermissions },
        { provide: CaslAbilityFactory, useValue: { createForUser: jest.fn() } },
        Reflector,
      ],
    }).compile();
    controller = module.get(DashboardIdentityController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('listUsers calls handler with tenantId', async () => {
    mockListUsers.execute.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } });
    await controller.listUsers('t1', {});
    expect(mockListUsers.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 't1' }));
  });

  it('listRoles calls handler with tenantId', async () => {
    mockListRoles.execute.mockResolvedValue([]);
    await controller.listRoles('t1');
    expect(mockListRoles.execute).toHaveBeenCalledWith('t1');
  });
});
```

- [ ] **Step 2: شغّل الـ test للتأكد أنه يفشل**

```bash
cd apps/backend && npx jest identity.controller.spec.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module './identity.controller'`

- [ ] **Step 3: أنشئ الـ controller**

أنشئ `apps/backend/src/api/dashboard/identity.controller.ts`:
```ts
import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { ListUsersHandler } from '../../modules/identity/users/list-users.handler';
import { CreateUserHandler } from '../../modules/identity/users/create-user.handler';
import { UpdateUserHandler } from '../../modules/identity/users/update-user.handler';
import { DeactivateUserHandler } from '../../modules/identity/users/deactivate-user.handler';
import { ListRolesHandler } from '../../modules/identity/roles/list-roles.handler';
import { CreateRoleHandler } from '../../modules/identity/roles/create-role.handler';
import { AssignPermissionsHandler } from '../../modules/identity/roles/assign-permissions.handler';
import { CreateUserDto } from '../../modules/identity/users/create-user.dto';
import { CreateRoleDto } from '../../modules/identity/roles/create-role.dto';
import { AssignPermissionsDto } from '../../modules/identity/roles/assign-permissions.dto';
import { IsOptional, IsString, IsBoolean, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

class ListUsersQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

class UpdateUserDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() customRoleId?: string | null;
}

@Controller('dashboard/identity')
@UseGuards(JwtGuard, CaslGuard)
export class DashboardIdentityController {
  constructor(
    private readonly listUsers: ListUsersHandler,
    private readonly createUser: CreateUserHandler,
    private readonly updateUser: UpdateUserHandler,
    private readonly deactivateUser: DeactivateUserHandler,
    private readonly listRoles: ListRolesHandler,
    private readonly createRole: CreateRoleHandler,
    private readonly assignPermissions: AssignPermissionsHandler,
  ) {}

  // ── Users ────────────────────────────────────────────────────────────────

  @Get('users')
  async listUsers(@TenantId() tenantId: string, @Query() query: ListUsersQueryDto) {
    return this.listUsers.execute({
      tenantId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      search: query.search,
      isActive: query.isActive,
    });
  }

  @Post('users')
  async createUserEndpoint(@TenantId() tenantId: string, @Body() body: CreateUserDto) {
    return this.createUser.execute({ ...body, tenantId });
  }

  @Patch('users/:id')
  async updateUserEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() body: UpdateUserDto,
  ) {
    return this.updateUser.execute({ ...body, userId, tenantId });
  }

  @Patch('users/:id/deactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivateUserEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) userId: string,
  ) {
    await this.deactivateUser.execute({ userId, tenantId });
  }

  @Patch('users/:id/activate')
  @HttpCode(HttpStatus.NO_CONTENT)
  async activateUserEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) userId: string,
  ) {
    // Activate = undo deactivate
    await this.updateUser.execute({ userId, tenantId, isActive: true } as never);
  }

  // ── Roles ────────────────────────────────────────────────────────────────

  @Get('roles')
  async listRoles(@TenantId() tenantId: string) {
    return this.listRoles.execute(tenantId);
  }

  @Post('roles')
  async createRoleEndpoint(@TenantId() tenantId: string, @Body() body: CreateRoleDto) {
    return this.createRole.execute({ ...body, tenantId });
  }

  @Post('roles/:id/permissions')
  @HttpCode(HttpStatus.NO_CONTENT)
  async assignPermissionsEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) customRoleId: string,
    @Body() body: AssignPermissionsDto,
  ) {
    await this.assignPermissions.execute({ ...body, customRoleId, tenantId });
  }
}
```

- [ ] **Step 4: سجّل Controller في IdentityModule**

في `apps/backend/src/modules/identity/identity.module.ts`:
```ts
import { DashboardIdentityController } from '../../api/dashboard/identity.controller';

@Module({
  imports: [...],
  controllers: [DashboardIdentityController],   // أضف هذا
  providers: [...handlers, CaslAbilityFactory],
  exports: [...],
})
```

- [ ] **Step 5: شغّل الـ test**

```bash
cd apps/backend && npx jest identity.controller.spec.ts --no-coverage 2>&1 | tail -10
```

Expected: PASS — 3 tests passed

- [ ] **Step 6: typecheck + commit**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Expected: 0 أخطاء

```bash
git add apps/backend/src/api/dashboard/identity.controller.ts \
  apps/backend/src/api/dashboard/identity.controller.spec.ts \
  apps/backend/src/modules/identity/identity.module.ts
git commit -m "feat(backend): add dashboard identity controller (users/roles/permissions)"
```

---

### Task 6: تصحيح users.ts في الداشبورد

**Files:**
- Modify: `apps/dashboard/lib/api/users.ts`

- [ ] **Step 1: تصحيح كل paths**

في `apps/dashboard/lib/api/users.ts`، استبدل:
```ts
// قبل:
api.get<PaginatedResponse<User>>("/users", {
// بعد:
api.get<PaginatedResponse<User>>("/dashboard/identity/users", {

// قبل:
api.get<User>(`/users/${id}`)
// بعد:
api.get<User>(`/dashboard/identity/users/${id}`)

// قبل:
api.post<User>("/users", payload)
// بعد:
api.post<User>("/dashboard/identity/users", payload)

// قبل:
api.patch<User>(`/users/${id}`, payload)
// بعد:
api.patch<User>(`/dashboard/identity/users/${id}`, payload)

// قبل:
api.delete(`/users/${id}`)
// بعد:
api.delete(`/dashboard/identity/users/${id}`)

// قبل:
api.patch(`/users/${id}/activate`)
// بعد:
api.patch(`/dashboard/identity/users/${id}/activate`)

// قبل:
api.patch(`/users/${id}/deactivate`)
// بعد:
api.patch(`/dashboard/identity/users/${id}/deactivate`)

// قبل:
api.get<Role[]>("/roles")
// بعد:
api.get<Role[]>("/dashboard/identity/roles")

// قبل:
api.post<Role>("/roles", payload)
// بعد:
api.post<Role>("/dashboard/identity/roles", payload)

// قبل:
api.delete(`/roles/${id}`)
// بعد:
api.delete(`/dashboard/identity/roles/${id}`)

// قبل:
api.post(`/users/${userId}/roles`, payload)
// بعد:
api.post(`/dashboard/identity/users/${userId}/roles`, payload)

// قبل:
api.delete(`/users/${userId}/roles/${roleId}`)
// بعد:
api.delete(`/dashboard/identity/users/${userId}/roles/${roleId}`)

// قبل:
api.get<Permission[]>("/permissions")
// بعد:
// احذف هذا الـ endpoint أو اتركه — لا يوجد endpoint مقابل له في الباك حالياً
// يُضاف في موجة لاحقة

// قبل:
api.post(`/roles/${roleId}/permissions`, payload)
// بعد:
api.post(`/dashboard/identity/roles/${roleId}/permissions`, payload)
```

- [ ] **Step 2: typecheck**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | grep -i "user\|role\|permission" | grep -v "node_modules" | head -20
```

- [ ] **Step 3: commit**

```bash
git add apps/dashboard/lib/api/users.ts
git commit -m "fix(dashboard): update users/roles API paths to match new backend"
```

---

## الموجة 4 — Feature Flags في الباك

### Task 7: إنشاء Feature Flags Module

**Files:**
- Create: `apps/backend/src/modules/platform/feature-flags/list-feature-flags.handler.ts`
- Create: `apps/backend/src/modules/platform/feature-flags/get-feature-flag-map.handler.ts`
- Create: `apps/backend/src/modules/platform/feature-flags/update-feature-flag.handler.ts`
- Create: `apps/backend/src/modules/platform/feature-flags/update-feature-flag.dto.ts`
- Modify: `apps/backend/src/modules/platform/platform.module.ts`
- Modify: `apps/backend/src/api/dashboard/platform.controller.ts`

- [ ] **Step 1: تحقق من وجود FeatureFlag في Prisma schema**

```bash
grep -r "model FeatureFlag\|featureFlag\b" apps/backend/prisma/schema/ 2>/dev/null | head -10
```

إذا لم يوجد انتقل للـ Step 1b. إذا وُجد انتقل للـ Step 2.

- [ ] **Step 1b: أضف FeatureFlag migration (فقط إذا غير موجود في schema)**

```bash
# أنشئ schema في ملف منفصل
cat apps/backend/prisma/schema/platform.prisma 2>/dev/null | head -20
```

إذا ملف platform.prisma موجود، أضف فيه:
```prisma
model FeatureFlag {
  id            String   @id @default(cuid())
  tenantId      String
  key           String
  enabled       Boolean  @default(true)
  nameAr        String
  nameEn        String
  descriptionAr String?
  descriptionEn String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, key])
  @@index([tenantId])
}
```

ثم:
```bash
cd apps/backend && npm run prisma:migrate -- --name add_feature_flags
```

- [ ] **Step 2: اكتب الـ failing tests**

أنشئ `apps/backend/src/modules/platform/feature-flags/feature-flags.handlers.spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ListFeatureFlagsHandler } from './list-feature-flags.handler';
import { GetFeatureFlagMapHandler } from './get-feature-flag-map.handler';
import { UpdateFeatureFlagHandler } from './update-feature-flag.handler';
import { PrismaService } from '../../../infrastructure/database';

const mockFlag = {
  id: 'f1', tenantId: 't1', key: 'multi_branch', enabled: true,
  nameAr: 'فروع متعددة', nameEn: 'Multi Branch',
  descriptionAr: null, descriptionEn: null,
  createdAt: new Date(), updatedAt: new Date(),
};

describe('ListFeatureFlagsHandler', () => {
  let handler: ListFeatureFlagsHandler;
  let prisma: { featureFlag: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { featureFlag: { findMany: jest.fn().mockResolvedValue([mockFlag]) } };
    const module = await Test.createTestingModule({
      providers: [ListFeatureFlagsHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();
    handler = module.get(ListFeatureFlagsHandler);
  });

  it('returns flags for tenant', async () => {
    const result = await handler.execute('t1');
    expect(result).toHaveLength(1);
    expect(prisma.featureFlag.findMany).toHaveBeenCalledWith({ where: { tenantId: 't1' }, orderBy: { key: 'asc' } });
  });
});

describe('GetFeatureFlagMapHandler', () => {
  let handler: GetFeatureFlagMapHandler;
  let prisma: { featureFlag: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { featureFlag: { findMany: jest.fn().mockResolvedValue([mockFlag]) } };
    const module = await Test.createTestingModule({
      providers: [GetFeatureFlagMapHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();
    handler = module.get(GetFeatureFlagMapHandler);
  });

  it('returns { key: enabled } map', async () => {
    const result = await handler.execute('t1');
    expect(result).toEqual({ multi_branch: true });
  });
});

describe('UpdateFeatureFlagHandler', () => {
  let handler: UpdateFeatureFlagHandler;
  let prisma: { featureFlag: { findUnique: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      featureFlag: {
        findUnique: jest.fn().mockResolvedValue(mockFlag),
        update: jest.fn().mockResolvedValue({ ...mockFlag, enabled: false }),
      },
    };
    const module = await Test.createTestingModule({
      providers: [UpdateFeatureFlagHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();
    handler = module.get(UpdateFeatureFlagHandler);
  });

  it('throws NotFoundException when flag not found', async () => {
    prisma.featureFlag.findUnique.mockResolvedValue(null);
    await expect(handler.execute({ tenantId: 't1', key: 'x', enabled: false })).rejects.toThrow(NotFoundException);
  });

  it('updates flag enabled status', async () => {
    const result = await handler.execute({ tenantId: 't1', key: 'multi_branch', enabled: false });
    expect(result.enabled).toBe(false);
  });
});
```

- [ ] **Step 3: شغّل الـ test للتأكد أنه يفشل**

```bash
cd apps/backend && npx jest feature-flags.handlers.spec.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL — Cannot find module

- [ ] **Step 4: أنشئ الـ handlers**

أنشئ `apps/backend/src/modules/platform/feature-flags/list-feature-flags.handler.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class ListFeatureFlagsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(tenantId: string) {
    return this.prisma.featureFlag.findMany({
      where: { tenantId },
      orderBy: { key: 'asc' },
    });
  }
}
```

أنشئ `apps/backend/src/modules/platform/feature-flags/get-feature-flag-map.handler.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class GetFeatureFlagMapHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(tenantId: string): Promise<Record<string, boolean>> {
    const flags = await this.prisma.featureFlag.findMany({ where: { tenantId } });
    return Object.fromEntries(flags.map((f) => [f.key, f.enabled]));
  }
}
```

أنشئ `apps/backend/src/modules/platform/feature-flags/update-feature-flag.dto.ts`:
```ts
import { IsBoolean } from 'class-validator';

export class UpdateFeatureFlagDto {
  @IsBoolean() enabled!: boolean;
}
```

أنشئ `apps/backend/src/modules/platform/feature-flags/update-feature-flag.handler.ts`:
```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface UpdateFeatureFlagCommand {
  tenantId: string;
  key: string;
  enabled: boolean;
}

@Injectable()
export class UpdateFeatureFlagHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpdateFeatureFlagCommand) {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { tenantId_key: { tenantId: cmd.tenantId, key: cmd.key } },
    });
    if (!flag) throw new NotFoundException(`Feature flag "${cmd.key}" not found`);

    return this.prisma.featureFlag.update({
      where: { tenantId_key: { tenantId: cmd.tenantId, key: cmd.key } },
      data: { enabled: cmd.enabled },
    });
  }
}
```

- [ ] **Step 5: شغّل الـ tests**

```bash
cd apps/backend && npx jest feature-flags.handlers.spec.ts --no-coverage 2>&1 | tail -10
```

Expected: PASS — 4 tests passed

- [ ] **Step 6: أضف endpoints في platform.controller.ts**

في `apps/backend/src/api/dashboard/platform.controller.ts`، أضف imports:
```ts
import { ListFeatureFlagsHandler } from '../../modules/platform/feature-flags/list-feature-flags.handler';
import { GetFeatureFlagMapHandler } from '../../modules/platform/feature-flags/get-feature-flag-map.handler';
import { UpdateFeatureFlagHandler } from '../../modules/platform/feature-flags/update-feature-flag.handler';
import { UpdateFeatureFlagDto } from '../../modules/platform/feature-flags/update-feature-flag.dto';
import { IsString } from 'class-validator';
```

أضف في constructor:
```ts
constructor(
  // ... existing handlers ...
  private readonly listFeatureFlags: ListFeatureFlagsHandler,
  private readonly getFeatureFlagMap: GetFeatureFlagMapHandler,
  private readonly updateFeatureFlag: UpdateFeatureFlagHandler,
) {}
```

أضف endpoints:
```ts
// ── Feature Flags ──────────────────────────────────────────────────────────

@Get('feature-flags')
async listFeatureFlagsEndpoint(@TenantId() tenantId: string) {
  return this.listFeatureFlags.execute(tenantId);
}

@Get('feature-flags/map')
async featureFlagMapEndpoint(@TenantId() tenantId: string) {
  return this.getFeatureFlagMap.execute(tenantId);
}

@Patch('feature-flags/:key')
async updateFeatureFlagEndpoint(
  @TenantId() tenantId: string,
  @Param('key') key: string,
  @Body() body: UpdateFeatureFlagDto,
) {
  return this.updateFeatureFlag.execute({ tenantId, key, enabled: body.enabled });
}
```

- [ ] **Step 7: سجّل handlers في PlatformModule**

في `apps/backend/src/modules/platform/platform.module.ts`:
```ts
import { ListFeatureFlagsHandler } from './feature-flags/list-feature-flags.handler';
import { GetFeatureFlagMapHandler } from './feature-flags/get-feature-flag-map.handler';
import { UpdateFeatureFlagHandler } from './feature-flags/update-feature-flag.handler';

// أضف في providers و exports
```

- [ ] **Step 8: typecheck + run all tests + commit**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
cd apps/backend && npx jest --no-coverage 2>&1 | tail -15
```

Expected: 0 TypeScript errors، جميع tests تنجح

```bash
git add apps/backend/src/modules/platform/feature-flags/ \
  apps/backend/src/api/dashboard/platform.controller.ts \
  apps/backend/src/modules/platform/platform.module.ts
git commit -m "feat(backend): add feature flags CRUD endpoints (list/map/update)"
```

---

## الموجات 5-7 — للمرحلة التالية

> **ملاحظة:** الموجات 5-7 (employees الكاملة، organization settings، coupons+zatca) تحتاج تحليل schema أعمق وتُعامل كـ implementation plan منفصل بعد اكتمال الموجات 1-4 والتحقق من الربط الفعلي.

الأولويات المرجّأة:
- **Employees extended** — delete, breaks, vacations, services per employee, ratings
- **Organization Settings** — booking flow, payment settings, general settings
- **Finance** — coupons CRUD، zatca config/onboard/sandbox

---

## Verification Final

بعد اكتمال الموجات 1-4:

- [ ] شغّل الداشبورد والباك معاً:
```bash
npm run docker:up
npm run dev:backend &
npm run dev:dashboard
```

- [ ] تحقق من هذه الصفحات تعمل:
  - `/employees` — قائمة الموظفين
  - `/branches` — الفروع
  - `/departments` — الأقسام
  - `/services` — الخدمات
  - `/users` — المستخدمين
  - `/settings` → tab Features — Feature Flags
  - تسجيل الدخول → `/auth/me` يُرجع بيانات المستخدم

- [ ] تحقق من Network tab: لا 404، لا contract mismatch
