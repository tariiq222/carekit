# Test Coverage 85% Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** رفع تغطية Unit Tests للـ backend من 44.98% إلى 85%+ في Statements, Lines, Functions.

**Architecture:** كل مهمة تكتب spec file جديد أو تعزز spec موجود، باستخدام نفس نمط `booking-test-helpers.ts` (mock prisma + eventBus بدون NestJS testing module). كل spec يُفصل عن بقية المهام — لا dependencies بين الـ tasks.

**Tech Stack:** Jest, `@nestjs/testing` غير مستخدم (pure unit mocks), TypeScript strict, نمط `buildPrisma()` / `buildEventBus()` الموجود في `src/modules/bookings/testing/booking-test-helpers.ts`.

**نقطة البداية:** 44.98% Statements → الهدف 85% يتطلب تغطية ~130 وحدة إضافية.

---

## خريطة الملفات

### ملفات جديدة (specs)
| الملف | يغطي |
|-------|------|
| `src/modules/bookings/approve-cancel-booking/approve-cancel-booking.handler.spec.ts` | `approve-cancel-booking.handler.ts` |
| `src/modules/bookings/reject-cancel-booking/reject-cancel-booking.handler.spec.ts` | `reject-cancel-booking.handler.ts` |
| `src/modules/bookings/request-cancel-booking/request-cancel-booking.handler.spec.ts` | `request-cancel-booking.handler.ts` |
| `src/modules/bookings/payment-completed-handler/payment-completed.handler.spec.ts` | `payment-completed.handler.ts` |
| `src/modules/bookings/create-zoom-meeting/create-zoom-meeting.handler.spec.ts` | `create-zoom-meeting.handler.ts` |
| `src/modules/bookings/booking-lifecycle.helper.spec.ts` | `booking-lifecycle.helper.ts` |
| `src/modules/ops/log-activity/log-activity.handler.spec.ts` | `log-activity.handler.ts` |
| `src/modules/ops/log-activity/list-activity.handler.spec.ts` | `list-activity.handler.ts` |
| `src/modules/ops/health-check/health-check.handler.spec.ts` | `health-check.handler.ts` |
| `src/modules/ops/generate-report/generate-report.handler.spec.ts` | `generate-report.handler.ts` + builders |
| `src/modules/ops/cron-tasks/cron-tasks.service.spec.ts` | `cron-tasks.service.ts` |
| `src/modules/org-config/categories/categories.handler.spec.ts` | `create/list/update-category.handler.ts` |
| `src/modules/org-config/departments/departments.handler.spec.ts` | `create/list/update-department.handler.ts` |
| `src/modules/identity/shared/token.service.spec.ts` | `token.service.ts` |
| `src/modules/org-experience/services/price-resolver.service.spec.ts` | `price-resolver.service.ts` |
| `src/modules/bookings/list-bookings/list-bookings.handler.spec.ts` | يُعزَّز (36% → 85%) |
| `src/modules/finance/create-invoice/booking-confirmed.handler.spec.ts` | `booking-confirmed.handler.ts` (event handler) |
| `src/modules/finance/list-payments/list-payments.handler.spec.ts` | يُعزَّز (44% → 85%) |

---

## Task 1: `approve-cancel-booking` + `reject-cancel-booking` + `request-cancel-booking`

**Files:**
- Create: `src/modules/bookings/approve-cancel-booking/approve-cancel-booking.handler.spec.ts`
- Create: `src/modules/bookings/reject-cancel-booking/reject-cancel-booking.handler.spec.ts`
- Create: `src/modules/bookings/request-cancel-booking/request-cancel-booking.handler.spec.ts`

- [ ] **Step 1: اكتب الـ spec لـ ApproveCancelBookingHandler**

```typescript
// src/modules/bookings/approve-cancel-booking/approve-cancel-booking.handler.spec.ts
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { ApproveCancelBookingHandler } from './approve-cancel-booking.handler';
import { buildPrisma, buildEventBus, mockBooking } from '../testing/booking-test-helpers';

const cancelRequestedBooking = {
  ...mockBooking,
  status: 'CANCEL_REQUESTED' as BookingStatus,
  branchId: 'branch-1',
  clientId: 'client-1',
  employeeId: 'emp-1',
};

const defaultSettings = {
  execute: jest.fn().mockResolvedValue({ autoRefundOnCancel: true }),
};

describe('ApproveCancelBookingHandler', () => {
  it('approves cancel request and sets status to CANCELLED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CANCELLED });
    const eb = buildEventBus();
    const handler = new ApproveCancelBookingHandler(prisma as never, eb as never, defaultSettings as never);

    const result = await handler.execute({
      tenantId: 'tenant-1',
      bookingId: 'book-1',
      approvedBy: 'admin-1',
      approverNotes: 'Approved',
    });

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.CANCELLED }) }),
    );
    expect(eb.publish).toHaveBeenCalledWith('bookings.booking.cancel_approved', expect.anything());
    expect(result.autoRefund).toBe(true);
  });

  it('throws NotFoundException when booking not found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new ApproveCancelBookingHandler(prisma as never, buildEventBus() as never, defaultSettings as never);

    await expect(
      handler.execute({ tenantId: 'tenant-1', bookingId: 'bad', approvedBy: 'admin-1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when status is not CANCEL_REQUESTED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });
    const handler = new ApproveCancelBookingHandler(prisma as never, buildEventBus() as never, defaultSettings as never);

    await expect(
      handler.execute({ tenantId: 'tenant-1', bookingId: 'book-1', approvedBy: 'admin-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('writes BookingStatusLog entry on approval', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CANCELLED });
    const handler = new ApproveCancelBookingHandler(prisma as never, buildEventBus() as never, defaultSettings as never);

    await handler.execute({ tenantId: 'tenant-1', bookingId: 'book-1', approvedBy: 'admin-1', approverNotes: 'ok' });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: 'CANCEL_REQUESTED',
          toStatus: BookingStatus.CANCELLED,
          changedBy: 'admin-1',
        }),
      }),
    );
  });

  it('defaults autoRefund to true when setting not present', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CANCELLED });
    const settingsNoRefund = { execute: jest.fn().mockResolvedValue({}) };
    const handler = new ApproveCancelBookingHandler(prisma as never, buildEventBus() as never, settingsNoRefund as never);

    const result = await handler.execute({ tenantId: 'tenant-1', bookingId: 'book-1', approvedBy: 'admin-1' });
    expect(result.autoRefund).toBe(true);
  });
});
```

- [ ] **Step 2: اكتب الـ spec لـ RejectCancelBookingHandler**

