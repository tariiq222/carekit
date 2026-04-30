# Clients P0 Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three critical P0 bugs in the Clients module: missing Audit Log on all PHI-touching operations, unhandled phone uniqueness conflict returning 500, and IDOR allowing any user ID to be passed to `findOne`/`updateClient`.

**Architecture:** Surgical edits to `clients.service.ts` and `clients.module.ts`. No new files. `ActivityLogModule` already exports `ActivityLogService` — just needs to be imported into `ClientsModule`.

**Tech Stack:** NestJS 11, Prisma 7, TypeScript strict, Jest

---

## Files

- Modify: `backend/src/modules/clients/clients.module.ts`
- Modify: `backend/src/modules/clients/clients.service.ts`
- Test: `backend/test/unit/clients/clients.service.spec.ts`

---

## Task 1: Add ActivityLogModule import to ClientsModule and inject into ClientsService

**Files:**
- Modify: `backend/src/modules/clients/clients.module.ts`
- Modify: `backend/src/modules/clients/clients.service.ts`

**Problem:** `ClientsService` has no reference to `ActivityLogService`. PHI edits (updateClient, walk-in registration, claimAccount, activate/deactivate) leave no audit trail. PDPL requires it.

- [ ] **Step 1: Update `clients.module.ts`**

Replace the file content with:

```typescript
import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller.js';
import { ClientsService } from './clients.service.js';
import { ClientWalkInService } from './client-walk-in.service.js';
import { ActivityLogModule } from '../activity-log/activity-log.module.js';

@Module({
  imports: [ActivityLogModule],
  controllers: [ClientsController],
  providers: [ClientsService, ClientWalkInService],
  exports: [ClientsService, ClientWalkInService],
})
export class ClientsModule {}
```

- [ ] **Step 2: Inject `ActivityLogService` into `ClientsService`**

In `backend/src/modules/clients/clients.service.ts`, replace the imports and constructor:

```typescript
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { parsePaginationParams, buildPaginationMeta } from '../../common/helpers/pagination.helper.js';
import { UpdateClientDto } from './dto/update-client.dto.js';
import { ClientListQueryDto } from './dto/client-list-query.dto.js';
import { ActivityLogService } from '../activity-log/activity-log.service.js';
import { Prisma } from '@prisma/client';
```

Replace constructor:

```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly activityLog: ActivityLogService,
) {}
```

- [ ] **Step 3: Run typecheck to confirm no errors**

```bash
cd /Users/tariq/Documents/my_programs/Deqah/backend
npx tsc --noEmit
```

Expected: 0 errors

---

## Task 2: Fix `updateClient` — add phone conflict guard + role guard + audit log

**Files:**
- Modify: `backend/src/modules/clients/clients.service.ts` (lines 111-151)
- Test: `backend/test/unit/clients/clients.service.spec.ts`

**Problems fixed in this task:**
1. P0.2: Phone update returns 500 (Prisma P2002) instead of 409 ConflictException
2. P2.2: `findFirst` has no role filter — any user ID works, not just clients
3. P0.1 (partial): No audit log on profile changes

- [ ] **Step 1: Write the failing tests**

In `backend/test/unit/clients/clients.service.spec.ts`, add:

```typescript
describe('updateClient', () => {
  it('should throw ConflictException when phone is already taken', async () => {
    const clientId = 'client-uuid-1';
    const existingPhone = '+966501234567';

    prisma.user.findFirst
      // First call: client exists check (with role guard)
      .mockResolvedValueOnce({ id: clientId })
      // Second call: phone conflict check — finds another user with same phone
      .mockResolvedValueOnce({ id: 'other-user-uuid' });

    await expect(
      service.updateClient(clientId, { phone: existingPhone }),
    ).rejects.toThrow(ConflictException);
  });

  it('should require client role in findFirst', async () => {
    const adminId = 'admin-uuid-1';

    // Simulate admin user (no client role)
    prisma.user.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.updateClient(adminId, { firstName: 'Test' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should call activityLog.log after successful update', async () => {
    prisma.user.findFirst
      .mockResolvedValueOnce({ id: 'client-1' }) // client exists with role
      .mockResolvedValueOnce(null);               // phone not taken
    prisma.$transaction.mockResolvedValue([{ id: 'client-1', firstName: 'Ahmad' }]);

    const logSpy = jest.spyOn(activityLogService, 'log').mockResolvedValue(undefined);

    await service.updateClient('client-1', { firstName: 'Ahmad' });

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'updated',
        module: 'clients',
        resourceId: 'client-1',
      }),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/tariq/Documents/my_programs/Deqah/backend
npm run test -- --testPathPattern="clients.service" --no-coverage
```

Expected: 3 FAILs

- [ ] **Step 3: Implement the fix — replace `updateClient` method**

In `clients.service.ts`, replace the `updateClient` method (lines 111-151):

