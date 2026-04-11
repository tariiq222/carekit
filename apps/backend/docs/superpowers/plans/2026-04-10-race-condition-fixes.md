# Race Condition & Guard Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 documented bugs: TOCTOU race in `updatePatient` phone check, TOCTOU race in `claimAccount` email check, invalid-date guard in `createVacation`, and missing `checked_in`/`in_progress` statuses in `removeService` active-booking guard.

**Architecture:** Each fix is surgical — move a constraint check inside an existing `$transaction` callback (interactive) or add an `isNaN` guard. No schema changes, no new files. Tests already exist in `test/unit/` and document the expected behavior; we update them after each fix to assert the correct behavior rather than the bug.

**Tech Stack:** NestJS 11, Prisma 7 (`$transaction` interactive callback), Jest (unit tests in `test/unit/`)

---

## File Map

| File | Change |
|------|--------|
| `backend/src/modules/patients/patients.service.ts` | Move phone uniqueness check inside `$transaction` interactive callback |
| `backend/src/modules/patients/patient-walk-in.service.ts` | Move email uniqueness check + `user.update` into a single `$transaction` interactive callback |
| `backend/src/modules/practitioners/practitioner-vacation.service.ts` | Add `isNaN` guard for invalid date strings before the `startDate >= endDate` check |
| `backend/src/modules/practitioners/practitioner-service.service.ts` | Add `'checked_in'` and `'in_progress'` to the `booking.count` status filter |
| `backend/test/unit/patients/patients.service.spec.ts` | Update TOCTOU test to assert `ConflictException`, not raw throw |
| `backend/test/unit/patients/patient-walk-in.service.spec.ts` | Update TOCTOU test to assert `ConflictException`, not raw throw |
| `backend/test/unit/practitioners/practitioners.vacation.spec.ts` | Add test for invalid date string inputs |
| `backend/test/unit/practitioners/practitioner-service.service.spec.ts` | Update REGRESSION test to assert `ConflictException` for `checked_in` bookings |

---

## Task 1: Fix `removeService` — add `checked_in` / `in_progress` to booking guard

This is the simplest fix: a one-line change to the status array.

**Files:**
- Modify: `backend/src/modules/practitioners/practitioner-service.service.ts:137-143`
- Modify: `backend/test/unit/practitioners/practitioner-service.service.spec.ts`

- [ ] **Step 1: Update the booking.count status filter**

Open `backend/src/modules/practitioners/practitioner-service.service.ts`.

Replace lines 136–144 (the `activeBookings` block):

```typescript
    // Protect against deleting if active bookings exist
    const activeBookings = await this.prisma.booking.count({
      where: {
        practitionerServiceId: ps.id,
        status: { in: ['pending', 'confirmed', 'checked_in', 'in_progress'] },
        deletedAt: null,
      },
    });
    if (activeBookings > 0) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Cannot remove service with active bookings',
        error: 'ACTIVE_BOOKINGS_EXIST',
      });
    }
```

- [ ] **Step 2: Update the REGRESSION test to assert correct behavior**

Open `backend/test/unit/practitioners/practitioner-service.service.spec.ts`.

Find the test `'documents that booking.count query only checks pending + confirmed'` and replace the entire `[REGRESSION] removeService missing checked_in/in_progress guard` describe block with:

```typescript
  describe('[FIXED] removeService guards checked_in and in_progress bookings', () => {
    it('throws ConflictException when a checked_in booking exists', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerService.findUnique.mockResolvedValue(mockPs);
      // booking.count now returns 1 because checked_in IS in the filter
      mockPrisma.booking.count.mockResolvedValue(1);

      await expect(
        service.removeService(practitionerId, serviceId),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when an in_progress booking exists', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerService.findUnique.mockResolvedValue(mockPs);
      mockPrisma.booking.count.mockResolvedValue(1);

      await expect(
        service.removeService(practitionerId, serviceId),
      ).rejects.toThrow(ConflictException);
    });

    it('verifies booking.count query includes all 4 active statuses', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerService.findUnique.mockResolvedValue(mockPs);
      mockPrisma.booking.count.mockResolvedValue(0);
      mockPrisma.practitionerService.delete.mockResolvedValue(mockPs);

      await service.removeService(practitionerId, serviceId);

      expect(mockPrisma.booking.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: expect.arrayContaining(['pending', 'confirmed', 'checked_in', 'in_progress']) },
          }),
        }),
      );
    });

    it('allows removal when no active bookings exist', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerService.findUnique.mockResolvedValue(mockPs);
      mockPrisma.booking.count.mockResolvedValue(0);
      mockPrisma.practitionerService.delete.mockResolvedValue(mockPs);

      const result = await service.removeService(practitionerId, serviceId);

      expect(result).toEqual({ deleted: true });
    });
  });
```