```typescript
// src/modules/bookings/reject-cancel-booking/reject-cancel-booking.handler.spec.ts
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { RejectCancelBookingHandler } from './reject-cancel-booking.handler';
import { buildPrisma, buildEventBus, mockBooking } from '../testing/booking-test-helpers';

const cancelRequestedBooking = { ...mockBooking, status: 'CANCEL_REQUESTED' as BookingStatus };

describe('RejectCancelBookingHandler', () => {
  it('rejects cancel request and restores status to CONFIRMED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CONFIRMED });
    const eb = buildEventBus();
    const handler = new RejectCancelBookingHandler(prisma as never, eb as never);

    await handler.execute({ tenantId: 'tenant-1', bookingId: 'book-1', rejectedBy: 'admin-1', rejectReason: 'No reason' });

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.CONFIRMED }) }),
    );
    expect(eb.publish).toHaveBeenCalledWith('bookings.booking.cancel_rejected', expect.anything());
  });

  it('throws NotFoundException when booking not found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(null);
    await expect(
      new RejectCancelBookingHandler(prisma as never, buildEventBus() as never).execute({
        tenantId: 'tenant-1', bookingId: 'bad', rejectedBy: 'admin-1', rejectReason: 'x',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when status is not CANCEL_REQUESTED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.PENDING });
    await expect(
      new RejectCancelBookingHandler(prisma as never, buildEventBus() as never).execute({
        tenantId: 'tenant-1', bookingId: 'book-1', rejectedBy: 'admin-1', rejectReason: 'x',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('writes BookingStatusLog entry on rejection', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CONFIRMED });
    const handler = new RejectCancelBookingHandler(prisma as never, buildEventBus() as never);

    await handler.execute({ tenantId: 'tenant-1', bookingId: 'book-1', rejectedBy: 'admin-1', rejectReason: 'policy' });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: 'CANCEL_REQUESTED',
          toStatus: BookingStatus.CONFIRMED,
          changedBy: 'admin-1',
          reason: 'policy',
        }),
      }),
    );
  });
});
```

- [ ] **Step 3: اكتب الـ spec لـ RequestCancelBookingHandler**

```typescript
// src/modules/bookings/request-cancel-booking/request-cancel-booking.handler.spec.ts
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus, CancellationReason } from '@prisma/client';
import { RequestCancelBookingHandler } from './request-cancel-booking.handler';
import { buildPrisma, buildEventBus, mockBooking } from '../testing/booking-test-helpers';

describe('RequestCancelBookingHandler', () => {
  it('sets status to CANCEL_REQUESTED for PENDING booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.PENDING });
    prisma.booking.update = jest.fn().mockResolvedValue({ ...mockBooking, status: 'CANCEL_REQUESTED' as BookingStatus });
    const eb = buildEventBus();
    const handler = new RequestCancelBookingHandler(prisma as never, eb as never);

    await handler.execute({
      tenantId: 'tenant-1', bookingId: 'book-1',
      reason: CancellationReason.CLIENT_REQUESTED, requestedBy: 'client-1',
    });

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CANCEL_REQUESTED' }) }),
    );
    expect(eb.publish).toHaveBeenCalledWith('bookings.booking.cancel_requested', expect.anything());
  });

  it('sets status to CANCEL_REQUESTED for CONFIRMED booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });
    prisma.booking.update = jest.fn().mockResolvedValue({ ...mockBooking, status: 'CANCEL_REQUESTED' as BookingStatus });
    const handler = new RequestCancelBookingHandler(prisma as never, buildEventBus() as never);

    await handler.execute({
      tenantId: 'tenant-1', bookingId: 'book-1',
      reason: CancellationReason.CLIENT_REQUESTED, requestedBy: 'client-1',
    });

    expect(prisma.booking.update).toHaveBeenCalled();
  });

  it('throws NotFoundException when booking not found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(null);
    await expect(
      new RequestCancelBookingHandler(prisma as never, buildEventBus() as never).execute({
        tenantId: 'tenant-1', bookingId: 'bad',
        reason: CancellationReason.OTHER, requestedBy: 'u',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException for non-cancellable status', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.COMPLETED });
    await expect(
      new RequestCancelBookingHandler(prisma as never, buildEventBus() as never).execute({
        tenantId: 'tenant-1', bookingId: 'book-1',
        reason: CancellationReason.OTHER, requestedBy: 'u',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('saves cancelNotes when provided', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.PENDING });
    prisma.booking.update = jest.fn().mockResolvedValue({ ...mockBooking });
    const handler = new RequestCancelBookingHandler(prisma as never, buildEventBus() as never);

    await handler.execute({
      tenantId: 'tenant-1', bookingId: 'book-1',
      reason: CancellationReason.OTHER, requestedBy: 'u', cancelNotes: 'urgent',
    });

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cancelNotes: 'urgent' }) }),
    );
  });
});
```

- [ ] **Step 4: شغّل الاختبارات الثلاثة**

```bash
cd apps/backend && npx jest approve-cancel-booking reject-cancel-booking request-cancel-booking --no-coverage
```
Expected: 3 suites, ~14 tests, all PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/bookings/approve-cancel-booking/approve-cancel-booking.handler.spec.ts \
        src/modules/bookings/reject-cancel-booking/reject-cancel-booking.handler.spec.ts \
        src/modules/bookings/request-cancel-booking/request-cancel-booking.handler.spec.ts
git commit -m "test(bookings): add specs for approve/reject/request cancel booking handlers"
```

---

## Task 2: `payment-completed-handler` + `booking-lifecycle.helper`

**Files:**
- Create: `src/modules/bookings/payment-completed-handler/payment-completed.handler.spec.ts`
- Create: `src/modules/bookings/booking-lifecycle.helper.spec.ts`

- [ ] **Step 1: اكتب الـ spec لـ PaymentCompletedEventHandler**

```typescript
// src/modules/bookings/payment-completed-handler/payment-completed.handler.spec.ts
import { PaymentCompletedEventHandler } from './payment-completed.handler';
import { buildPrisma, buildEventBus, mockBooking } from '../testing/booking-test-helpers';
import { BookingStatus } from '@prisma/client';

function buildHandler() {
  const prisma = buildPrisma();
  const eb = buildEventBus();
  // Capture the subscriber callback so we can invoke it directly
  let subscriber: ((envelope: unknown) => Promise<void>) | null = null;
  eb.subscribe = jest.fn((_, cb) => { subscriber = cb; });
  const handler = new PaymentCompletedEventHandler(prisma as never, eb as never);
  handler.register();
  return { prisma, eb, handler, getSubscriber: () => subscriber! };
}

const makeEnvelope = (overrides: Partial<{ bookingId: string; tenantId: string; paymentId: string }> = {}) => ({
  payload: { bookingId: 'book-1', tenantId: 'tenant-1', paymentId: 'pay-1', invoiceId: 'inv-1', ...overrides },
});

