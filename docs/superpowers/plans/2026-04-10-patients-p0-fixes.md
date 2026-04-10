# Patients P0 Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three critical P0 bugs in the Patients module: missing Audit Log on all PHI-touching operations, unhandled phone uniqueness conflict returning 500, and IDOR allowing any user ID to be passed to `findOne`/`updatePatient`.

**Architecture:** Surgical edits to `patients.service.ts` and `patients.module.ts`. No new files. `ActivityLogModule` already exports `ActivityLogService` — just needs to be imported into `PatientsModule`.

**Tech Stack:** NestJS 11, Prisma 7, TypeScript strict, Jest

---

## Files

- Modify: `backend/src/modules/patients/patients.module.ts`
- Modify: `backend/src/modules/patients/patients.service.ts`
- Test: `backend/test/unit/patients/patients.service.spec.ts`

---

## Task 1: Add ActivityLogModule import to PatientsModule and inject into PatientsService

**Files:**
- Modify: `backend/src/modules/patients/patients.module.ts`
- Modify: `backend/src/modules/patients/patients.service.ts`

**Problem:** `PatientsService` has no reference to `ActivityLogService`. PHI edits (updatePatient, walk-in registration, claimAccount, activate/deactivate) leave no audit trail. PDPL requires it.

- [ ] **Step 1: Update `patients.module.ts`**

Replace the file content with:

```typescript
import { Module } from '@nestjs/common';
import { PatientsController } from './patients.controller.js';
import { PatientsService } from './patients.service.js';
import { PatientWalkInService } from './patient-walk-in.service.js';
import { ActivityLogModule } from '../activity-log/activity-log.module.js';

@Module({
  imports: [ActivityLogModule],
  controllers: [PatientsController],
  providers: [PatientsService, PatientWalkInService],
  exports: [PatientsService, PatientWalkInService],
})
export class PatientsModule {}
```

- [ ] **Step 2: Inject `ActivityLogService` into `PatientsService`**

In `backend/src/modules/patients/patients.service.ts`, replace the imports and constructor:

```typescript
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { parsePaginationParams, buildPaginationMeta } from '../../common/helpers/pagination.helper.js';
import { UpdatePatientDto } from './dto/update-patient.dto.js';
import { PatientListQueryDto } from './dto/patient-list-query.dto.js';
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
cd /Users/tariq/Documents/my_programs/CareKit/backend
npx tsc --noEmit
```

Expected: 0 errors

---

## Task 2: Fix `updatePatient` — add phone conflict guard + role guard + audit log

**Files:**
- Modify: `backend/src/modules/patients/patients.service.ts` (lines 111-151)
- Test: `backend/test/unit/patients/patients.service.spec.ts`

**Problems fixed in this task:**
1. P0.2: Phone update returns 500 (Prisma P2002) instead of 409 ConflictException
2. P2.2: `findFirst` has no role filter — any user ID works, not just patients
3. P0.1 (partial): No audit log on profile changes

- [ ] **Step 1: Write the failing tests**

In `backend/test/unit/patients/patients.service.spec.ts`, add:

```typescript
describe('updatePatient', () => {
  it('should throw ConflictException when phone is already taken', async () => {
    const patientId = 'patient-uuid-1';
    const existingPhone = '+966501234567';

    prisma.user.findFirst
      // First call: patient exists check (with role guard)
      .mockResolvedValueOnce({ id: patientId })
      // Second call: phone conflict check — finds another user with same phone
      .mockResolvedValueOnce({ id: 'other-user-uuid' });

    await expect(
      service.updatePatient(patientId, { phone: existingPhone }),
    ).rejects.toThrow(ConflictException);
  });

  it('should require patient role in findFirst', async () => {
    const adminId = 'admin-uuid-1';

    // Simulate admin user (no patient role)
    prisma.user.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.updatePatient(adminId, { firstName: 'Test' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should call activityLog.log after successful update', async () => {
    prisma.user.findFirst
      .mockResolvedValueOnce({ id: 'patient-1' }) // patient exists with role
      .mockResolvedValueOnce(null);               // phone not taken
    prisma.$transaction.mockResolvedValue([{ id: 'patient-1', firstName: 'Ahmad' }]);

    const logSpy = jest.spyOn(activityLogService, 'log').mockResolvedValue(undefined);

    await service.updatePatient('patient-1', { firstName: 'Ahmad' });

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'updated',
        module: 'patients',
        resourceId: 'patient-1',
      }),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test -- --testPathPattern="patients.service" --no-coverage
```