```typescript
async updateClient(id: string, dto: UpdateClientDto, actorId?: string) {
  // Role guard: only allow actual client records (prevents IDOR on non-client users)
  const client = await this.prisma.user.findFirst({
    where: {
      id,
      deletedAt: null,
      userRoles: { some: { role: { slug: 'client' } } },
    },
    select: { id: true, phone: true },
  });
  if (!client) throw new NotFoundException('Client not found');

  // Phone conflict guard — return 409 instead of letting Prisma throw P2002 → 500
  if (dto.phone !== undefined && dto.phone !== client.phone) {
    const phoneOwner = await this.prisma.user.findFirst({
      where: { phone: dto.phone, deletedAt: null },
      select: { id: true },
    });
    if (phoneOwner) {
      throw new ConflictException({
        statusCode: 409,
        message: 'رقم الجوال مستخدم بالفعل',
        error: 'PHONE_CONFLICT',
      });
    }
  }

  const profileFields = {
    ...(dto.dateOfBirth !== undefined && { dateOfBirth: new Date(dto.dateOfBirth) }),
    ...(dto.nationality !== undefined && { nationality: dto.nationality }),
    ...(dto.nationalId !== undefined && { nationalId: dto.nationalId }),
    ...(dto.emergencyName !== undefined && { emergencyName: dto.emergencyName }),
    ...(dto.emergencyPhone !== undefined && { emergencyPhone: dto.emergencyPhone }),
    ...(dto.bloodType !== undefined && { bloodType: dto.bloodType }),
    ...(dto.allergies !== undefined && { allergies: dto.allergies }),
    ...(dto.chronicConditions !== undefined && { chronicConditions: dto.chronicConditions }),
  };

  const [user] = await this.prisma.$transaction([
    this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.middleName !== undefined && { middleName: dto.middleName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
      },
      select: { id: true, firstName: true, middleName: true, lastName: true, email: true, phone: true, gender: true, isActive: true, updatedAt: true },
    }),
    ...(Object.keys(profileFields).length > 0
      ? [this.prisma.clientProfile.upsert({
          where: { userId: id },
          update: profileFields,
          create: { userId: id, ...profileFields },
        })]
      : []),
  ]);

  // Audit log — redact PHI field values, log field names only
  const changedFields = Object.keys({ ...dto }).filter((k) => (dto as Record<string, unknown>)[k] !== undefined);
  this.activityLog.log({
    userId: actorId,
    action: 'updated',
    module: 'clients',
    resourceId: id,
    description: `Client profile updated — fields: ${changedFields.join(', ')}`,
    newValues: { updatedFields: changedFields }, // no PHI values in log
  }).catch(() => { /* non-blocking */ });

  return user;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/tariq/Documents/my_programs/Deqah/backend
npm run test -- --testPathPattern="clients.service" --no-coverage
```

Expected: PASS

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/tariq/Documents/my_programs/Deqah/backend
npm run test --no-coverage
```

Expected: All passing

- [ ] **Step 6: Commit**

```bash
cd /Users/tariq/Documents/my_programs/Deqah
git add backend/src/modules/clients/clients.module.ts \
        backend/src/modules/clients/clients.service.ts \
        backend/test/unit/clients/clients.service.spec.ts
git commit -m "fix(clients): add audit log, phone conflict 409, and client role guard in updateClient

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Fix `findOne` — add client role guard

**Files:**
- Modify: `backend/src/modules/clients/clients.service.ts` (lines 153-199)
- Test: `backend/test/unit/clients/clients.service.spec.ts`

**Problem (P2.3):** `findOne` uses `findFirst({ where: { id, deletedAt: null } })` with no role check. Any staff member with `clients:view` permission can pass an admin's UUID and receive their data including PHI fields from `clientProfile`.

- [ ] **Step 1: Write the failing test**

```typescript
describe('findOne', () => {
  it('should throw NotFoundException when id belongs to non-client user', async () => {
    // Simulate admin user — no client role
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.findOne('admin-uuid')).rejects.toThrow(NotFoundException);

    // Verify the query includes the role guard
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userRoles: { some: { role: { slug: 'client' } } },
        }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/tariq/Documents/my_programs/Deqah/backend
npm run test -- --testPathPattern="clients.service" --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Implement the fix in `findOne`**

In `clients.service.ts`, replace the `findOne` method (lines 153-199). Change only the `where` clause to add the role guard:

```typescript
async findOne(id: string) {
  const client = await this.prisma.user.findFirst({
    where: {
      id,
      deletedAt: null,
      userRoles: { some: { role: { slug: 'client' } } },
    },
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      email: true,
      phone: true,
      gender: true,
      isActive: true,
      updatedAt: true,
      createdAt: true,
      avatarUrl: true,
      accountType: true,
      claimedAt: true,
      clientProfile: {
        select: {
          nationalId: true, nationality: true, dateOfBirth: true,
          emergencyName: true, emergencyPhone: true,
          bloodType: true, allergies: true, chronicConditions: true,
        },
      },
      bookingsAsClient: {
        where: { deletedAt: null },
        orderBy: { date: 'desc' },
        take: 10,
        include: {
          service: { select: { nameAr: true, nameEn: true } },
          employee: {
            select: { user: { select: { firstName: true, lastName: true } } },
          },
          payment: {
            select: { totalAmount: true, status: true, method: true },
          },
        },
      },
    },
  });

  if (!client) {
    throw new NotFoundException('Client not found');
  }

  return client;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/tariq/Documents/my_programs/Deqah/backend
npm run test -- --testPathPattern="clients.service" --no-coverage
```

Expected: PASS

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/tariq/Documents/my_programs/Deqah/backend
npm run test --no-coverage
```

Expected: All passing

- [ ] **Step 6: Commit**

```bash
cd /Users/tariq/Documents/my_programs/Deqah
git add backend/src/modules/clients/clients.service.ts \
        backend/test/unit/clients/clients.service.spec.ts
git commit -m "fix(clients): add client role guard to findOne to prevent IDOR on non-client users

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