describe('PaymentCompletedEventHandler', () => {
  it('registers a subscriber on finance.payment.completed', () => {
    const { eb } = buildHandler();
    expect(eb.subscribe).toHaveBeenCalledWith('finance.payment.completed', expect.any(Function));
  });

  it('confirms PENDING booking on payment completed', async () => {
    const { prisma, getSubscriber } = buildHandler();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.PENDING });
    prisma.booking.update = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });

    await getSubscriber()(makeEnvelope());

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CONFIRMED' }) }),
    );
  });

  it('skips non-PENDING bookings', async () => {
    const { prisma, getSubscriber } = buildHandler();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });

    await getSubscriber()(makeEnvelope());

    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('skips when booking not found', async () => {
    const { prisma, getSubscriber } = buildHandler();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(null);

    await getSubscriber()(makeEnvelope());

    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('writes BookingStatusLog on confirmation', async () => {
    const { prisma, getSubscriber } = buildHandler();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.PENDING });
    prisma.booking.update = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });

    await getSubscriber()(makeEnvelope());

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fromStatus: BookingStatus.PENDING, toStatus: 'CONFIRMED' }),
      }),
    );
  });
});
```

- [ ] **Step 2: اكتب الـ spec لـ booking-lifecycle.helper**

```typescript
// src/modules/bookings/booking-lifecycle.helper.spec.ts
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { fetchBookingOrFail } from './booking-lifecycle.helper';
import { buildPrisma, mockBooking } from './testing/booking-test-helpers';

describe('fetchBookingOrFail', () => {
  it('returns booking when found and status allowed', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.PENDING });

    const result = await fetchBookingOrFail(prisma as never, 'book-1', 'tenant-1', [BookingStatus.PENDING], 'cancelled');

    expect(result).toMatchObject({ id: 'book-1', status: BookingStatus.PENDING });
  });

  it('throws NotFoundException when booking not found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(null);

    await expect(
      fetchBookingOrFail(prisma as never, 'bad-id', 'tenant-1', [BookingStatus.PENDING], 'cancelled'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when status not in allowedStatuses', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.COMPLETED });

    await expect(
      fetchBookingOrFail(prisma as never, 'book-1', 'tenant-1', [BookingStatus.PENDING], 'cancelled'),
    ).rejects.toThrow(BadRequestException);
  });

  it('error message includes booking status', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CANCELLED });

    await expect(
      fetchBookingOrFail(prisma as never, 'book-1', 'tenant-1', [BookingStatus.PENDING], 'confirmed'),
    ).rejects.toThrow(/CANCELLED/);
  });
});
```

- [ ] **Step 3: شغّل الاختبارات**

```bash
cd apps/backend && npx jest payment-completed booking-lifecycle.helper --no-coverage
```
Expected: 2 suites, ~9 tests, all PASS

- [ ] **Step 4: Commit**

```bash
git add src/modules/bookings/payment-completed-handler/payment-completed.handler.spec.ts \
        src/modules/bookings/booking-lifecycle.helper.spec.ts
git commit -m "test(bookings): add specs for payment-completed handler and lifecycle helper"
```

---

## Task 3: `create-zoom-meeting`

**Files:**
- Create: `src/modules/bookings/create-zoom-meeting/create-zoom-meeting.handler.spec.ts`

- [ ] **Step 1: اكتب الـ spec**

```typescript
// src/modules/bookings/create-zoom-meeting/create-zoom-meeting.handler.spec.ts
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateZoomMeetingHandler } from './create-zoom-meeting.handler';
import { buildPrisma, mockBooking } from '../testing/booking-test-helpers';

const onlineBooking = { ...mockBooking, bookingType: 'ONLINE' as const };
const zoomIntegration = {
  isActive: true,
  config: { zoomClientId: 'cid', zoomClientSecret: 'csec', zoomAccountId: 'acct' },
};

function buildPrismaWithZoom(bookingOverride = onlineBooking, integrationOverride = zoomIntegration) {
  const prisma = buildPrisma();
  prisma.booking.findFirst = jest.fn().mockResolvedValue(bookingOverride);
  (prisma as unknown as Record<string, unknown>).integration = {
    findUnique: jest.fn().mockResolvedValue(integrationOverride),
  };
  prisma.booking.update = jest.fn().mockResolvedValue({ ...bookingOverride, zoomMeetingId: '12345' });
  return prisma;
}

describe('CreateZoomMeetingHandler', () => {
  it('throws NotFoundException when booking not found', async () => {
    const prisma = buildPrismaWithZoom();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new CreateZoomMeetingHandler(prisma as never);

    await expect(handler.execute({ tenantId: 'tenant-1', bookingId: 'bad' })).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException for non-ONLINE booking', async () => {
    const prisma = buildPrismaWithZoom({ ...mockBooking, bookingType: 'INDIVIDUAL' as const });
    const handler = new CreateZoomMeetingHandler(prisma as never);

    await expect(handler.execute({ tenantId: 'tenant-1', bookingId: 'book-1' })).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when Zoom integration not configured', async () => {
    const prisma = buildPrismaWithZoom(onlineBooking, null as never);
    const handler = new CreateZoomMeetingHandler(prisma as never);

    await expect(handler.execute({ tenantId: 'tenant-1', bookingId: 'book-1' })).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when Zoom integration is inactive', async () => {
    const prisma = buildPrismaWithZoom(onlineBooking, { ...zoomIntegration, isActive: false });
    const handler = new CreateZoomMeetingHandler(prisma as never);

    await expect(handler.execute({ tenantId: 'tenant-1', bookingId: 'book-1' })).rejects.toThrow(BadRequestException);
  });

  it('calls Zoom API and updates booking with meeting details', async () => {
    const prisma = buildPrismaWithZoom();
    const handler = new CreateZoomMeetingHandler(prisma as never);

    // Mock global fetch
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok', token_type: 'Bearer', expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 99, join_url: 'https://zoom.us/j/99', start_url: 'https://zoom.us/s/99' }) });

    await handler.execute({ tenantId: 'tenant-1', bookingId: 'book-1' });

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ zoomMeetingId: '99', zoomJoinUrl: 'https://zoom.us/j/99' }),
      }),
    );
  });

  it('throws BadRequestException when Zoom token request fails', async () => {
    const prisma = buildPrismaWithZoom();
    const handler = new CreateZoomMeetingHandler(prisma as never);

    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, statusText: 'Unauthorized' });

    await expect(handler.execute({ tenantId: 'tenant-1', bookingId: 'book-1' })).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when Zoom meeting creation fails', async () => {
    const prisma = buildPrismaWithZoom();
    const handler = new CreateZoomMeetingHandler(prisma as never);

    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok', token_type: 'Bearer', expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: false, statusText: 'Bad Request' });

    await expect(handler.execute({ tenantId: 'tenant-1', bookingId: 'book-1' })).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: شغّل الاختبار**