- [ ] **Step 3: Run the affected test file**

```bash
cd backend
npx jest --testPathPatterns="practitioner-service.service" --no-coverage --verbose
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
cd backend
git add src/modules/practitioners/practitioner-service.service.ts \
        test/unit/practitioners/practitioner-service.service.spec.ts
git commit -m "fix(backend/practitioners): add checked_in/in_progress to removeService booking guard"
```

---

## Task 2: Fix `createVacation` — guard invalid date strings

**Files:**
- Modify: `backend/src/modules/practitioners/practitioner-vacation.service.ts:40-49`
- Modify: `backend/test/unit/practitioners/practitioners.vacation.spec.ts`

- [ ] **Step 1: Add isNaN guard in createVacation**

Open `backend/src/modules/practitioners/practitioner-vacation.service.ts`.

Replace lines 40–49 (from `const startDate = new Date(dto.startDate)` through the `BadRequestException` block):

```typescript
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'startDate and endDate must be valid ISO date strings',
        error: 'VALIDATION_ERROR',
      });
    }

    if (startDate >= endDate) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'startDate must be before endDate',
        error: 'VALIDATION_ERROR',
      });
    }
```

- [ ] **Step 2: Add test for invalid date inputs**

Open `backend/test/unit/practitioners/practitioners.vacation.spec.ts`.

In the `describe('PractitionersService — createVacation', ...)` block, add these tests after the existing `it.each` block:

```typescript
  it('throws BadRequestException for invalid startDate string', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
    ctx.mockPrisma.practitionerVacation.findMany.mockResolvedValue([]);

    await expect(
      ctx.vacationService.createVacation(mockPractitioner.id, {
        startDate: 'not-a-date',
        endDate:   '2026-05-10',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException for invalid endDate string', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
    ctx.mockPrisma.practitionerVacation.findMany.mockResolvedValue([]);

    await expect(
      ctx.vacationService.createVacation(mockPractitioner.id, {
        startDate: '2026-05-01',
        endDate:   'invalid',
      }),
    ).rejects.toThrow(BadRequestException);
  });
```

- [ ] **Step 3: Run the vacation test file**

```bash
cd backend
npx jest --testPathPatterns="practitioners.vacation" --no-coverage --verbose
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
cd backend
git add src/modules/practitioners/practitioner-vacation.service.ts \
        test/unit/practitioners/practitioners.vacation.spec.ts
git commit -m "fix(backend/practitioners): guard invalid date strings in createVacation"
```

---

## Task 3: Fix `claimAccount` — move email check inside transaction

The current code: `findUnique(email)` → if taken throw 409 → `bcrypt.hash` → `user.update`. Two concurrent calls both pass the `findUnique` check, then both hit `user.update`, second one gets Prisma P2002 → unhandled 500.

Fix: wrap the email check + update in a single `$transaction` interactive callback, and map P2002 to `ConflictException`.

**Files:**
- Modify: `backend/src/modules/patients/patient-walk-in.service.ts:106-157`
- Modify: `backend/test/unit/patients/patient-walk-in.service.spec.ts`

- [ ] **Step 1: Rewrite claimAccount with transaction + P2002 mapping**

Open `backend/src/modules/patients/patient-walk-in.service.ts`.

Replace the entire `claimAccount` method (lines 106–157):

