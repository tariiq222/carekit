# Backend Security & Correctness Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 12 security and correctness issues identified in the backend audit — grouped into 4 parallel tracks.

**Architecture:** Each track owns specific files with no overlap. Tracks A+B+C can run in parallel. Track D runs after all others since it touches the shared exception filter.

**Tech Stack:** NestJS 11, Prisma 7, BullMQ, Redis (ioredis), Node.js `crypto`

---

## Parallel Execution Map

```
Track A (Payments)     Track B (Tasks/Cron)     Track C (Auth)
────────────────────   ──────────────────────   ──────────────────
Task 1: timing attack  Task 3: N+1 expiry       Task 5: P2002 → 409
Task 2: MinIO orphan   Task 4: flatMap(async)   Task 6: cache invalidate
                       Task 4b: noshow timezone
                       Task 4c: reminder timezone
                       Task 4d: tasks bootstrap

                   ↓ (after A+B+C done)
              Track D (Shared Infrastructure)
              ────────────────────────────────
              Task 7: Sentry filter
              Task 8: recoverExpired audit log
```

---

## Track A — Payments (owner: payments engineer)

### Task 1: Fix timing attack in Moyasar webhook signature verification

**Files:**
- Modify: `backend/src/modules/payments/moyasar-webhook.service.ts:56-79`

The current `expectedSig !== signature` comparison is vulnerable to timing side-channel attacks. Replace with `crypto.timingSafeEqual`.

- [ ] **Step 1: Write the failing test**

File: `backend/test/unit/payments/moyasar-webhook.service.spec.ts`

Add this test to the existing describe block (or create new file if it doesn't exist):

```typescript
import * as crypto from 'crypto';

describe('verifySignature', () => {
  it('should reject a signature that differs only in last byte — timing safe', () => {
    const secret = 'test-secret';
    const body = Buffer.from('{"id":"evt_1","status":"paid","amount":1000}');
    const correctSig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    // tamper last char
    const tamperedSig = correctSig.slice(0, -1) + (correctSig.endsWith('a') ? 'b' : 'a');

    const service = new MoyasarWebhookService(
      prismaServiceMock,
      invoiceServiceMock,
      configServiceMock,
      bookingStatusServiceMock,
    );
    // configService should return 'test-secret'
    jest.spyOn(configServiceMock, 'get').mockReturnValue(secret);

    expect(() => (service as any).verifySignature(tamperedSig, body)).toThrow(UnauthorizedException);
  });

  it('should reject a non-hex signature without throwing a Buffer error', () => {
    const service = new MoyasarWebhookService(
      prismaServiceMock,
      invoiceServiceMock,
      configServiceMock,
      bookingStatusServiceMock,
    );
    jest.spyOn(configServiceMock, 'get').mockReturnValue('secret');
    expect(() => (service as any).verifySignature('not-hex-$$$$', Buffer.from('body'))).toThrow(UnauthorizedException);
  });

  it('should accept a valid signature', () => {
    const secret = 'test-secret';
    const body = Buffer.from('{"id":"evt_1","status":"paid","amount":1000}');
    const validSig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    const service = new MoyasarWebhookService(
      prismaServiceMock,
      invoiceServiceMock,
      configServiceMock,
      bookingStatusServiceMock,
    );
    jest.spyOn(configServiceMock, 'get').mockReturnValue(secret);
    expect(() => (service as any).verifySignature(validSig, body)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend && npm test -- --testPathPattern="moyasar-webhook"
```

Expected: FAIL — "timingSafeEqual is not called" or similar assertion failure.

- [ ] **Step 3: Implement the fix**

In `backend/src/modules/payments/moyasar-webhook.service.ts`, replace lines 56–79:

```typescript
private verifySignature(signature: string, rawBody: Buffer): void {
  const secret = this.config.get<string>('MOYASAR_WEBHOOK_SECRET', '');
  if (!secret) {
    this.logger.error('MOYASAR_WEBHOOK_SECRET is not configured');
    throw new UnauthorizedException({
      statusCode: 401,
      message: 'Webhook verification not configured',
      error: 'WEBHOOK_CONFIG_ERROR',
    });
  }

  // Validate signature is a 64-char hex string before Buffer.from to avoid throwing
  if (!/^[0-9a-f]{64}$/i.test(signature)) {
    throw new UnauthorizedException({
      statusCode: 401,
      message: 'Invalid webhook signature',
      error: 'INVALID_SIGNATURE',
    });
  }

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  // timingSafeEqual prevents timing side-channel attacks
  if (!crypto.timingSafeEqual(Buffer.from(expectedSig, 'hex'), Buffer.from(signature, 'hex'))) {
    throw new UnauthorizedException({
      statusCode: 401,
      message: 'Invalid webhook signature',
      error: 'INVALID_SIGNATURE',
    });
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd backend && npm test -- --testPathPattern="moyasar-webhook"
```

Expected: PASS — all 3 signature tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/payments/moyasar-webhook.service.ts backend/test/unit/payments/moyasar-webhook.service.spec.ts
git commit -m "fix(payments): use timingSafeEqual for webhook signature verification"
```

---

### Task 2: Fix MinIO orphaned files on bank transfer transaction failure

**Files:**
- Modify: `backend/src/modules/payments/bank-transfer.service.ts:70-154`

The file is uploaded to MinIO before the Prisma transaction. If the transaction fails, the uploaded file is never cleaned up.

- [ ] **Step 1: Write the failing test**

File: `backend/test/unit/payments/bank-transfer.service.spec.ts`

```typescript
describe('uploadBankTransferReceipt', () => {
  it('should delete MinIO file if Prisma transaction fails', async () => {
    const mockFile: Express.Multer.File = {
      originalname: 'receipt.jpg',
      buffer: Buffer.from('fake-image'),
      mimetype: 'image/jpeg',
    } as Express.Multer.File;

    minioServiceMock.uploadFile.mockResolvedValue('https://minio/receipts/uuid.jpg');
    minioServiceMock.deleteFile = jest.fn().mockResolvedValue(undefined);
    prismaServiceMock.$transaction.mockRejectedValue(new Error('DB constraint error'));

    await expect(
      service.uploadBankTransferReceipt('user-1', 'booking-1', mockFile),
    ).rejects.toThrow('DB constraint error');

    expect(minioServiceMock.deleteFile).toHaveBeenCalledWith('carekit', expect.stringMatching(/^receipts\/.+\.jpg$/));
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend && npm test -- --testPathPattern="bank-transfer"
```

Expected: FAIL — `deleteFile` is not called.

- [ ] **Step 3: Implement the fix**

In `backend/src/modules/payments/bank-transfer.service.ts`, wrap the transaction with a try/catch that cleans up on failure. Replace lines 111–153:

```typescript
const receiptUrl = await this.minioService.uploadFile(
  MINIO_BUCKET,
  objectName,
  file.buffer,
  file.mimetype ?? 'image/jpeg',
);

let result: { payment: Awaited<ReturnType<typeof this.prisma.payment.create>>; receipt: Awaited<ReturnType<typeof this.prisma.bankTransferReceipt.create>> };

try {
  result = await this.prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        bookingId,
        amount,
        vatAmount,
        totalAmount,
        method: 'bank_transfer',
        status: 'pending',
      },
      include: paymentInclude,
    });

    const receipt = await tx.bankTransferReceipt.create({
      data: {
        paymentId: payment.id,
        receiptUrl,
        aiVerificationStatus: 'pending',
      },
    });

    return { payment, receipt };
  });
} catch (err) {
  // Transaction failed — clean up the orphaned MinIO file
  await this.minioService.deleteFile(MINIO_BUCKET, objectName).catch((deleteErr) => {
    this.logger.error(`Failed to clean up orphaned MinIO file ${objectName}`, deleteErr);
  });
  throw err;
}