```bash
cd apps/backend && npx jest create-zoom-meeting --no-coverage
```
Expected: 1 suite, 7 tests, all PASS

- [ ] **Step 3: Commit**

```bash
git add src/modules/bookings/create-zoom-meeting/create-zoom-meeting.handler.spec.ts
git commit -m "test(bookings): add spec for create-zoom-meeting handler"
```

---

## Task 4: `ops/log-activity` + `ops/health-check`

**Files:**
- Create: `src/modules/ops/log-activity/log-activity.handler.spec.ts`
- Create: `src/modules/ops/log-activity/list-activity.handler.spec.ts`
- Create: `src/modules/ops/health-check/health-check.handler.spec.ts`

- [ ] **Step 1: اقرأ الملفات**

```bash
cd apps/backend
cat src/modules/ops/log-activity/log-activity.handler.ts
cat src/modules/ops/log-activity/list-activity.handler.ts
cat src/modules/ops/log-activity/list-activity.dto.ts
cat src/modules/ops/health-check/health-check.handler.ts
```

- [ ] **Step 2: اكتب الـ spec لـ LogActivityHandler**

```typescript
// src/modules/ops/log-activity/log-activity.handler.spec.ts
import { LogActivityHandler } from './log-activity.handler';
import { ActivityAction } from '@prisma/client';

const buildPrisma = () => ({
  activityLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) },
});

describe('LogActivityHandler', () => {
  it('creates an activity log entry', async () => {
    const prisma = buildPrisma();
    const handler = new LogActivityHandler(prisma as never);

    await handler.execute({
      tenantId: 'tenant-1',
      action: ActivityAction.CREATE,
      entity: 'Booking',
      entityId: 'book-1',
      description: 'Created booking',
    });

    expect(prisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          action: ActivityAction.CREATE,
          entity: 'Booking',
          description: 'Created booking',
        }),
      }),
    );
  });

  it('stores optional metadata as JSON', async () => {
    const prisma = buildPrisma();
    const handler = new LogActivityHandler(prisma as never);

    await handler.execute({
      tenantId: 'tenant-1',
      action: ActivityAction.UPDATE,
      entity: 'Employee',
      description: 'Updated availability',
      metadata: { changedFields: ['slots'] },
    });

    expect(prisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ metadata: { changedFields: ['slots'] } }),
      }),
    );
  });

  it('stores ipAddress and userAgent when provided', async () => {
    const prisma = buildPrisma();
    const handler = new LogActivityHandler(prisma as never);

    await handler.execute({
      tenantId: 'tenant-1',
      action: ActivityAction.LOGIN,
      entity: 'User',
      description: 'User logged in',
      ipAddress: '1.2.3.4',
      userAgent: 'Mozilla',
    });

    expect(prisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ipAddress: '1.2.3.4', userAgent: 'Mozilla' }),
      }),
    );
  });
});
```

- [ ] **Step 3: اكتب الـ spec لـ ListActivityHandler** (بعد قراءة الملف في Step 1)

```typescript
// src/modules/ops/log-activity/list-activity.handler.spec.ts
import { ListActivityHandler } from './list-activity.handler';

const mockLogs = [
  { id: 'log-1', tenantId: 'tenant-1', action: 'CREATE', entity: 'Booking', createdAt: new Date() },
];

const buildPrisma = () => ({
  activityLog: {
    findMany: jest.fn().mockResolvedValue(mockLogs),
    count: jest.fn().mockResolvedValue(1),
  },
});

describe('ListActivityHandler', () => {
  it('returns paginated activity logs', async () => {
    const prisma = buildPrisma();
    const handler = new ListActivityHandler(prisma as never);

    const result = await handler.execute({ tenantId: 'tenant-1', page: 1, limit: 10 });

    expect(prisma.activityLog.findMany).toHaveBeenCalled();
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it('scopes query to tenantId', async () => {
    const prisma = buildPrisma();
    const handler = new ListActivityHandler(prisma as never);

    await handler.execute({ tenantId: 'tenant-99', page: 1, limit: 10 });

    expect(prisma.activityLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-99' }) }),
    );
  });
});
```

- [ ] **Step 4: اكتب الـ spec لـ HealthCheckHandler**

```typescript
// src/modules/ops/health-check/health-check.handler.spec.ts
import { HealthCheckHandler } from './health-check.handler';

// HealthCheckHandler likely just returns { status: 'ok' } or similar — read the file in Step 1 to confirm
// If it depends on PrismaService, mock it:
const buildPrisma = () => ({
  $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
});

describe('HealthCheckHandler', () => {
  it('returns healthy status when DB is reachable', async () => {
    // Adjust constructor args based on what you read in Step 1
    const handler = new HealthCheckHandler(buildPrisma() as never);
    const result = await handler.execute();
    expect(result).toMatchObject({ status: expect.stringMatching(/ok|healthy/i) });
  });
});
```

- [ ] **Step 5: شغّل الاختبارات**

```bash
cd apps/backend && npx jest log-activity.handler list-activity.handler health-check.handler --no-coverage
```
Expected: 3 suites, all PASS

- [ ] **Step 6: Commit**

```bash
git add src/modules/ops/log-activity/log-activity.handler.spec.ts \
        src/modules/ops/log-activity/list-activity.handler.spec.ts \
        src/modules/ops/health-check/health-check.handler.spec.ts
git commit -m "test(ops): add specs for log-activity, list-activity, and health-check handlers"
```

---

## Task 5: `ops/generate-report` + `ops/cron-tasks`

**Files:**
- Create: `src/modules/ops/generate-report/generate-report.handler.spec.ts`
- Create: `src/modules/ops/cron-tasks/cron-tasks.service.spec.ts`

- [ ] **Step 1: اقرأ الملفات**

```bash
cd apps/backend
cat src/modules/ops/generate-report/generate-report.handler.ts
cat src/modules/ops/generate-report/revenue-report.builder.ts
cat src/modules/ops/generate-report/activity-report.builder.ts
cat src/modules/ops/cron-tasks/cron-tasks.service.ts
```

- [ ] **Step 2: اكتب الـ spec لـ GenerateReportHandler**

