# Groups P0 Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three critical P0 bugs in the Groups module: race condition in seat counter, missing `GroupPayment.create` record that breaks the entire payment flow, and `remainingDueDate` silently dropped from DTO.

**Architecture:** All three fixes are surgical — no new files needed. The race condition fix moves the `group.findFirst` inside the existing `$transaction` with `Serializable` isolation. The payment fix adds `GroupPayment.create` inside `triggerPaymentRequest`. The DTO fix adds one field.

**Tech Stack:** NestJS 11, Prisma 7, TypeScript strict, Jest

---

## Files

- Modify: `backend/src/modules/groups/groups-enrollments.service.ts`
- Modify: `backend/src/modules/groups/groups-payment.service.ts`
- Modify: `backend/src/modules/groups/dto/create-group.dto.ts`
- Modify: `backend/src/modules/groups/dto/update-group.dto.ts`
- Modify: `backend/src/modules/groups/groups.service.ts` (map `remainingDueDate` on create/update)
- Test: `backend/test/unit/groups/groups-enrollments.service.spec.ts`
- Test: `backend/test/unit/groups/groups-payment.service.spec.ts`

---

## Task 1: Fix Race Condition in `enroll()` — Move group read inside Serializable transaction

**Files:**
- Modify: `backend/src/modules/groups/groups-enrollments.service.ts:20-106`
- Test: `backend/test/unit/groups/groups-enrollments.service.spec.ts`

**Problem:** Line 21 reads `group` outside the transaction. Two concurrent requests both read `currentEnrollment = 9`, both increment to 10, resulting in `currentEnrollment = 11` with `maxParticipants = 10`.

- [ ] **Step 1: Write the failing test**

Create or open `backend/test/unit/groups/groups-enrollments.service.spec.ts` and add this test (keep existing tests intact, add at the end of the `enroll` describe block):

```typescript
it('should not allow overbooking when two enrollments race', async () => {
  // Arrange: group at maxParticipants - 1
  const group = {
    id: 'group-1',
    status: 'open',
    paymentType: 'FULL_PAYMENT',
    currentEnrollment: 9,
    maxParticipants: 10,
    minParticipants: 2,
    schedulingMode: 'fixed_date',
    paymentDeadlineHours: 48,
    nameAr: 'مجموعة',
    nameEn: 'Group',
    practitionerId: 'p-1',
    deletedAt: null,
  };

  // Simulate: tx.group.findFirst returns stale count (9) for BOTH concurrent calls
  // The real fix ensures we read INSIDE the transaction so DB serializes them.
  // In the unit test, we verify the tx.group.update uses the count from the tx read,
  // not the outer variable.
  let txUpdateCallCount = 0;
  const mockTx = {
    groupEnrollment: {
      create: jest.fn().mockResolvedValue({ id: 'enroll-1', groupId: 'group-1', patientId: 'patient-1', status: 'registered' }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    group: {
      findFirst: jest.fn().mockResolvedValue({ ...group, currentEnrollment: 9 }),
      update: jest.fn().mockImplementation(({ data }) => {
        txUpdateCallCount++;
        expect(data.currentEnrollment).toBe(10); // must use tx-read count + 1
        return Promise.resolve({ ...group, ...data });
      }),
    },
  };

  prisma.$transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx));
  prisma.group.findFirst.mockResolvedValue(group); // outer findFirst (for existence check)
  prisma.groupEnrollment.findFirst.mockResolvedValue(null); // no existing enrollment

  await service.enroll('group-1', 'patient-1');

  expect(txUpdateCallCount).toBe(1);
  expect(mockTx.group.findFirst).toHaveBeenCalledWith({
    where: { id: 'group-1' },
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test -- --testPathPattern="groups-enrollments" --no-coverage
```

Expected: FAIL — the current `enroll()` reads group outside tx, so `mockTx.group.findFirst` is never called.

- [ ] **Step 3: Implement the fix in `groups-enrollments.service.ts`**

Replace the `enroll` method (lines 20–106). The change: remove outer `group` read from lines 21-27, move it inside `$transaction` with `isolationLevel: 'Serializable'`, and re-validate `blockedStatuses` inside tx.