Expected: 3 FAILs

- [ ] **Step 3: Implement the fix — replace `updatePatient` method**

In `patients.service.ts`, replace the `updatePatient` method (lines 111-151):

```typescript
async updatePatient(id: string, dto: UpdatePatientDto, actorId?: string) {
  // Role guard: only allow actual patient records (prevents IDOR on non-patient users)
  const patient = await this.prisma.user.findFirst({
    where: {
      id,
      deletedAt: null,
      userRoles: { some: { role: { slug: 'patient' } } },
    },
    select: { id: true, phone: true },
  });
  if (!patient) throw new NotFoundException('Patient not found');

  // Phone conflict guard — return 409 instead of letting Prisma throw P2002 → 500
  if (dto.phone !== undefined && dto.phone !== patient.phone) {
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
      ? [this.prisma.patientProfile.upsert({
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
    module: 'patients',
    resourceId: id,
    description: `Patient profile updated — fields: ${changedFields.join(', ')}`,
    newValues: { updatedFields: changedFields }, // no PHI values in log
  }).catch(() => { /* non-blocking */ });

  return user;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test -- --testPathPattern="patients.service" --no-coverage
```

Expected: PASS

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test --no-coverage
```

Expected: All passing

- [ ] **Step 6: Commit**

```bash
cd /Users/tariq/Documents/my_programs/CareKit
git add backend/src/modules/patients/patients.module.ts \
        backend/src/modules/patients/patients.service.ts \
        backend/test/unit/patients/patients.service.spec.ts
git commit -m "fix(patients): add audit log, phone conflict 409, and patient role guard in updatePatient

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Fix `findOne` — add patient role guard

**Files:**
- Modify: `backend/src/modules/patients/patients.service.ts` (lines 153-199)
- Test: `backend/test/unit/patients/patients.service.spec.ts`

**Problem (P2.3):** `findOne` uses `findFirst({ where: { id, deletedAt: null } })` with no role check. Any staff member with `patients:view` permission can pass an admin's UUID and receive their data including PHI fields from `patientProfile`.

- [ ] **Step 1: Write the failing test**

```typescript
describe('findOne', () => {
  it('should throw NotFoundException when id belongs to non-patient user', async () => {
    // Simulate admin user — no patient role
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.findOne('admin-uuid')).rejects.toThrow(NotFoundException);

    // Verify the query includes the role guard
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userRoles: { some: { role: { slug: 'patient' } } },
        }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test -- --testPathPattern="patients.service" --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Implement the fix in `findOne`**

In `patients.service.ts`, replace the `findOne` method (lines 153-199). Change only the `where` clause to add the role guard:

```typescript
async findOne(id: string) {
  const patient = await this.prisma.user.findFirst({
    where: {
      id,
      deletedAt: null,
      userRoles: { some: { role: { slug: 'patient' } } },
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
      patientProfile: {
        select: {
          nationalId: true, nationality: true, dateOfBirth: true,
          emergencyName: true, emergencyPhone: true,
          bloodType: true, allergies: true, chronicConditions: true,
        },
      },
      bookingsAsPatient: {
        where: { deletedAt: null },
        orderBy: { date: 'desc' },
        take: 10,
        include: {
          service: { select: { nameAr: true, nameEn: true } },
          practitioner: {
            select: { user: { select: { firstName: true, lastName: true } } },
          },
          payment: {
            select: { totalAmount: true, status: true, method: true },
          },
        },
      },
    },
  });

  if (!patient) {
    throw new NotFoundException('Patient not found');
  }

  return patient;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test -- --testPathPattern="patients.service" --no-coverage
```

Expected: PASS

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test --no-coverage
```

Expected: All passing

- [ ] **Step 6: Commit**

```bash
cd /Users/tariq/Documents/my_programs/CareKit
git add backend/src/modules/patients/patients.service.ts \
        backend/test/unit/patients/patients.service.spec.ts
git commit -m "fix(patients): add patient role guard to findOne to prevent IDOR on non-patient users

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