```typescript
// src/modules/ops/generate-report/generate-report.handler.spec.ts
import { BadRequestException } from '@nestjs/common';
import { GenerateReportHandler } from './generate-report.handler';
import { ReportType, ReportFormat } from '@prisma/client';

const buildPrisma = () => ({
  report: {
    create: jest.fn().mockResolvedValue({ id: 'report-1', type: ReportType.REVENUE, status: 'PENDING' }),
    update: jest.fn().mockResolvedValue({ id: 'report-1', status: 'COMPLETED' }),
  },
  payment: { findMany: jest.fn().mockResolvedValue([]) },
  booking: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
  activityLog: { findMany: jest.fn().mockResolvedValue([]) },
  $queryRaw: jest.fn().mockResolvedValue([]),
});

describe('GenerateReportHandler', () => {
  it('throws BadRequestException when from >= to', async () => {
    const prisma = buildPrisma();
    const handler = new GenerateReportHandler(prisma as never);

    await expect(
      handler.execute({
        tenantId: 'tenant-1', type: ReportType.REVENUE,
        from: '2026-01-10', to: '2026-01-01',
        requestedBy: 'user-1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates a report record with PENDING status initially', async () => {
    const prisma = buildPrisma();
    const handler = new GenerateReportHandler(prisma as never);

    await handler.execute({
      tenantId: 'tenant-1', type: ReportType.REVENUE,
      from: '2026-01-01', to: '2026-01-31',
      requestedBy: 'user-1',
    });

    expect(prisma.report.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING', type: ReportType.REVENUE }) }),
    );
  });

  it('generates a REVENUE report successfully', async () => {
    const prisma = buildPrisma();
    const handler = new GenerateReportHandler(prisma as never);

    const result = await handler.execute({
      tenantId: 'tenant-1', type: ReportType.REVENUE,
      from: '2026-01-01', to: '2026-01-31',
      requestedBy: 'user-1',
    });

    expect(result.type).toBe(ReportType.REVENUE);
    expect(result.status).toBe('COMPLETED');
  });

  it('generates an ACTIVITY report successfully', async () => {
    const prisma = buildPrisma();
    const handler = new GenerateReportHandler(prisma as never);

    const result = await handler.execute({
      tenantId: 'tenant-1', type: ReportType.ACTIVITY,
      from: '2026-01-01', to: '2026-01-31',
      requestedBy: 'user-1',
    });

    expect(result.type).toBe(ReportType.ACTIVITY);
  });

  it('defaults format to JSON when not specified', async () => {
    const prisma = buildPrisma();
    const handler = new GenerateReportHandler(prisma as never);

    await handler.execute({
      tenantId: 'tenant-1', type: ReportType.REVENUE,
      from: '2026-01-01', to: '2026-01-31',
      requestedBy: 'user-1',
    });

    expect(prisma.report.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ format: ReportFormat.JSON }) }),
    );
  });
});
```

- [ ] **Step 3: اكتب الـ spec لـ CronTasksService**

```typescript
// src/modules/ops/cron-tasks/cron-tasks.service.spec.ts
import { CronTasksService, CRON_JOBS } from './cron-tasks.service';

// Build lightweight mocks for every cron class
const buildCronMock = () => ({ execute: jest.fn().mockResolvedValue(undefined) });

const buildBullMq = () => {
  const queue = { add: jest.fn().mockResolvedValue(undefined) };
  let workerProcessor: ((job: { name: string }) => Promise<void>) | null = null;
  return {
    getQueue: jest.fn().mockReturnValue(queue),
    createWorker: jest.fn((_, processor) => { workerProcessor = processor; }),
    queue,
    getProcessor: () => workerProcessor!,
  };
};

describe('CronTasksService', () => {
  it('schedules all 6 cron jobs on module init', () => {
    const bullMq = buildBullMq();
    const service = new CronTasksService(
      bullMq as never,
      buildCronMock() as never,
      buildCronMock() as never,
      buildCronMock() as never,
      buildCronMock() as never,
      buildCronMock() as never,
      buildCronMock() as never,
    );
    service.onModuleInit();

    expect(bullMq.queue.add).toHaveBeenCalledTimes(6);
    Object.values(CRON_JOBS).forEach((name) => {
      expect(bullMq.queue.add).toHaveBeenCalledWith(name, {}, expect.objectContaining({ repeat: expect.anything() }));
    });
  });

  it('registers a worker on the ops-cron queue', () => {
    const bullMq = buildBullMq();
    const service = new CronTasksService(
      bullMq as never,
      buildCronMock() as never,
      buildCronMock() as never,
      buildCronMock() as never,
      buildCronMock() as never,
      buildCronMock() as never,
      buildCronMock() as never,
    );
    service.onModuleInit();
    expect(bullMq.createWorker).toHaveBeenCalledWith('ops-cron', expect.any(Function));
  });

  it.each(Object.entries(CRON_JOBS))('worker routes %s job to correct cron handler', async (_, jobName) => {
    const bullMq = buildBullMq();
    const mocks = [buildCronMock(), buildCronMock(), buildCronMock(), buildCronMock(), buildCronMock(), buildCronMock()];
    const jobOrder = [
      CRON_JOBS.BOOKING_AUTOCOMPLETE,
      CRON_JOBS.BOOKING_EXPIRY,
      CRON_JOBS.BOOKING_NOSHOW,
      CRON_JOBS.APPOINTMENT_REMINDERS,
      CRON_JOBS.GROUP_SESSION_AUTOMATION,
      CRON_JOBS.REFRESH_TOKEN_CLEANUP,
    ];

    const service = new CronTasksService(bullMq as never, ...mocks.map(m => m as never) as [never, never, never, never, never, never]);
    service.onModuleInit();

    const processor = bullMq.getProcessor();
    await processor({ name: jobName });

    const idx = jobOrder.indexOf(jobName as typeof CRON_JOBS[keyof typeof CRON_JOBS]);
    expect(mocks[idx].execute).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 4: شغّل الاختبارات**

```bash
cd apps/backend && npx jest generate-report.handler cron-tasks.service --no-coverage
```
Expected: 2 suites, all PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/ops/generate-report/generate-report.handler.spec.ts \
        src/modules/ops/cron-tasks/cron-tasks.service.spec.ts
git commit -m "test(ops): add specs for generate-report handler and cron-tasks service"
```

---

## Task 6: `org-config/categories` + `org-config/departments`

**Files:**
- Create: `src/modules/org-config/categories/categories.handler.spec.ts`
- Create: `src/modules/org-config/departments/departments.handler.spec.ts`

- [ ] **Step 1: اقرأ الملفات**

```bash
cd apps/backend
cat src/modules/org-config/categories/create-category.handler.ts
cat src/modules/org-config/categories/list-categories.handler.ts
cat src/modules/org-config/categories/update-category.handler.ts
cat src/modules/org-config/departments/create-department.handler.ts
cat src/modules/org-config/departments/list-departments.handler.ts
cat src/modules/org-config/departments/update-department.handler.ts
```

- [ ] **Step 2: اكتب spec للـ Categories**