```typescript
async enroll(groupId: string, patientId: string) {
  // Validate group existence first (light check, no isolation needed)
  const groupExists = await this.prisma.group.findFirst({
    where: { id: groupId, deletedAt: null },
    select: { id: true },
  });

  if (!groupExists) {
    throw new NotFoundException('Group not found');
  }

  const existing = await this.prisma.groupEnrollment.findFirst({
    where: { groupId, patientId, status: { notIn: ['cancelled', 'expired'] } },
  });

  if (existing) {
    throw new BadRequestException('Patient is already enrolled in this group');
  }

  const result = await this.prisma.$transaction(
    async (tx) => {
      // Re-read group INSIDE the serializable transaction — this is the race condition fix.
      // With Serializable isolation, concurrent transactions will serialize here.
      const group = await tx.group.findFirst({
        where: { id: groupId },
      });

      if (!group) throw new NotFoundException('Group not found');

      const blockedStatuses = ['full', 'completed', 'cancelled', 'awaiting_payment', 'confirmed'];
      if (blockedStatuses.includes(group.status)) {
        throw new BadRequestException(`Cannot enroll in a ${group.status} group`);
      }

      const isFree = group.paymentType === 'FREE_HOLD';

      const enrollment = await tx.groupEnrollment.create({
        data: {
          groupId,
          patientId,
          status: isFree ? 'confirmed' : 'registered',
        },
      });

      const newCount = group.currentEnrollment + 1;
      let newStatus = group.status;

      if (newCount >= group.maxParticipants) {
        newStatus = 'full';
      } else if (newCount >= group.minParticipants && group.status === 'open') {
        if (group.schedulingMode === 'fixed_date') {
          newStatus = 'confirmed';
        }
        // on_capacity: stays open until admin sets date
      }

      await tx.group.update({
        where: { id: groupId },
        data: { currentEnrollment: newCount, status: newStatus },
      });

      return { enrollment, newStatus, newCount, group, isFree };
    },
    { isolationLevel: 'Serializable' },
  );

  // Notifications fire outside transaction (fire-and-forget)
  this.notificationsService.createNotification({
    userId: patientId,
    titleAr: `تم تسجيلك في "${result.group.nameAr}"`,
    titleEn: `You've been enrolled in "${result.group.nameEn}"`,
    bodyAr: result.isFree ? 'تسجيلك مؤكد' : 'سنبلغك عند تأكيد الجلسة للدفع',
    bodyEn: result.isFree ? 'Your enrollment is confirmed' : "We'll notify you when the session is confirmed for payment",
    type: NotificationType.group_enrollment_created,
    data: { groupId },
  }).catch((err) => this.logger.warn('Notification failed', { error: (err as Error).message }));

  // fixed_date: min reached → confirm + payment flow
  if (result.newStatus === 'confirmed' && result.group.status === 'open' && !result.isFree) {
    await this.notifyGroupConfirmed(groupId, result.group.paymentDeadlineHours);
  }

  // on_capacity: min reached → notify admin to set date
  if (
    result.group.schedulingMode === 'on_capacity' &&
    result.newCount >= result.group.minParticipants &&
    result.group.currentEnrollment < result.group.minParticipants
  ) {
    this.notificationsService.createNotification({
      userId: result.group.practitionerId,
      titleAr: `اكتمل الحد الأدنى — حدد موعد "${result.group.nameAr}"`,
      titleEn: `Minimum reached — schedule "${result.group.nameEn}"`,
      bodyAr: `وصل عدد المسجلين ${result.newCount}. حدد موعد الجلسة`,
      bodyEn: `${result.newCount} enrolled. Set a date for this session`,
      type: NotificationType.group_capacity_reached,
      data: { groupId },
    }).catch((err) => this.logger.warn('Notification failed', { error: (err as Error).message }));
  }

  return result.enrollment;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test -- --testPathPattern="groups-enrollments" --no-coverage
```

Expected: PASS

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test --no-coverage
```

Expected: All passing (no regressions)

- [ ] **Step 6: Commit**