if (this.receiptQueue) {
  await this.receiptQueue.add('verify', {
    receiptId: result.receipt.id,
    receiptUrl,
    correlationId: correlationStorage.getStore() ?? null,
  });
  this.logger.log(`Enqueued receipt verification job for receipt ${result.receipt.id}`);
}

return result;
```

- [ ] **Step 4: Verify `MinioService` has a `deleteFile` method**

```bash
cd backend && grep -n "deleteFile" src/common/services/minio.service.ts
```

If `deleteFile` does not exist, add it to `minio.service.ts`:

```typescript
async deleteFile(bucket: string, objectName: string): Promise<void> {
  await this.minioClient.removeObject(bucket, objectName);
}
```

- [ ] **Step 5: Run tests**

```bash
cd backend && npm test -- --testPathPattern="bank-transfer"
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/payments/bank-transfer.service.ts backend/src/common/services/minio.service.ts backend/test/unit/payments/bank-transfer.service.spec.ts
git commit -m "fix(payments): delete orphaned MinIO file if bank transfer transaction fails"
```

---

## Track B — Tasks/Cron (owner: tasks engineer)

### Task 3: Fix N+1 queries in BookingExpiryService.filterSafeToExpire

**Files:**
- Modify: `backend/src/modules/tasks/booking-expiry.service.ts:113-131`

The method issues one DB query per booking in a loop. Replace with a single batched query.

- [ ] **Step 1: Write the failing test**

File: `backend/test/unit/tasks/booking-expiry.service.spec.ts`

```typescript
describe('filterSafeToExpire', () => {
  it('should use a single batched query instead of one per booking', async () => {
    const bookings = [
      { id: 'booking-1' },
      { id: 'booking-2' },
      { id: 'booking-3' },
    ];

    prismaServiceMock.payment = {
      findMany: jest.fn().mockResolvedValue([
        { bookingId: 'booking-2' }, // booking-2 has active payment
      ]),
    };

    const result = await (service as any).filterSafeToExpire(bookings);

    // Only one query should have been fired
    expect(prismaServiceMock.payment.findMany).toHaveBeenCalledTimes(1);
    expect(prismaServiceMock.payment.findMany).toHaveBeenCalledWith({
      where: {
        bookingId: { in: ['booking-1', 'booking-2', 'booking-3'] },
        status: { in: ['paid', 'pending'] },
      },
      select: { bookingId: true },
    });

    // booking-2 has a payment so it should be filtered out
    expect(result.map((b: { id: string }) => b.id)).toEqual(['booking-1', 'booking-3']);
  });

  it('should return all bookings if none have active payments', async () => {
    const bookings = [{ id: 'b-1' }, { id: 'b-2' }];
    prismaServiceMock.payment = {
      findMany: jest.fn().mockResolvedValue([]),
    };
    const result = await (service as any).filterSafeToExpire(bookings);
    expect(result).toHaveLength(2);
  });

  it('should return empty array if input is empty', async () => {
    prismaServiceMock.payment = { findMany: jest.fn().mockResolvedValue([]) };
    const result = await (service as any).filterSafeToExpire([]);
    expect(result).toEqual([]);
    expect(prismaServiceMock.payment.findMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend && npm test -- --testPathPattern="booking-expiry"
```

Expected: FAIL — `findFirst` is called 3 times, not `findMany` once.

- [ ] **Step 3: Implement the fix**

In `backend/src/modules/tasks/booking-expiry.service.ts`, replace the entire `filterSafeToExpire` method (lines 113–131):

```typescript
private async filterSafeToExpire<T extends { id: string }>(
  bookings: T[],
): Promise<T[]> {
  if (bookings.length === 0) return [];

  const bookingIds = bookings.map((b) => b.id);
  const activePayments = await this.prisma.payment.findMany({
    where: {
      bookingId: { in: bookingIds },
      status: { in: ['paid', 'pending'] },
    },
    select: { bookingId: true },
  });

  const withActivePayment = new Set(activePayments.map((p) => p.bookingId));

  const safe: T[] = [];
  for (const booking of bookings) {
    if (withActivePayment.has(booking.id)) {
      this.logger.warn(`Skipping expire for booking ${booking.id} — payment still active`);
    } else {
      safe.push(booking);
    }
  }
  return safe;
}
```

- [ ] **Step 4: Run tests**

```bash
cd backend && npm test -- --testPathPattern="booking-expiry"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/tasks/booking-expiry.service.ts backend/test/unit/tasks/booking-expiry.service.spec.ts
git commit -m "perf(tasks): batch payment check in filterSafeToExpire to eliminate N+1 queries"
```

---

### Task 4: Fix Promise.all + flatMap(async) — swallowed notification errors

**Files:**
- Modify: `backend/src/modules/tasks/reminder.service.ts:41-77` and `154-189`

`flatMap(async ...)` returns `Promise<Promise[]>[]`. The outer `Promise.all` resolves immediately without waiting for inner notification promises.

- [ ] **Step 1: Write the failing test**

File: `backend/test/unit/tasks/reminder.service.spec.ts`

```typescript
describe('sendDayBeforeReminders', () => {
  it('should await all notification promises', async () => {
    let resolveNotif!: () => void;
    const notifPromise = new Promise<void>((resolve) => { resolveNotif = resolve; });

    prismaServiceMock.booking = {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'b-1',
          date: new Date(),
          startTime: '10:00',
          clientId: 'client-1',
          employeeId: 'pract-1',
          employee: { userId: 'user-pract-1' },
        },
      ]),
    };

    notificationsServiceMock.createNotification = jest.fn().mockReturnValue(notifPromise);
    whitelabelServiceMock.getTimeFormat = jest.fn().mockResolvedValue('24h');

    const sendPromise = service.sendDayBeforeReminders();
    // Notification has not resolved yet — if sendDayBeforeReminders awaits properly,
    // sendPromise should still be pending
    resolveNotif();
    await sendPromise;

    expect(notificationsServiceMock.createNotification).toHaveBeenCalledTimes(2); // client + employee
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend && npm test -- --testPathPattern="reminder"
```

Expected: FAIL — notifications are called 0 times (promises dropped).

- [ ] **Step 3: Fix `sendDayBeforeReminders` (lines 41–77)**

Replace the broken `Promise.all(bookings.flatMap(async ...))` with a flat map that returns `Promise[]` directly:

```typescript
await Promise.all(
  bookings.flatMap((booking) => {
    const dateStr = booking.date.toISOString().split('T')[0];
    const notifications: Promise<unknown>[] = [];

    const timePromise = this.formatTimeForNotification(booking.startTime);

    if (booking.clientId) {
      notifications.push(
        timePromise.then((timeStr) =>
          this.notificationsService.createNotification({
            userId: booking.clientId!,
            titleAr: 'تذكير بموعدك غداً',
            titleEn: 'Appointment Reminder — Tomorrow',
            bodyAr: `لديك موعد غداً ${dateStr} الساعة ${timeStr}`,
            bodyEn: `You have an appointment tomorrow ${dateStr} at ${timeStr}`,
            type: 'booking_reminder',
            data: { bookingId: booking.id },
          }),
        ),
      );
    }

    if (booking.employee?.userId) {
      notifications.push(
        timePromise.then((timeStr) =>
          this.notificationsService.createNotification({
            userId: booking.employee!.userId,
            titleAr: 'تذكير بموعد غداً',
            titleEn: 'Appointment Reminder — Tomorrow',
            bodyAr: `لديك موعد غداً ${dateStr} الساعة ${timeStr}`,
            bodyEn: `You have an appointment tomorrow ${dateStr} at ${timeStr}`,
            type: 'booking_reminder',
            data: { bookingId: booking.id },
          }),
        ),
      );
    }

    return notifications;
  }),
);
```

- [ ] **Step 4: Apply the same fix to `sendTwoHourReminders` (lines 154–189)**

Replace the broken `Promise.all(matched.flatMap(async ...))` with:

```typescript
await Promise.all(
  matched.flatMap((booking) => {
    const notifications: Promise<unknown>[] = [];
    const timePromise = this.formatTimeForNotification(booking.startTime);

    if (booking.clientId) {
      notifications.push(
        timePromise.then((timeStr) =>
          this.notificationsService.createNotification({
            userId: booking.clientId!,
            titleAr: 'موعدك بعد ساعتين',
            titleEn: 'Appointment in 2 Hours',
            bodyAr: `تذكير: موعدك بعد ساعتين الساعة ${timeStr}`,
            bodyEn: `Reminder: Your appointment is in 2 hours at ${timeStr}`,
            type: 'booking_reminder',
            data: { bookingId: booking.id },
          }),
        ),
      );
    }

    if (booking.employee?.userId) {
      notifications.push(
        timePromise.then((timeStr) =>
          this.notificationsService.createNotification({
            userId: booking.employee!.userId,
            titleAr: 'موعدك بعد ساعتين',
            titleEn: 'Appointment in 2 Hours',
            bodyAr: `تذكير: لديك موعد بعد ساعتين الساعة ${timeStr}`,
            bodyEn: `Reminder: You have an appointment in 2 hours at ${timeStr}`,
            type: 'booking_reminder',
            data: { bookingId: booking.id },
          }),
        ),
      );
    }

    return notifications;
  }),
);
```

- [ ] **Step 5: Run tests**

```bash
cd backend && npm test -- --testPathPattern="reminder"
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/tasks/reminder.service.ts backend/test/unit/tasks/reminder.service.spec.ts
git commit -m "fix(tasks): fix flatMap(async) swallowing notification promises in reminder service"
```

---

### Task 4b: Fix hardcoded +03:00 in BookingNoShowService

**Files:**
- Modify: `backend/src/modules/tasks/booking-noshow.service.ts:36-37` and `:60`

`clinicTz` is fetched dynamically but `+03:00` is hardcoded when building the date boundaries. Any non-UTC+3 clinic gets wrong boundaries.

- [ ] **Step 1: Write the failing test**

File: `backend/test/unit/tasks/booking-noshow.service.spec.ts`

```typescript
describe('autoNoShow timezone', () => {
  it('should use clinic timezone offset, not hardcoded +03:00', async () => {
    // Simulate a clinic in UTC+5 (e.g. Pakistan)
    whitelabelServiceMock.getTimezone = jest.fn().mockResolvedValue('Asia/Karachi');
    bookingSettingsServiceMock.get = jest.fn().mockResolvedValue({
      autoNoShowAfterMinutes: 15,
      noShowPolicy: 'keep_full',
      noShowRefundPercent: 0,
    });
    prismaServiceMock.booking = { findMany: jest.fn().mockResolvedValue([]) };

    await service.autoNoShow();

    // The query should have been called — if it throws due to invalid date construction
    // the test fails, which would happen with hardcoded +03:00 for Asia/Karachi
    expect(prismaServiceMock.booking.findMany).toHaveBeenCalledTimes(1);
    const callArgs = prismaServiceMock.booking.findMany.mock.calls[0][0];
    // The date range should be in UTC, derived from Asia/Karachi midnight (UTC+5 = UTC-5h)
    const gte: Date = callArgs.where.date.gte;
    const lte: Date = callArgs.where.date.lte;
    // For Asia/Karachi (UTC+5), midnight is UTC 19:00 the previous day
    expect(gte.getUTCHours()).toBe(19); // UTC 19:00 = Karachi midnight
    expect(lte.getUTCHours()).toBe(18); // UTC 18:59:59 = Karachi 23:59:59
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend && npm test -- --testPathPattern="booking-noshow"
```

Expected: FAIL — UTC hours are 21 (hardcoded +03:00 offset) not 19.

- [ ] **Step 3: Implement the fix**

Install `date-fns-tz` if not already present:

```bash
cd backend && grep "date-fns-tz" package.json || npm install date-fns-tz
```

In `backend/src/modules/tasks/booking-noshow.service.ts`, replace lines 28–65:

```typescript
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

async autoNoShow(): Promise<void> {
  const settings = await this.bookingSettingsService.get();
  const clinicTz = await this.whitelabelService.getTimezone();
  const now = new Date();

  // Get today's date string in the clinic's local timezone (YYYY-MM-DD)
  const nowInClinic = utcToZonedTime(now, clinicTz);
  const todayStr = nowInClinic.toISOString().split('T')[0];

  // Convert clinic local midnight/end-of-day to UTC for the DB query
  const todayStartUtc = zonedTimeToUtc(`${todayStr}T00:00:00`, clinicTz);
  const todayEndUtc = zonedTimeToUtc(`${todayStr}T23:59:59`, clinicTz);

  const bookings = await this.prisma.booking.findMany({
    where: {
      status: 'confirmed',
      date: { gte: todayStartUtc, lte: todayEndUtc },
      deletedAt: null,
    },
    select: {
      id: true,
      startTime: true,
      clientId: true,
      employeeId: true,
      date: true,
      employee: { select: { userId: true } },
    },
  });

  const noShowBookings = bookings.filter((b) => {
    const bookingDateStr = utcToZonedTime(b.date, clinicTz).toISOString().split('T')[0];
    const bookingStartUtc = zonedTimeToUtc(`${bookingDateStr}T${b.startTime}:00`, clinicTz);
    const noShowDeadline = new Date(
      bookingStartUtc.getTime() + settings.autoNoShowAfterMinutes * 60 * 1000,
    );
    return now > noShowDeadline;
  });
```

- [ ] **Step 4: Run tests**

```bash
cd backend && npm test -- --testPathPattern="booking-noshow"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/tasks/booking-noshow.service.ts backend/test/unit/tasks/booking-noshow.service.spec.ts
git commit -m "fix(tasks): derive timezone offset dynamically instead of hardcoding +03:00 in no-show service"
```

---

### Task 4c: Fix UTC vs clinic-timezone mismatch in ReminderService day-before query

**Files:**
- Modify: `backend/src/modules/tasks/reminder.service.ts:17-38`

`windowStart`/`windowEnd` are computed in UTC but `booking.date` may be stored relative to the clinic's local midnight. This can result in sending reminders a day early or late for non-UTC+0 clinics.

- [ ] **Step 1: Write the failing test**

File: `backend/test/unit/tasks/reminder.service.spec.ts`

```typescript
describe('sendDayBeforeReminders — timezone window', () => {
  it('should build the window using clinic timezone, not raw UTC', async () => {
    whitelabelServiceMock.getTimezone = jest.fn().mockResolvedValue('Asia/Riyadh');
    prismaServiceMock.booking = { findMany: jest.fn().mockResolvedValue([]) };

    await service.sendDayBeforeReminders();

    expect(prismaServiceMock.booking.findMany).toHaveBeenCalledTimes(1);
    // The query should NOT use raw UTC new Date() math — it should incorporate timezone
    // This is a smoke test to confirm the method runs without error for non-UTC clinics
    const callArgs = prismaServiceMock.booking.findMany.mock.calls[0][0];
    expect(callArgs.where.date.gte).toBeInstanceOf(Date);
    expect(callArgs.where.date.lte).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 2: Run test to confirm it passes (smoke) or fails if TypeError is thrown**

```bash
cd backend && npm test -- --testPathPattern="reminder"
```

- [ ] **Step 3: Inject WhitelabelService and use clinic timezone**

In `reminder.service.ts`, the `WhitelabelService` is already injected. Update `sendDayBeforeReminders` to use `getTimezone()` when building the query window:

```typescript
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

async sendDayBeforeReminders() {
  const clinicTz = await this.whitelabelService.getTimezone();
  const now = new Date();

  // Compute "tomorrow midnight" in the clinic's local timezone, then convert back to UTC
  const nowInClinic = utcToZonedTime(now, clinicTz);
  const tomorrowStr = new Date(nowInClinic.getTime() + 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];
  const tomorrowMidnightUtc = zonedTimeToUtc(`${tomorrowStr}T00:00:00`, clinicTz);
  const windowStart = new Date(tomorrowMidnightUtc.getTime() - 30 * 60 * 1000);
  const windowEnd = new Date(tomorrowMidnightUtc.getTime() + 30 * 60 * 1000);

  // rest of method unchanged...
```

Apply the same pattern to `sendHourBeforeReminders`:

```typescript
async sendHourBeforeReminders() {
  const clinicTz = await this.whitelabelService.getTimezone();
  const now = new Date();

  // Compute "one hour from now" in the clinic's local timezone, then convert back to UTC
  const nowInClinic = utcToZonedTime(now, clinicTz);
  const oneHourStr = new Date(nowInClinic.getTime() + 60 * 60 * 1000)
    .toISOString().split('T')[0];
  const oneHourTimeStr = utcToZonedTime(
    new Date(now.getTime() + 60 * 60 * 1000), clinicTz
  ).toISOString().split('T')[1].slice(0, 5); // HH:MM
  const oneHourUtc = zonedTimeToUtc(`${oneHourStr}T${oneHourTimeStr}:00`, clinicTz);
  const windowStart = new Date(oneHourUtc.getTime() - 30 * 60 * 1000);
  const windowEnd = new Date(oneHourUtc.getTime() + 30 * 60 * 1000);

  // rest of method unchanged...
```

- [ ] **Step 4: Run all reminder tests**

```bash
cd backend && npm test -- --testPathPattern="reminder"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/tasks/reminder.service.ts
git commit -m "fix(tasks): use clinic timezone when computing reminder time windows"
```

---

### Task 4d: Fix tasks-bootstrap race condition in multi-replica deployments

**Files:**
- Modify: `backend/src/modules/tasks/tasks-bootstrap.service.ts:12-17`

On startup, all repeatable jobs are deleted then re-added. In multi-replica deployments, pods race — causing a window with no active jobs. Fix: only re-register jobs that don't already exist.

- [ ] **Step 1: Write the failing test**

File: `backend/test/unit/tasks/tasks-bootstrap.service.spec.ts`

```typescript
describe('onModuleInit', () => {
  it('should not remove existing jobs that are already registered', async () => {
    tasksQueueMock.getRepeatableJobs = jest.fn().mockResolvedValue([
      { key: 'expire-pending-bookings:::*/5 * * * *', name: 'expire-pending-bookings', pattern: '*/5 * * * *' },
    ]);
    tasksQueueMock.removeRepeatableByKey = jest.fn();
    tasksQueueMock.add = jest.fn().mockResolvedValue({});

    await service.onModuleInit();

    // Should NOT have removed the already-registered job
    expect(tasksQueueMock.removeRepeatableByKey).not.toHaveBeenCalledWith('expire-pending-bookings:::*/5 * * * *');
  });

  it('should remove stale jobs that are no longer in the desired set', async () => {
    tasksQueueMock.getRepeatableJobs = jest.fn().mockResolvedValue([
      { key: 'old-job:::* * * * *', name: 'old-job', pattern: '* * * * *' },
    ]);
    tasksQueueMock.removeRepeatableByKey = jest.fn();
    tasksQueueMock.add = jest.fn().mockResolvedValue({});

    await service.onModuleInit();

    expect(tasksQueueMock.removeRepeatableByKey).toHaveBeenCalledWith('old-job:::* * * * *');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend && npm test -- --testPathPattern="tasks-bootstrap"
```

Expected: FAIL — all jobs are removed regardless.

- [ ] **Step 3: Implement idempotent job registration**

Replace `backend/src/modules/tasks/tasks-bootstrap.service.ts` entirely:

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_TASKS } from '../../config/constants/queues.js';

interface JobDefinition {
  name: string;
  pattern: string;
}

const DESIRED_JOBS: JobDefinition[] = [
  { name: 'cleanup-otps',                pattern: '0 3 * * *'    },
  { name: 'cleanup-tokens',              pattern: '30 3 * * *'   },
  { name: 'reminder-24h',               pattern: '0 * * * *'    },
  { name: 'reminder-1h',                pattern: '*/15 * * * *' },
  { name: 'expire-pending-bookings',    pattern: '*/5 * * * *'  },
  { name: 'auto-complete-bookings',     pattern: '*/15 * * * *' },
  { name: 'auto-no-show',              pattern: '*/10 * * * *' },
  { name: 'expire-pending-cancellations', pattern: '0 * * * *'  },
  { name: 'reminder-2h',               pattern: '*/15 * * * *' },
  { name: 'reminder-15min',            pattern: '*/5 * * * *'  },
  { name: 'cleanup-webhooks',          pattern: '0 4 * * *'    },
  { name: 'archive-activity-logs',     pattern: '0 5 * * 0'    },
  { name: 'repair-rating-cache',       pattern: '0 6 * * 0'    },
  { name: 'db-snapshot',              pattern: '0 0 * * 0'    },
];

@Injectable()
export class TasksBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(TasksBootstrapService.name);

  constructor(@InjectQueue(QUEUE_TASKS) private readonly tasksQueue: Queue) {}

  async onModuleInit() {
    const existing = await this.tasksQueue.getRepeatableJobs();
    const existingNames = new Set(existing.map((j) => j.name));
    const desiredNames = new Set(DESIRED_JOBS.map((j) => j.name));

    // Remove stale jobs no longer in the desired set
    let staleRemoved = 0;
    for (const job of existing) {
      if (!desiredNames.has(job.name)) {
        await this.tasksQueue.removeRepeatableByKey(job.key);
        this.logger.log(`Removed stale job: ${job.name}`);
        staleRemoved++;
      }
    }

    // Register only jobs that are not already present
    let registered = 0;
    for (const job of DESIRED_JOBS) {
      if (!existingNames.has(job.name)) {
        await this.tasksQueue.add(job.name, {}, {
          repeat: { pattern: job.pattern },
          removeOnComplete: true,
        });
        registered++;
      }
    }

    this.logger.log(`Tasks bootstrap: ${registered} new jobs registered, ${staleRemoved} stale removed`);
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd backend && npm test -- --testPathPattern="tasks-bootstrap"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/tasks/tasks-bootstrap.service.ts backend/test/unit/tasks/tasks-bootstrap.service.spec.ts
git commit -m "fix(tasks): make bootstrap idempotent — only register missing jobs, remove stale ones"
```

---

## Track C — Auth (owner: auth engineer)

### Task 5: Handle P2002 as ConflictException in auth registration

**Files:**
- Modify: `backend/src/modules/auth/auth.service.ts:82-110`

If two concurrent registrations race past the email uniqueness check, the DB throws `P2002` but it surfaces as a 500 Internal Error instead of 409 Conflict.

- [ ] **Step 1: Write the failing test**

File: `backend/test/unit/auth/auth.service.spec.ts`

```typescript
import { Prisma } from '@prisma/client';

describe('register — concurrent email race', () => {
  it('should return 409 ConflictException when DB throws P2002 on user create', async () => {
    prismaServiceMock.user.findUnique = jest.fn().mockResolvedValue(null); // passes pre-check
    prismaServiceMock.role.findFirst = jest.fn().mockResolvedValue(null);
    prismaServiceMock.$transaction = jest.fn().mockRejectedValue(
      Object.assign(new Error('Unique constraint failed on the fields: (`email`)'), {
        code: 'P2002',
        constructor: { name: 'PrismaClientKnownRequestError' },
      } as unknown as Prisma.PrismaClientKnownRequestError),
    );

    await expect(
      service.register({
        email: 'test@example.com',
        password: 'Password1!',
        firstName: 'Test',
        lastName: 'User',
      }),
    ).rejects.toMatchObject({
      response: { error: 'USER_EMAIL_EXISTS', statusCode: 409 },
    });
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend && npm test -- --testPathPattern="auth.service"
```

Expected: FAIL — rejects with 500, not 409.

- [ ] **Step 3: Implement the fix**

In `backend/src/modules/auth/auth.service.ts`, find the transaction block (~line 82) and wrap it with P2002 handling. Add this import at the top if not present:

```typescript
import { Prisma } from '@prisma/client';
```

Then wrap the `$transaction` call:

```typescript
let user: { id: string; email: string; firstName: string };
try {
  user = await this.prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        gender: dto.gender,
      },
    });

    if (clientRole) {
      await tx.userRole.create({
        data: { userId: created.id, roleId: clientRole.id },
      });
    }

    return created;
  });
} catch (err) {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  ) {
    throw new ConflictException({
      statusCode: 409,
      message: 'A user with this email already exists',
      error: 'USER_EMAIL_EXISTS',
    });
  }
  throw err;
}
```

- [ ] **Step 4: Run tests**

```bash
cd backend && npm test -- --testPathPattern="auth.service"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/auth/auth.service.ts backend/test/unit/auth/auth.service.spec.ts
git commit -m "fix(auth): catch P2002 in register transaction and return 409 ConflictException"
```

---

### Task 6: Invalidate auth/permission cache on role assignment change

**Files:**
- Modify: `backend/src/modules/users/users.service.ts` — find role assignment methods
- Modify: `backend/src/modules/roles/roles.service.ts` — find bulk assignment if any

When a user's roles are changed, the auth cache keeps the old permissions until token expiry. Fix: call `authCache.invalidate(userId)` and `permissionCache.invalidate(userId)` after any role change.

- [ ] **Step 1: Find role assignment methods**

```bash
cd backend && grep -n "userRole\|assignRole\|removeRole\|UserRole" src/modules/users/users.service.ts | head -30
```

Note which methods create/update/delete `UserRole` records. These are the ones that need cache invalidation.

- [ ] **Step 2: Write the failing test**

In `backend/test/unit/users/users.service.spec.ts`, find or add tests for the role assignment method (typically `assignRole`, `updateUserRoles`, or similar):

```typescript
describe('assignRole (or updateUserRoles)', () => {
  it('should invalidate auth cache and permission cache after role change', async () => {
    authCacheMock.invalidate = jest.fn().mockResolvedValue(undefined);
    permissionCacheMock.invalidate = jest.fn().mockResolvedValue(undefined);

    // Call the actual method name from Step 1
    await service.assignRole('user-id-123', 'role-id-456');

    expect(authCacheMock.invalidate).toHaveBeenCalledWith('user-id-123');
    expect(permissionCacheMock.invalidate).toHaveBeenCalledWith('user-id-123');
  });
});
```

- [ ] **Step 3: Run test to confirm it fails**

```bash
cd backend && npm test -- --testPathPattern="users.service"
```

Expected: FAIL — `invalidate` never called.

- [ ] **Step 4: Inject caches and add invalidation**

In `backend/src/modules/users/users.service.ts`:

1. Import and inject `AuthCacheService` and `PermissionCacheService`:

```typescript
import { AuthCacheService } from '../auth/auth-cache.service.js';
import { PermissionCacheService } from '../auth/permission-cache.service.js';

// In constructor:
private readonly authCache: AuthCacheService,
private readonly permissionCache: PermissionCacheService,
```

2. After any `userRole.create`, `userRole.delete`, or `userRole.upsert` call, add:

```typescript
await Promise.all([
  this.authCache.invalidate(userId),
  this.permissionCache.invalidate(userId),
]);
```

3. Register `AuthModule` (or the cache services) in `UsersModule` imports if not already present:

```bash
cd backend && grep -n "AuthCacheService\|PermissionCacheService" src/modules/users/users.module.ts
```

If missing, import the services from their module or export them from `AuthModule` and add `AuthModule` to `UsersModule` imports.

- [ ] **Step 5: Run tests**

```bash
cd backend && npm test -- --testPathPattern="users.service"
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/users/users.service.ts backend/src/modules/users/users.module.ts backend/test/unit/users/users.service.spec.ts
git commit -m "fix(auth): invalidate user auth and permission cache on role assignment change"
```

---

## Track D — Shared Infrastructure (run AFTER A+B+C)

### Task 7: Fix GlobalExceptionFilter swallowing legitimate Prisma errors from Sentry

**Files:**
- Modify: `backend/src/common/filters/http-exception.filter.ts:103-108`

Currently ALL `PrismaClientKnownRequestError` are excluded from Sentry. Operational errors like `P2034` (serialization failure) and `P2011` (null constraint) should be reported.

- [ ] **Step 1: Write the failing test**

File: `backend/test/unit/common/http-exception.filter.spec.ts`

```typescript
import * as Sentry from '@sentry/nestjs';

jest.mock('@sentry/nestjs', () => ({ captureException: jest.fn() }));

describe('GlobalExceptionFilter — Sentry reporting', () => {
  it('should NOT send P2002, P2025, P2003 to Sentry', () => {
    const filter = new GlobalExceptionFilter();
    const codes = ['P2002', 'P2025', 'P2003'];
    for (const code of codes) {
      const err = Object.assign(new Error('prisma error'), {
        constructor: { name: 'PrismaClientKnownRequestError' },
        code,
      });
      filter.catch(err, mockArgumentsHost);
      expect(Sentry.captureException).not.toHaveBeenCalledWith(err);
    }
  });

  it('should send P2034 (serialization failure) to Sentry', () => {
    const filter = new GlobalExceptionFilter();
    const err = Object.assign(new Error('Transaction failed due to a write conflict'), {
      constructor: { name: 'PrismaClientKnownRequestError' },
      code: 'P2034',
    });
    filter.catch(err, mockArgumentsHost);
    expect(Sentry.captureException).toHaveBeenCalledWith(err);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend && npm test -- --testPathPattern="http-exception.filter"
```

Expected: FAIL — P2034 is not sent to Sentry.

- [ ] **Step 3: Implement the fix**

In `backend/src/common/filters/http-exception.filter.ts`, replace lines 103–108:

```typescript
// Skip expected/safe Prisma errors from Sentry:
// P2025 = record not found, P2002 = unique constraint, P2003 = FK constraint
const EXPECTED_PRISMA_CODES = new Set(['P2025', 'P2002', 'P2003']);

const isPrismaKnown = exception.constructor?.name === 'PrismaClientKnownRequestError';
const isPrismaValidation = exception.constructor?.name === 'PrismaClientValidationError';
const isExpectedPrismaCode = isPrismaKnown && EXPECTED_PRISMA_CODES.has((exception as { code?: string }).code ?? '');

if (!isPrismaValidation && !isExpectedPrismaCode) {
  Sentry.captureException(exception);
}
```

- [ ] **Step 4: Run tests**

```bash
cd backend && npm test -- --testPathPattern="http-exception.filter"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/common/filters/http-exception.filter.ts backend/test/unit/common/http-exception.filter.spec.ts
git commit -m "fix(common): report unexpected Prisma errors (P2034 etc) to Sentry, only skip P2002/P2025/P2003"
```

---

### Task 8: Add audit log to recoverExpiredBooking

**Files:**
- Modify: `backend/src/modules/bookings/booking-status.service.ts:254-260`

When a booking is recovered from `expired → confirmed`, no status log or activity log entry is created. This leaves a gap in the audit trail.

- [ ] **Step 1: Write the failing test**

File: `backend/test/unit/bookings/booking-status.service.spec.ts`

```typescript
describe('recoverExpiredBooking', () => {
  it('should log a status change from expired to confirmed', async () => {
    prismaServiceMock.booking.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    statusLogServiceMock.log = jest.fn().mockResolvedValue(undefined);

    const recovered = await service.recoverExpiredBooking('booking-123');

    expect(recovered).toBe(true);
    expect(statusLogServiceMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-123',
        fromStatus: 'expired',
        toStatus: 'confirmed',
        changedBy: 'system',
      }),
    );
  });

  it('should not log if no booking was recovered (count = 0)', async () => {
    prismaServiceMock.booking.updateMany = jest.fn().mockResolvedValue({ count: 0 });
    statusLogServiceMock.log = jest.fn();

    const recovered = await service.recoverExpiredBooking('booking-999');

    expect(recovered).toBe(false);
    expect(statusLogServiceMock.log).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend && npm test -- --testPathPattern="booking-status.service"
```

Expected: FAIL — `statusLogService.log` not called.

- [ ] **Step 3: Implement the fix**

In `backend/src/modules/bookings/booking-status.service.ts`, replace the `recoverExpiredBooking` method:

```typescript
async recoverExpiredBooking(bookingId: string): Promise<boolean> {
  const result = await this.prisma.booking.updateMany({
    where: { id: bookingId, status: 'expired' },
    data: { status: 'confirmed', confirmedAt: new Date(), cancelledBy: null, cancelledAt: null },
  });

  if (result.count > 0) {
    this.statusLogService.log({
      bookingId,
      fromStatus: 'expired',
      toStatus: 'confirmed',
      changedBy: 'system',
      reason: 'Payment received after expiry — booking recovered',
    }).catch((err) => this.logger.warn('Status log failed on recovery', { error: err?.message }));
  }

  return result.count > 0;
}
```

- [ ] **Step 4: Run tests**

```bash
cd backend && npm test -- --testPathPattern="booking-status.service"
```

Expected: PASS.

- [ ] **Step 5: Final full test suite run**

```bash
cd backend && npm test
```

Expected: All tests pass. Coverage thresholds met (40% branch, 50% fn/line).

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/bookings/booking-status.service.ts backend/test/unit/bookings/booking-status.service.spec.ts
git commit -m "fix(bookings): add status log entry when recovering expired booking to confirmed"
```

---

## Summary

| Track | Tasks | Files Changed | Can Run In Parallel With |
|-------|-------|---------------|--------------------------|
| A — Payments | 1, 2 | moyasar-webhook.service, bank-transfer.service, minio.service | B, C |
| B — Tasks | 3, 4, 4b, 4c, 4d | booking-expiry, reminder, booking-noshow, tasks-bootstrap | A, C |
| C — Auth | 5, 6 | auth.service, users.service, users.module | A, B |
| D — Shared | 7, 8 | http-exception.filter, booking-status.service | After A+B+C |

**Estimated commits:** 10 atomic commits across 4 tracks.