```typescript
  async claimAccount(dto: ClaimAccountDto) {
    const walkInUser = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      select: { id: true, accountType: true, email: true },
    });

    if (!walkInUser || walkInUser.accountType !== AccountType.walk_in) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'No walk-in account found with this phone number',
        error: 'WALK_IN_NOT_FOUND',
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        // Inside the transaction: email uniqueness check + update are atomic.
        // This eliminates the TOCTOU window between the check and the update.
        const emailTaken = await tx.user.findFirst({
          where: { email: dto.email, deletedAt: null, id: { not: walkInUser.id } },
          select: { id: true },
        });

        if (emailTaken) {
          throw new ConflictException({
            statusCode: 409,
            message: 'A user with this email already exists',
            error: 'USER_EMAIL_EXISTS',
          });
        }

        return tx.user.update({
          where: { id: walkInUser.id },
          data: {
            email: dto.email,
            passwordHash,
            accountType: AccountType.full,
            claimedAt: new Date(),
            emailVerified: false,
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            accountType: true,
            claimedAt: true,
          },
        });
      });

      return updated;
    } catch (err) {
      // Map Prisma P2002 (unique constraint) to 409 in case a concurrent
      // transaction committed first (the findFirst check is serializable
      // at READ COMMITTED but P2002 is the definitive safety net).
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException({
          statusCode: 409,
          message: 'A user with this email already exists',
          error: 'USER_EMAIL_EXISTS',
        });
      }
      throw err;
    }
  }
```

- [ ] **Step 2: Update the TOCTOU test to assert ConflictException**

Open `backend/test/unit/patients/patient-walk-in.service.spec.ts`.

Find the test `'[TOCTOU] documents uncaught P2002 on concurrent email claim'` and replace it:

```typescript
    it('[TOCTOU] maps P2002 to ConflictException on concurrent email claim', async () => {
      // Both concurrent requests pass the in-transaction findFirst (READ COMMITTED).
      // The second transaction gets P2002 from Postgres — must become 409, not 500.
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: walkInUser.id, accountType: 'walk_in', email: walkInUser.email });

      const p2002 = Object.assign(new Error('Unique constraint failed on the fields: (`email`)'), {
        code: 'P2002',
        meta: { target: ['email'] },
      });
      // Simulate the transaction itself throwing P2002 (second concurrent winner)
      mockPrisma.$transaction.mockRejectedValue(p2002);

      await expect(service.claimAccount(claimDto)).rejects.toThrow(ConflictException);
    });
```

- [ ] **Step 3: Run the walk-in test file**

```bash
cd backend
npx jest --testPathPatterns="patient-walk-in" --no-coverage --verbose
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
cd backend
git add src/modules/patients/patient-walk-in.service.ts \
        test/unit/patients/patient-walk-in.service.spec.ts
git commit -m "fix(backend/patients): move email check inside transaction in claimAccount, map P2002 to 409"
```

---

## Task 4: Fix `updatePatient` — move phone check inside transaction

Same TOCTOU pattern as Task 3. Fix: convert the array-mode `$transaction` to an interactive callback, perform the phone check inside, map P2002 to `ConflictException`.

**Files:**
- Modify: `backend/src/modules/patients/patients.service.ts:115-183`
- Modify: `backend/test/unit/patients/patients.service.spec.ts`

- [ ] **Step 1: Rewrite updatePatient with interactive transaction + P2002 mapping**

Open `backend/src/modules/patients/patients.service.ts`.

Replace the entire `updatePatient` method (lines 115–183):