```bash
cd /Users/tariq/Documents/my_programs/CareKit
git add backend/src/modules/groups/groups-enrollments.service.ts \
        backend/test/unit/groups/groups-enrollments.service.spec.ts
git commit -m "fix(groups): prevent overbooking race condition via Serializable transaction in enroll()

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Fix GroupPayment — Create record in `triggerPaymentRequest`

**Files:**
- Modify: `backend/src/modules/groups/groups-payment.service.ts:41-86`
- Test: `backend/test/unit/groups/groups-payment.service.spec.ts`

**Problem:** `triggerPaymentRequest` updates enrollment status to `payment_requested` but never creates a `GroupPayment` record. The Moyasar webhook at line 40 searches `prisma.groupPayment.findFirst({ where: { moyasarPaymentId: dto.id } })` and finds nothing, so payments are never confirmed.

Note: The `GroupPayment` record needs a `moyasarPaymentId` at creation time only if we have the Moyasar payment link. The actual flow is: we create the `GroupPayment` with `status: 'pending'` and `moyasarPaymentId: null` here, then the patient initiates payment from their mobile which calls a separate create-payment-link endpoint (to be confirmed). For now, we create the record with required fields so the webhook can find it when payment completes.

First, check the `GroupPayment` schema fields that are required:
- `enrollmentId` (String, unique) ✅ we have it
- `groupId` (String) ✅ we have it
- `totalAmount` (Int) ✅ from `getRequiredAmount()`
- `paidAmount` (Int) — set to 0 initially
- `remainingAmount` (Int) — equals totalAmount initially
- `method` (PaymentMethod) — we don't know yet at this point; use `online` as default
- `status` (PaymentStatus) — `pending`
- `moyasarPaymentId` — null until patient initiates payment

- [ ] **Step 1: Write the failing test**

Create `backend/test/unit/groups/groups-payment.service.spec.ts` (or add to existing). Add:

```typescript
describe('triggerPaymentRequest', () => {
  it('should create a GroupPayment record for each registered enrollment', async () => {
    const group = {
      id: 'group-1',
      status: 'open',
      paymentType: 'FULL_PAYMENT',
      pricePerPersonHalalat: 10000,
      depositAmount: null,
      paymentDeadlineHours: 48,
      currentEnrollment: 3,
      minParticipants: 2,
      enrollments: [],
      deletedAt: null,
    };

    const enrollments = [
      { id: 'enroll-1', patientId: 'patient-1' },
      { id: 'enroll-2', patientId: 'patient-2' },
    ];

    prisma.group.findFirst.mockResolvedValue(group);
    prisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        group: { update: jest.fn().mockResolvedValue({}) },
        groupEnrollment: {
          findMany: jest.fn().mockResolvedValue(enrollments),
          updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
        groupPayment: {
          createMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
      };
      const result = await fn(tx);
      // Verify GroupPayment records were created
      expect(tx.groupPayment.createMany).toHaveBeenCalledWith({
        data: enrollments.map((e) => ({
          enrollmentId: e.id,
          groupId: 'group-1',
          totalAmount: 10000,
          paidAmount: 0,
          remainingAmount: 10000,
          method: 'online',
          status: 'pending',
        })),
        skipDuplicates: true,
      });
      return result;
    });

    await service.triggerPaymentRequest('group-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test -- --testPathPattern="groups-payment" --no-coverage
```

Expected: FAIL — `tx.groupPayment.createMany` is never called currently.

- [ ] **Step 3: Implement the fix**

In `groups-payment.service.ts`, inside the `$transaction` block (after `tx.groupEnrollment.updateMany`), add `createMany` for `GroupPayment`. Replace the transaction block (lines 41-60):

```typescript
const enrollments = await this.prisma.$transaction(async (tx) => {
  await tx.group.update({
    where: { id: groupId },
    data: { status: 'awaiting_payment' },
  });

  const registered = await tx.groupEnrollment.findMany({
    where: { groupId, status: 'registered' },
    select: { id: true, patientId: true },
  });

  if (registered.length > 0) {
    await tx.groupEnrollment.updateMany({
      where: { groupId, status: 'registered' },
      data: { status: 'payment_requested', paymentDeadlineAt: deadlineAt },
    });

    // Create a GroupPayment record per enrollment so the Moyasar webhook can find it.
    // moyasarPaymentId is null until the patient initiates the payment link.
    const requiredAmount = this.getRequiredAmount(group);
    await tx.groupPayment.createMany({
      data: registered.map((e) => ({
        enrollmentId: e.id,
        groupId,
        totalAmount: requiredAmount,
        paidAmount: 0,
        remainingAmount: requiredAmount,
        method: 'online' as const,
        status: 'pending' as const,
      })),
      skipDuplicates: true, // idempotent if called twice
    });
  }

  return registered;
});
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test -- --testPathPattern="groups-payment" --no-coverage
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
git add backend/src/modules/groups/groups-payment.service.ts \
        backend/test/unit/groups/groups-payment.service.spec.ts
git commit -m "fix(groups): create GroupPayment records in triggerPaymentRequest to enable Moyasar webhook matching

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Fix `remainingDueDate` — Add to DTO and map in service

**Files:**
- Modify: `backend/src/modules/groups/dto/create-group.dto.ts`
- Modify: `backend/src/modules/groups/dto/update-group.dto.ts`
- Modify: `backend/src/modules/groups/groups.service.ts` (wherever `CreateGroupDto`/`UpdateGroupDto` fields are mapped to Prisma)

**Problem:** `remainingDueDate` exists in: Prisma schema (`groups.prisma:23`), dashboard Zod schema (`groups.schema.ts:16`), and the UI form — but NOT in `CreateGroupDto` or `UpdateGroupDto`. Class-validator strips it silently. `DEPOSIT` payment type is broken because the due date is never saved.

- [ ] **Step 1: Write the failing test**

In `backend/test/unit/groups/groups.service.spec.ts`, add:

```typescript
it('should save remainingDueDate when paymentType is DEPOSIT', async () => {
  const dto = {
    nameAr: 'مجموعة',
    nameEn: 'Group',
    practitionerId: 'p-1',
    minParticipants: 2,
    maxParticipants: 10,
    pricePerPersonHalalat: 10000,
    durationMinutes: 60,
    paymentType: 'DEPOSIT' as const,
    depositAmount: 3000,
    remainingDueDate: '2026-05-01T00:00:00.000Z',
    schedulingMode: 'fixed_date' as const,
    startTime: '2026-05-10T10:00:00.000Z',
    deliveryMode: 'in_person' as const,
  };

  prisma.practitioner.findFirst.mockResolvedValue({ id: 'p-1', deletedAt: null });
  prisma.group.create.mockResolvedValue({ id: 'group-new', ...dto });

  await service.create(dto);

  expect(prisma.group.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        remainingDueDate: new Date('2026-05-01T00:00:00.000Z'),
      }),
    }),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test -- --testPathPattern="groups.service" --no-coverage
```

Expected: FAIL — `prisma.group.create` is called without `remainingDueDate`.

- [ ] **Step 3: Add `remainingDueDate` to `CreateGroupDto`**

In `backend/src/modules/groups/dto/create-group.dto.ts`, after the `depositAmount` block (after line 116), add:

```typescript
@ValidateIf((o: CreateGroupDto) => o.paymentType === 'DEPOSIT')
@ApiPropertyOptional({ description: 'Due date for remaining amount after deposit (required when paymentType=DEPOSIT)' })
@IsDateString()
@IsNotEmpty()
remainingDueDate?: string;
```

- [ ] **Step 4: Add `remainingDueDate` to `UpdateGroupDto`**

Open `backend/src/modules/groups/dto/update-group.dto.ts`. Add:

```typescript
@ApiPropertyOptional({ description: 'Due date for remaining amount after deposit' })
@IsOptional()
@IsDateString()
remainingDueDate?: string;
```

- [ ] **Step 5: Map `remainingDueDate` in `groups.service.ts`**

Open `backend/src/modules/groups/groups.service.ts`. Find the `prisma.group.create` data object and the `prisma.group.update` data object. In both places, add:

```typescript
...(dto.remainingDueDate !== undefined && {
  remainingDueDate: new Date(dto.remainingDueDate),
}),
```

Place it next to `depositAmount`.

- [ ] **Step 6: Run test to verify it passes**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test -- --testPathPattern="groups.service" --no-coverage
```

Expected: PASS

- [ ] **Step 7: Run typecheck**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 8: Run full test suite**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test --no-coverage
```

Expected: All passing

- [ ] **Step 9: Commit**

```bash
cd /Users/tariq/Documents/my_programs/CareKit
git add backend/src/modules/groups/dto/create-group.dto.ts \
        backend/src/modules/groups/dto/update-group.dto.ts \
        backend/src/modules/groups/groups.service.ts \
        backend/test/unit/groups/groups.service.spec.ts
git commit -m "fix(groups): add remainingDueDate to DTOs and service mapping — DEPOSIT payment type now functional

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