```typescript
// src/modules/org-config/categories/categories.handler.spec.ts
import { NotFoundException } from '@nestjs/common';
import { CreateCategoryHandler } from './create-category.handler';
import { ListCategoriesHandler } from './list-categories.handler';
import { UpdateCategoryHandler } from './update-category.handler';

const mockCategory = { id: 'cat-1', tenantId: 'tenant-1', nameAr: 'فحص', nameEn: 'Checkup', sortOrder: 0 };

const buildPrisma = () => ({
  serviceCategory: {
    create: jest.fn().mockResolvedValue(mockCategory),
    findMany: jest.fn().mockResolvedValue([mockCategory]),
    count: jest.fn().mockResolvedValue(1),
    findFirst: jest.fn().mockResolvedValue(mockCategory),
    update: jest.fn().mockResolvedValue(mockCategory),
  },
});

describe('CreateCategoryHandler', () => {
  it('creates a category', async () => {
    const prisma = buildPrisma();
    const handler = new CreateCategoryHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1', nameAr: 'فحص', nameEn: 'Checkup' });
    expect(prisma.serviceCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-1', nameAr: 'فحص' }) }),
    );
    expect(result).toMatchObject({ id: 'cat-1' });
  });
});

describe('ListCategoriesHandler', () => {
  it('returns categories scoped to tenant', async () => {
    const prisma = buildPrisma();
    const handler = new ListCategoriesHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1', page: 1, limit: 10 });
    expect(prisma.serviceCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-1' }) }),
    );
    expect(result.data).toHaveLength(1);
  });
});

describe('UpdateCategoryHandler', () => {
  it('updates category fields', async () => {
    const prisma = buildPrisma();
    const handler = new UpdateCategoryHandler(prisma as never);
    await handler.execute({ tenantId: 'tenant-1', id: 'cat-1', nameEn: 'Updated' });
    expect(prisma.serviceCategory.update).toHaveBeenCalled();
  });

  it('throws NotFoundException when category not found', async () => {
    const prisma = buildPrisma();
    prisma.serviceCategory.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new UpdateCategoryHandler(prisma as never);
    await expect(handler.execute({ tenantId: 'tenant-1', id: 'bad', nameEn: 'x' })).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 3: اكتب spec للـ Departments** (نفس النمط، استبدل `serviceCategory` بـ `department`)

```typescript
// src/modules/org-config/departments/departments.handler.spec.ts
import { NotFoundException } from '@nestjs/common';
import { CreateDepartmentHandler } from './create-department.handler';
import { ListDepartmentsHandler } from './list-departments.handler';
import { UpdateDepartmentHandler } from './update-department.handler';

const mockDept = { id: 'dept-1', tenantId: 'tenant-1', nameAr: 'عيادة', nameEn: 'Clinic', sortOrder: 0 };

const buildPrisma = () => ({
  department: {
    create: jest.fn().mockResolvedValue(mockDept),
    findMany: jest.fn().mockResolvedValue([mockDept]),
    count: jest.fn().mockResolvedValue(1),
    findFirst: jest.fn().mockResolvedValue(mockDept),
    update: jest.fn().mockResolvedValue(mockDept),
  },
});

describe('CreateDepartmentHandler', () => {
  it('creates a department', async () => {
    const prisma = buildPrisma();
    const handler = new CreateDepartmentHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1', nameAr: 'عيادة', nameEn: 'Clinic' });
    expect(prisma.department.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-1' }) }),
    );
    expect(result).toMatchObject({ id: 'dept-1' });
  });
});

describe('ListDepartmentsHandler', () => {
  it('returns departments scoped to tenant', async () => {
    const prisma = buildPrisma();
    const handler = new ListDepartmentsHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1', page: 1, limit: 10 });
    expect(result.data).toHaveLength(1);
  });
});

describe('UpdateDepartmentHandler', () => {
  it('updates department fields', async () => {
    const prisma = buildPrisma();
    const handler = new UpdateDepartmentHandler(prisma as never);
    await handler.execute({ tenantId: 'tenant-1', id: 'dept-1', nameEn: 'Updated' });
    expect(prisma.department.update).toHaveBeenCalled();
  });

  it('throws NotFoundException when not found', async () => {
    const prisma = buildPrisma();
    prisma.department.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new UpdateDepartmentHandler(prisma as never);
    await expect(handler.execute({ tenantId: 'tenant-1', id: 'bad', nameEn: 'x' })).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 4: شغّل الاختبارات**

```bash
cd apps/backend && npx jest categories.handler departments.handler --no-coverage
```
Expected: 2 suites, all PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/org-config/categories/categories.handler.spec.ts \
        src/modules/org-config/departments/departments.handler.spec.ts
git commit -m "test(org-config): add specs for categories and departments handlers"
```

---

## Task 7: `identity/shared/token.service`

**Files:**
- Create: `src/modules/identity/shared/token.service.spec.ts`

- [ ] **Step 1: اقرأ الملف بالكامل**

```bash
cd apps/backend && cat src/modules/identity/shared/token.service.ts
```

- [ ] **Step 2: اكتب الـ spec**

```typescript
// src/modules/identity/shared/token.service.spec.ts
import { TokenService } from './token.service';

const mockUser = {
  id: 'user-1', tenantId: 'tenant-1', email: 'admin@clinic.sa',
  role: 'ADMIN', customRoleId: null, customRole: null,
};

const buildJwt = () => ({
  sign: jest.fn().mockReturnValue('signed.access.token'),
  verify: jest.fn().mockReturnValue({ sub: 'user-1', tenantId: 'tenant-1' }),
});

const buildConfig = (overrides: Record<string, string> = {}) => ({
  getOrThrow: jest.fn().mockImplementation((key: string) => {
    const map: Record<string, string> = {
      JWT_ACCESS_SECRET: 'access-secret',
      JWT_REFRESH_SECRET: 'refresh-secret',
      ...overrides,
    };
    return map[key];
  }),
  get: jest.fn().mockImplementation((key: string) => {
    const map: Record<string, string> = { JWT_ACCESS_TTL: '15m', JWT_REFRESH_TTL: '30d', ...overrides };
    return map[key];
  }),
});

const buildPrisma = () => ({
  refreshToken: {
    create: jest.fn().mockResolvedValue({ id: 'rt-1' }),
    findFirst: jest.fn().mockResolvedValue({ id: 'rt-1', tokenHash: '$bcrypt', expiresAt: new Date(Date.now() + 86400_000), revoked: false }),
    update: jest.fn().mockResolvedValue({ id: 'rt-1', revoked: true }),
  },
});

describe('TokenService.issueTokenPair', () => {
  it('returns accessToken and refreshToken', async () => {
    const jwt = buildJwt();
    const service = new TokenService(jwt as never, buildConfig() as never, buildPrisma() as never);
    const result = await service.issueTokenPair(mockUser);

    expect(result.accessToken).toBe('signed.access.token');
    expect(typeof result.refreshToken).toBe('string');
    expect(result.refreshToken.length).toBeGreaterThan(10);
  });

  it('signs JWT with ACCESS secret', async () => {
    const jwt = buildJwt();
    const service = new TokenService(jwt as never, buildConfig() as never, buildPrisma() as never);
    await service.issueTokenPair(mockUser);

    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'user-1', tenantId: 'tenant-1', email: 'admin@clinic.sa' }),
      expect.objectContaining({ secret: 'access-secret' }),
    );
  });

  it('stores hashed refresh token in DB', async () => {
    const prisma = buildPrisma();
    const service = new TokenService(buildJwt() as never, buildConfig() as never, prisma as never);
    await service.issueTokenPair(mockUser);

    expect(prisma.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'tenant-1', userId: 'user-1' }),
      }),
    );
  });

  it('JWT payload permissions defaults to [] for users with no customRole', async () => {
    const jwt = buildJwt();
    const service = new TokenService(jwt as never, buildConfig() as never, buildPrisma() as never);
    await service.issueTokenPair({ ...mockUser, customRole: null });

    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ permissions: [] }),
      expect.anything(),
    );
  });

  it('includes customRole permissions in JWT payload', async () => {
    const jwt = buildJwt();
    const userWithRole = { ...mockUser, customRoleId: 'role-1', customRole: { permissions: [{ action: 'read', subject: 'Booking' }] } };
    const service = new TokenService(jwt as never, buildConfig() as never, buildPrisma() as never);
    await service.issueTokenPair(userWithRole);

    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ permissions: [{ action: 'read', subject: 'Booking' }] }),
      expect.anything(),
    );
  });
});