```typescript
  async updatePatient(id: string, dto: UpdatePatientDto, actorId?: string) {
    const patient = await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
        userRoles: { some: { role: { slug: 'patient' } } },
      },
      select: { id: true, phone: true },
    });
    if (!patient) throw new NotFoundException('Patient not found');

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

    let user: {
      id: string;
      firstName: string;
      middleName: string | null;
      lastName: string;
      email: string | null;
      phone: string | null;
      gender: string | null;
      isActive: boolean;
      updatedAt: Date;
    };

    try {
      user = await this.prisma.$transaction(async (tx) => {
        // Phone uniqueness check is inside the transaction to eliminate TOCTOU.
        if (dto.phone !== undefined && dto.phone !== patient.phone) {
          const phoneOwner = await tx.user.findFirst({
            where: { phone: dto.phone, deletedAt: null, id: { not: id } },
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

        const updated = await tx.user.update({
          where: { id },
          data: {
            ...(dto.firstName !== undefined && { firstName: dto.firstName }),
            ...(dto.middleName !== undefined && { middleName: dto.middleName }),
            ...(dto.lastName !== undefined && { lastName: dto.lastName }),
            ...(dto.gender !== undefined && { gender: dto.gender }),
            ...(dto.phone !== undefined && { phone: dto.phone }),
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
          },
        });

        if (Object.keys(profileFields).length > 0) {
          await tx.patientProfile.upsert({
            where: { userId: id },
            update: profileFields,
            create: { userId: id, ...profileFields },
          });
        }

        return updated;
      });
    } catch (err) {
      // Re-throw ConflictException thrown from inside the transaction callback.
      if (err instanceof ConflictException) throw err;
      // Map Prisma P2002 on phone unique constraint → 409.
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException({
          statusCode: 409,
          message: 'رقم الجوال مستخدم بالفعل',
          error: 'PHONE_CONFLICT',
        });
      }
      throw err;
    }

    const changedFields = Object.keys({ ...dto }).filter(
      (k) => (dto as Record<string, unknown>)[k] !== undefined,
    );
    this.activityLog
      .log({
        userId: actorId,
        action: 'updated',
        module: 'patients',
        resourceId: id,
        description: `Patient profile updated — fields: ${changedFields.join(', ')}`,
        newValues: { updatedFields: changedFields },
      })
      .catch(() => {
        /* non-blocking */
      });

    return user;
  }
```

- [ ] **Step 2: Update the mock for $transaction to support interactive callback**

The existing `patients.service.spec.ts` mock at line 42 uses:
```typescript
$transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
```

This only handles array-mode transactions. Change it to handle both modes:

Open `backend/test/unit/patients/patients.service.spec.ts` and replace line 42:

```typescript
  $transaction: jest.fn((opsOrFn: unknown[] | ((tx: unknown) => Promise<unknown>)) => {
    if (typeof opsOrFn === 'function') return opsOrFn(mockPrismaService);
    return Promise.all(opsOrFn as Promise<unknown>[]);
  }),
```

- [ ] **Step 3: Update the TOCTOU test to assert ConflictException**

In `backend/test/unit/patients/patients.service.spec.ts`, find the describe block `'[TOCTOU] updatePatient phone uniqueness race condition'` and replace it:

```typescript
  describe('[TOCTOU] updatePatient phone uniqueness — maps P2002 to ConflictException', () => {
    it('throws ConflictException when P2002 arrives from concurrent transaction', async () => {
      mockPrismaService.user.findFirst
        .mockResolvedValueOnce({ id: 'patient-1', phone: '+966501234567' }) // patient found
        .mockResolvedValueOnce(null); // in-transaction phone check: not taken yet

      const p2002 = Object.assign(
        new Error('Unique constraint failed on the fields: (`phone`)'),
        { code: 'P2002', meta: { target: ['phone'] } },
      );
      // Simulate Postgres raising P2002 after the check passes (second concurrent commit)
      mockPrismaService.user.update.mockRejectedValue(p2002);

      await expect(
        service.updatePatient('patient-1', { phone: '+966509999999' }),
      ).rejects.toThrow(ConflictException);
    });

    it('still throws ConflictException when in-transaction check finds conflict', async () => {
      mockPrismaService.user.findFirst
        .mockResolvedValueOnce({ id: 'patient-1', phone: '+966501234567' })
        .mockResolvedValueOnce({ id: 'other-user' }); // in-transaction check: phone taken

      await expect(
        service.updatePatient('patient-1', { phone: '+966509999999' }),
      ).rejects.toThrow(ConflictException);
    });
  });
```

- [ ] **Step 4: Run the patients service test file**

```bash
cd backend
npx jest --testPathPatterns="test/unit/patients/patients.service" --no-coverage --verbose
```

Expected: all tests pass.

- [ ] **Step 5: Run the full test suite**

```bash
cd backend
npx jest --no-coverage 2>&1 | grep -E "Test Suites:|Tests:|FAIL "
```

Expected: 0 failures, total count higher than before.

- [ ] **Step 6: Commit**

```bash
cd backend
git add src/modules/patients/patients.service.ts \
        test/unit/patients/patients.service.spec.ts
git commit -m "fix(backend/patients): move phone uniqueness check inside transaction in updatePatient, map P2002 to 409"
```