describe('TokenService.revokeRefreshToken', () => {
  it('marks token as revoked in DB', async () => {
    const prisma = buildPrisma();
    const service = new TokenService(buildJwt() as never, buildConfig() as never, prisma as never);
    await service.revokeRefreshToken('tenant-1', 'raw-token');
    // revokeRefreshToken verifies hash then marks revoked — either update or delete is acceptable
    expect(prisma.refreshToken.update ?? prisma.refreshToken.findFirst).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: شغّل الاختبار**

```bash
cd apps/backend && npx jest token.service --no-coverage
```
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add src/modules/identity/shared/token.service.spec.ts
git commit -m "test(identity): add spec for token service — issue and revoke token pair"
```

---

## Task 8: `org-experience/services/price-resolver.service`

**Files:**
- Create: `src/modules/org-experience/services/price-resolver.service.spec.ts`

- [ ] **Step 1: اقرأ الملف بالكامل**

```bash
cd apps/backend && cat src/modules/org-experience/services/price-resolver.service.ts
```

- [ ] **Step 2: اكتب الـ spec**

```typescript
// src/modules/org-experience/services/price-resolver.service.spec.ts
import { PriceResolverService } from './price-resolver.service';

const mockService = { id: 'svc-1', tenantId: 'tenant-1', price: 200, durationMins: 60, currency: 'SAR' };
const mockDurationOption = { id: 'opt-1', serviceId: 'svc-1', price: 250, durationMins: 45, isDefault: true, bookingType: 'INDIVIDUAL' };
const mockEmployeeServiceOption = { employeeServiceId: 'es-1', durationOptionId: 'opt-1', priceOverride: 300, durationOverride: 50 };

const buildPrisma = (overrides: Partial<{
  service: unknown; durationOption: unknown; employeeServiceOption: unknown;
}> = {}) => ({
  service: {
    findUnique: jest.fn().mockResolvedValue(overrides.service ?? mockService),
  },
  serviceDurationOption: {
    findFirst: jest.fn().mockResolvedValue(overrides.durationOption ?? mockDurationOption),
    findUnique: jest.fn().mockResolvedValue(overrides.durationOption ?? mockDurationOption),
  },
  employeeServiceOption: {
    findFirst: jest.fn().mockResolvedValue(overrides.employeeServiceOption ?? null),
  },
});

describe('PriceResolverService', () => {
  it('returns catalog option price when no employee override', async () => {
    const prisma = buildPrisma();
    const service = new PriceResolverService(prisma as never);

    const result = await service.resolve({
      tenantId: 'tenant-1', serviceId: 'svc-1',
      employeeServiceId: null, durationOptionId: 'opt-1',
    });

    expect(result.price).toBe(250);
    expect(result.durationMins).toBe(45);
    expect(result.isEmployeeOverride).toBe(false);
  });

  it('returns employee override price when available', async () => {
    const prisma = buildPrisma({ employeeServiceOption: mockEmployeeServiceOption });
    const service = new PriceResolverService(prisma as never);

    const result = await service.resolve({
      tenantId: 'tenant-1', serviceId: 'svc-1',
      employeeServiceId: 'es-1', durationOptionId: 'opt-1',
    });

    expect(result.price).toBe(300);
    expect(result.durationMins).toBe(50);
    expect(result.isEmployeeOverride).toBe(true);
  });

  it('falls back to service-level price when no duration option exists', async () => {
    const prisma = buildPrisma({ durationOption: null });
    const service = new PriceResolverService(prisma as never);

    const result = await service.resolve({
      tenantId: 'tenant-1', serviceId: 'svc-1',
      employeeServiceId: null, durationOptionId: null,
    });

    expect(result.price).toBe(200);
    expect(result.durationMins).toBe(60);
    expect(result.isEmployeeOverride).toBe(false);
  });

  it('includes durationOptionId and currency in result', async () => {
    const prisma = buildPrisma();
    const service = new PriceResolverService(prisma as never);

    const result = await service.resolve({
      tenantId: 'tenant-1', serviceId: 'svc-1',
      employeeServiceId: null, durationOptionId: 'opt-1',
    });

    expect(result.durationOptionId).toBe('opt-1');
    expect(result.currency).toBe('SAR');
  });
});
```

- [ ] **Step 3: شغّل الاختبار**

```bash
cd apps/backend && npx jest price-resolver.service --no-coverage
```
Expected: 1 suite, 4 tests, all PASS

- [ ] **Step 4: Commit**

```bash
git add src/modules/org-experience/services/price-resolver.service.spec.ts
git commit -m "test(services): add spec for price-resolver service"
```

---

## Task 9: تعزيز `list-bookings` + `finance/list-payments` + `finance/create-invoice` (booking-confirmed handler)

**Files:**
- Modify: `src/modules/bookings/list-bookings/list-bookings.handler.spec.ts`
- Modify: `src/modules/finance/list-payments/list-payments.handler.spec.ts`
- Create: `src/modules/finance/create-invoice/booking-confirmed.handler.spec.ts`

- [ ] **Step 1: اقرأ الملفات الموجودة**

```bash
cd apps/backend
cat src/modules/bookings/list-bookings/list-bookings.handler.spec.ts
cat src/modules/bookings/list-bookings/list-bookings.handler.ts
cat src/modules/finance/list-payments/list-payments.handler.spec.ts
cat src/modules/finance/list-payments/list-payments.handler.ts
cat src/modules/finance/create-invoice/booking-confirmed.handler.ts
```

- [ ] **Step 2: أضف اختبارات مفقودة إلى `list-bookings.handler.spec.ts`**

بعد قراءة الملفين، أضف `describe` blocks تغطي:
- الـ filtering بالـ `status`
- الـ filtering بالـ `branchId` و `employeeId`
- الـ pagination (meta.totalPages, meta.page)
- الـ date range filtering
- الـ scope بالـ `tenantId`

Example pattern للإضافة:
```typescript
describe('ListBookingsHandler — filters', () => {
  it('filters by status when provided', async () => {
    const prisma = buildPrisma(); // use the existing buildPrisma from the spec
    const handler = new ListBookingsHandler(prisma as never);
    await handler.execute({ tenantId: 'tenant-1', status: BookingStatus.CONFIRMED, page: 1, limit: 10 });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: BookingStatus.CONFIRMED }) }),
    );
  });

  it('scopes query to tenantId', async () => {
    const prisma = buildPrisma();
    const handler = new ListBookingsHandler(prisma as never);
    await handler.execute({ tenantId: 'tenant-99', page: 1, limit: 10 });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-99' }) }),
    );
  });
});
```

- [ ] **Step 3: اكتب spec لـ `BookingConfirmedEventHandler`** (موجود في `create-invoice/booking-confirmed.handler.ts`)

```typescript
// src/modules/finance/create-invoice/booking-confirmed.handler.spec.ts
import { BookingConfirmedEventHandler } from './booking-confirmed.handler';

const buildEventBus = () => {
  let subscriber: ((env: unknown) => Promise<void>) | null = null;
  return {
    subscribe: jest.fn((_, cb) => { subscriber = cb; }),
    publish: jest.fn(),
    getSubscriber: () => subscriber!,
  };
};

const mockBooking = { id: 'book-1', tenantId: 'tenant-1', clientId: 'c-1', employeeId: 'e-1', price: 300, currency: 'SAR', serviceId: 'svc-1' };

const buildPrisma = () => ({
  booking: { findFirst: jest.fn().mockResolvedValue(mockBooking) },
  invoice: { create: jest.fn().mockResolvedValue({ id: 'inv-1' }) },
});

const makeEnvelope = () => ({
  payload: { bookingId: 'book-1', tenantId: 'tenant-1' },
});

describe('BookingConfirmedEventHandler', () => {
  it('registers subscriber on bookings.booking.confirmed', () => {
    const eb = buildEventBus();
    const handler = new BookingConfirmedEventHandler(buildPrisma() as never, eb as never);
    handler.register();
    expect(eb.subscribe).toHaveBeenCalledWith('bookings.booking.confirmed', expect.any(Function));
  });

  it('creates invoice when booking confirmed', async () => {
    const prisma = buildPrisma();
    const eb = buildEventBus();
    const handler = new BookingConfirmedEventHandler(prisma as never, eb as never);
    handler.register();

    await eb.getSubscriber()(makeEnvelope());

    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ bookingId: 'book-1' }) }),
    );
  });

  it('skips when booking not found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(null);
    const eb = buildEventBus();
    const handler = new BookingConfirmedEventHandler(prisma as never, eb as never);
    handler.register();

    await eb.getSubscriber()(makeEnvelope());

    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: شغّل الاختبارات**

```bash
cd apps/backend && npx jest list-bookings.handler list-payments.handler booking-confirmed.handler --no-coverage
```
Expected: 3 suites, all PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/bookings/list-bookings/list-bookings.handler.spec.ts \
        src/modules/finance/list-payments/list-payments.handler.spec.ts \
        src/modules/finance/create-invoice/booking-confirmed.handler.spec.ts
git commit -m "test(bookings,finance): strengthen list-bookings, list-payments, add booking-confirmed handler spec"
```

---

## Task 10: قياس التغطية النهائية والتحقق

- [ ] **Step 1: شغّل مجموعة الاختبارات الكاملة مع التغطية**

```bash
cd apps/backend && npm run test:cov 2>&1 | grep -E "^(All files|Jest:)"
```
Expected output مثال:
```
All files   |   85.xx   |   86.xx   |   85.xx   |   84.xx
```

- [ ] **Step 2: افحص أي module لا يزال أقل من 70%**

```bash
cd apps/backend && npm run test:cov 2>&1 | grep -E "^\s+src/" | awk -F'|' '{gsub(/ /,"",$1); gsub(/ /,"",$2); if($2+0 < 70) print $2, $1}' | sort -n
```

- [ ] **Step 3: إذا كانت التغطية الكلية لا تزال دون 85%**

افحص النتيجة وحدد أعلى 3 modules بالحجم وتغطية < 70%، أضف اختبارات targeted لها باتباع نفس نمط الـ tasks السابقة.

- [ ] **Step 4: حدّث threshold في `jest.config.js` / `jest.config.ts`**

```bash
cd apps/backend && cat jest.config.ts
```

بعد القراءة، غيّر القيم:
```typescript
coverageThreshold: {
  global: {
    branches: 80,    // كان 40
    functions: 85,   // كان 50
    lines: 85,       // كان 50
    statements: 85,  // كان 50
  },
},
```

- [ ] **Step 5: تأكد أن الـ thresholds تمر**

```bash
cd apps/backend && npm run test:cov 2>&1 | tail -10
```
Expected: لا توجد رسائل "threshold not met"

- [ ] **Step 6: Commit**

```bash
git add jest.config.ts  # أو jest.config.js حسب ما وجدته
git commit -m "test(config): raise coverage thresholds to 85% statements/lines/functions"
```

---

## ملاحظات التنفيذ

1. **نمط الـ mocks:** استخدم دائماً `buildPrisma()` و `buildEventBus()` من `booking-test-helpers.ts` لـ booking handlers. للـ modules الأخرى، ابنِ mock محلي بسيط في نفس الـ spec file.

2. **`$transaction`:** المُساعد `buildPrisma()` يدعم كلا الشكلين (array + interactive). استخدمه كما هو.

3. **قراءة قبل الكتابة:** Tasks 4, 5, 7, 8, 9 تتطلب قراءة الملف أولاً لأن الـ constructor signature قد يختلف. لا تفترض — اقرأ ثم اكتب.

4. **EventBus subscribers:** للـ event handlers التي تستخدم `register()` + `eventBus.subscribe()`, التقط الـ callback وشغّله مباشرة في الاختبار (نفس نمط PaymentCompletedEventHandler).

5. **الإصلاح الفوري:** إذا فشل اختبار بسبب constructor signature مختلف — اقرأ الملف وعدّل الـ spec، لا تعدّل الـ handler.
