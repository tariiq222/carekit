# p12 — BookingStatusLog + BookingSettings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add immutable audit trail for all booking status transitions (BookingStatusLog) and a configurable settings model (BookingSettings) that replaces hardcoded buffer times, cancellation policies, and cron thresholds.

**Architecture:** Two new Prisma models in `bookings.prisma` with immutable migrations. BookingStatusLog is written inside the same transaction as every status-changing `booking.update`. BookingSettings follows a branch → global fallback resolution: if a `branchId`-scoped row exists, use it; otherwise fall back to the tenant-level global row (`branchId = null`). Cron jobs in `cron-tasks.service.ts` read settings at runtime via `GetBookingSettingsQuery`.

**Tech Stack:** NestJS 11, Prisma 7 (PostgreSQL), existing `PrismaService`, existing `BookingsModule` / `OpsModule` patterns.

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `apps/backend/src/modules/bookings/list-booking-status-log/list-booking-status-log.handler.ts` | Query: paginated status-log timeline for a booking |
| `apps/backend/src/modules/bookings/upsert-booking-settings/upsert-booking-settings.handler.ts` | Command: upsert BookingSettings for tenantId + branchId scope |
| `apps/backend/src/modules/bookings/get-booking-settings/get-booking-settings.handler.ts` | Query: resolve settings with branch → global fallback |

### Modified files
| File | Change |
|------|--------|
| `apps/backend/prisma/schema/bookings.prisma` | Add `BookingStatusLog` + `BookingSettings` models + enums |
| `apps/backend/src/modules/bookings/confirm-booking/confirm-booking.handler.ts` | Wrap in `$transaction`, write status log |
| `apps/backend/src/modules/bookings/cancel-booking/cancel-booking.handler.ts` | Wrap in `$transaction`, write status log |
| `apps/backend/src/modules/bookings/complete-booking/complete-booking.handler.ts` | Wrap in `$transaction`, write status log |
| `apps/backend/src/modules/bookings/no-show-booking/no-show-booking.handler.ts` | Wrap in `$transaction`, write status log |
| `apps/backend/src/modules/bookings/expire-booking/expire-booking.handler.ts` | Wrap in `$transaction`, write status log |
| `apps/backend/src/modules/bookings/check-in-booking/check-in-booking.handler.ts` | Wrap in `$transaction`, write status log (no status change — logs checkedInAt) |
| `apps/backend/src/modules/bookings/payment-completed-handler/payment-completed.handler.ts` | Wrap in `$transaction`, write status log (changedBy = 'system') |
| `apps/backend/src/modules/bookings/check-availability/check-availability.handler.ts` | Apply bufferMinutes, minBookingLeadMinutes, maxAdvanceBookingDays from settings |
| `apps/backend/src/modules/bookings/cancel-booking/cancel-booking.handler.ts` | Also apply freeCancelBeforeHours / freeCancelRefundType from settings |
| `apps/backend/src/modules/bookings/reschedule-booking/reschedule-booking.handler.ts` | Apply maxReschedulesPerBooking from settings |
| `apps/backend/src/modules/ops/cron-tasks/cron-tasks.service.ts` | Read autoCompleteAfterHours, autoNoShowAfterMinutes from settings per tenant |
| `apps/backend/src/modules/bookings/bookings.module.ts` | Add 3 new handlers to providers + exports |

---

## Task 1: BookingStatusLog schema + migration

**Files:**
- Modify: `apps/backend/prisma/schema/bookings.prisma`
- Create: (migration auto-generated)

- [ ] **Step 1: Add BookingStatusLog model to bookings.prisma**

Open `apps/backend/prisma/schema/bookings.prisma` and append after the `GroupEnrollment` model:

```prisma
// ─── BookingStatusLog ─────────────────────────────────────────────────────────

model BookingStatusLog {
  id         String        @id @default(uuid())
  tenantId   String
  bookingId  String
  fromStatus BookingStatus?         // null on first transition (booking created)
  toStatus   BookingStatus
  changedBy  String                 // userId or 'system'
  reason     String?
  createdAt  DateTime      @default(now())

  @@index([bookingId])
  @@index([tenantId, createdAt])
}
```

- [ ] **Step 2: Generate migration**

```bash
cd apps/backend
npx prisma migrate dev --name p12_t1_booking_status_log --create-only
```

Expected: new folder `prisma/migrations/20260412XXXXXX_p12_t1_booking_status_log/` with `migration.sql` containing `CREATE TABLE "BookingStatusLog"`.

- [ ] **Step 3: Apply migration**

```bash
npx prisma migrate dev
```

Expected: `✔ Database migrations already applied` or `Applied 1 migration`.

- [ ] **Step 4: Run existing tests to verify no breakage**

```bash
cd apps/backend && npx jest bookings.handler.spec.ts --no-coverage
```

Expected: all tests pass (no schema-related failures).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/prisma/schema/bookings.prisma apps/backend/prisma/migrations/
git commit -m "feat(bookings): p12-t1 BookingStatusLog schema + migration"
```

---

## Task 2: Write status log in every transition handler

All status-changing handlers follow the same pattern: replace `this.prisma.booking.update(...)` with `this.prisma.$transaction(async (tx) => { ... })` and write a `BookingStatusLog` entry inside.

**Files:**
- Modify: `confirm-booking.handler.ts`, `cancel-booking.handler.ts`, `complete-booking.handler.ts`, `no-show-booking.handler.ts`, `expire-booking.handler.ts`, `check-in-booking.handler.ts`, `payment-completed.handler.ts`

### 2a — Write tests first

- [ ] **Step 1: Write failing tests for status log writes**

Open `apps/backend/src/modules/bookings/bookings.handler.spec.ts` and add to the `buildPrisma` factory a `bookingStatusLog` mock, then add test cases:

In `buildPrisma()`, add inside the returned object:
```typescript
bookingStatusLog: {
  create: jest.fn().mockResolvedValue({ id: 'log-1' }),
},
```

Then add a `describe` block (append near the end of the file, before closing):

```typescript
describe('ConfirmBookingHandler — status log', () => {
  it('writes a BookingStatusLog entry on confirm', async () => {
    const prisma = buildPrisma();
    const eventBus = { publish: jest.fn() };
    const handler = new ConfirmBookingHandler(prisma as never, eventBus as never);

    await handler.execute({ tenantId: 'tenant-1', bookingId: 'book-1', changedBy: 'user-42' });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        bookingId: 'book-1',
        fromStatus: BookingStatus.PENDING,
        toStatus: BookingStatus.CONFIRMED,
        changedBy: 'user-42',
      }),
    });
  });
});

describe('CancelBookingHandler — status log', () => {
  it('writes a BookingStatusLog entry on cancel', async () => {
    const prisma = buildPrisma();
    const eventBus = { publish: jest.fn() };
    const handler = new CancelBookingHandler(prisma as never, eventBus as never);

    await handler.execute({
      tenantId: 'tenant-1',
      bookingId: 'book-1',
      reason: CancellationReason.CLIENT_REQUESTED,
      changedBy: 'user-42',
    });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatus: BookingStatus.PENDING,
        toStatus: BookingStatus.CANCELLED,
        changedBy: 'user-42',
      }),
    });
  });
});

describe('CompleteBookingHandler — status log', () => {
  it('writes a BookingStatusLog entry on complete', async () => {
    const prisma = buildPrisma();
    const confirmedBooking = { ...mockBooking, status: BookingStatus.CONFIRMED };
    prisma.booking.findUnique.mockResolvedValue(confirmedBooking);
    const handler = new CompleteBookingHandler(prisma as never);

    await handler.execute({ tenantId: 'tenant-1', bookingId: 'book-1', changedBy: 'user-42' });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatus: BookingStatus.CONFIRMED,
        toStatus: BookingStatus.COMPLETED,
        changedBy: 'user-42',
      }),
    });
  });
});

describe('NoShowBookingHandler — status log', () => {
  it('writes a BookingStatusLog entry on no-show', async () => {
    const prisma = buildPrisma();
    const confirmedBooking = { ...mockBooking, status: BookingStatus.CONFIRMED };
    prisma.booking.findUnique.mockResolvedValue(confirmedBooking);
    const handler = new NoShowBookingHandler(prisma as never);

    await handler.execute({ tenantId: 'tenant-1', bookingId: 'book-1', changedBy: 'system' });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatus: BookingStatus.CONFIRMED,
        toStatus: BookingStatus.NO_SHOW,
        changedBy: 'system',
      }),
    });
  });
});

describe('ExpireBookingHandler — status log', () => {
  it('writes a BookingStatusLog entry on expire', async () => {
    const prisma = buildPrisma();
    const handler = new ExpireBookingHandler(prisma as never);

    await handler.execute({ tenantId: 'tenant-1', bookingId: 'book-1', changedBy: 'system' });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatus: BookingStatus.PENDING,
        toStatus: BookingStatus.EXPIRED,
        changedBy: 'system',
      }),
    });
  });
});

describe('CheckInBookingHandler — status log', () => {
  it('writes a BookingStatusLog entry on check-in', async () => {
    const prisma = buildPrisma();
    const confirmedBooking = { ...mockBooking, status: BookingStatus.CONFIRMED, checkedInAt: null };
    prisma.booking.findUnique.mockResolvedValue(confirmedBooking);
    const handler = new CheckInBookingHandler(prisma as never);

    await handler.execute({ tenantId: 'tenant-1', bookingId: 'book-1', changedBy: 'user-42' });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatus: BookingStatus.CONFIRMED,
        toStatus: BookingStatus.CONFIRMED,
        changedBy: 'user-42',
        reason: 'checked-in',
      }),
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/backend && npx jest bookings.handler.spec.ts --no-coverage
```

Expected: test failures like `prisma.bookingStatusLog.create is not a function` or `Expected mock function to have been called`.

### 2b — Update command interfaces to carry `changedBy`

- [ ] **Step 3: Update ConfirmBookingCommand + handler**

Replace full content of `apps/backend/src/modules/bookings/confirm-booking/confirm-booking.handler.ts`:

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { BookingConfirmedEvent } from '../events/booking-confirmed.event';

export interface ConfirmBookingCommand {
  tenantId: string;
  bookingId: string;
  changedBy: string; // userId or 'system'
}

@Injectable()
export class ConfirmBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(cmd: ConfirmBookingCommand) {
    const booking = await this.prisma.booking.findUnique({ where: { id: cmd.bookingId } });
    if (!booking || booking.tenantId !== cmd.tenantId) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(`Only PENDING bookings can be confirmed (status: ${booking.status})`);
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id: cmd.bookingId },
        data: { status: BookingStatus.CONFIRMED, confirmedAt: new Date() },
      }),
      this.prisma.bookingStatusLog.create({
        data: {
          tenantId: cmd.tenantId,
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: BookingStatus.CONFIRMED,
          changedBy: cmd.changedBy,
        },
      }),
    ]);

    const event = new BookingConfirmedEvent(cmd.tenantId, {
      bookingId: booking.id,
      tenantId: booking.tenantId,
      clientId: booking.clientId,
      employeeId: booking.employeeId,
      branchId: booking.branchId,
      serviceId: booking.serviceId,
      scheduledAt: booking.scheduledAt,
      price: Number(booking.price),
      currency: booking.currency,
    });
    await this.eventBus.publish(event.eventName, event.toEnvelope());

    return updated;
  }
}
```

- [ ] **Step 4: Update CancelBookingCommand + handler**

Replace full content of `apps/backend/src/modules/bookings/cancel-booking/cancel-booking.handler.ts`:

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus, CancellationReason } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { BookingCancelledEvent } from '../events/booking-cancelled.event';

export interface CancelBookingCommand {
  tenantId: string;
  bookingId: string;
  reason: CancellationReason;
  cancelNotes?: string;
  changedBy: string;
}

const CANCELLABLE_STATUSES: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.CONFIRMED];

@Injectable()
export class CancelBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(cmd: CancelBookingCommand) {
    const booking = await this.prisma.booking.findUnique({ where: { id: cmd.bookingId } });
    if (!booking || booking.tenantId !== cmd.tenantId) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    if (!CANCELLABLE_STATUSES.includes(booking.status)) {
      throw new BadRequestException(`Booking cannot be cancelled (status: ${booking.status})`);
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id: cmd.bookingId },
        data: {
          status: BookingStatus.CANCELLED,
          cancelReason: cmd.reason,
          cancelNotes: cmd.cancelNotes,
          cancelledAt: new Date(),
        },
      }),
      this.prisma.bookingStatusLog.create({
        data: {
          tenantId: cmd.tenantId,
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: BookingStatus.CANCELLED,
          changedBy: cmd.changedBy,
          reason: cmd.reason,
        },
      }),
    ]);

    const event = new BookingCancelledEvent(cmd.tenantId, {
      bookingId: booking.id,
      tenantId: booking.tenantId,
      clientId: booking.clientId,
      employeeId: booking.employeeId,
      reason: cmd.reason,
      cancelNotes: cmd.cancelNotes,
    });
    await this.eventBus.publish(event.eventName, event.toEnvelope());

    return updated;
  }
}
```

- [ ] **Step 5: Update CompleteBookingCommand + handler**

Replace full content of `apps/backend/src/modules/bookings/complete-booking/complete-booking.handler.ts`:

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface CompleteBookingCommand {
  tenantId: string;
  bookingId: string;
  completionNotes?: string;
  changedBy: string;
}

const COMPLETABLE_STATUSES: BookingStatus[] = [BookingStatus.CONFIRMED];

@Injectable()
export class CompleteBookingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: CompleteBookingCommand) {
    const booking = await this.prisma.booking.findUnique({ where: { id: cmd.bookingId } });
    if (!booking || booking.tenantId !== cmd.tenantId) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    if (!COMPLETABLE_STATUSES.includes(booking.status)) {
      throw new BadRequestException(`Booking cannot be completed (status: ${booking.status})`);
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id: cmd.bookingId },
        data: {
          status: BookingStatus.COMPLETED,
          completedAt: new Date(),
          ...(cmd.completionNotes && { notes: cmd.completionNotes }),
        },
      }),
      this.prisma.bookingStatusLog.create({
        data: {
          tenantId: cmd.tenantId,
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: BookingStatus.COMPLETED,
          changedBy: cmd.changedBy,
        },
      }),
    ]);

    return updated;
  }
}
```

- [ ] **Step 6: Update NoShowBookingCommand + handler**

Replace full content of `apps/backend/src/modules/bookings/no-show-booking/no-show-booking.handler.ts`:

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface NoShowBookingCommand {
  tenantId: string;
  bookingId: string;
  changedBy: string;
}

@Injectable()
export class NoShowBookingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: NoShowBookingCommand) {
    const booking = await this.prisma.booking.findUnique({ where: { id: cmd.bookingId } });
    if (!booking || booking.tenantId !== cmd.tenantId) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(`Only CONFIRMED bookings can be marked as no-show (status: ${booking.status})`);
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id: cmd.bookingId },
        data: {
          status: BookingStatus.NO_SHOW,
          noShowAt: new Date(),
        },
      }),
      this.prisma.bookingStatusLog.create({
        data: {
          tenantId: cmd.tenantId,
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: BookingStatus.NO_SHOW,
          changedBy: cmd.changedBy,
        },
      }),
    ]);

    return updated;
  }
}
```

- [ ] **Step 7: Update ExpireBookingCommand + handler**

Replace full content of `apps/backend/src/modules/bookings/expire-booking/expire-booking.handler.ts`:

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface ExpireBookingCommand {
  tenantId: string;
  bookingId: string;
  changedBy: string;
}

@Injectable()
export class ExpireBookingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: ExpireBookingCommand) {
    const booking = await this.prisma.booking.findUnique({ where: { id: cmd.bookingId } });
    if (!booking || booking.tenantId !== cmd.tenantId) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(`Only PENDING bookings can be expired (status: ${booking.status})`);
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id: cmd.bookingId },
        data: {
          status: BookingStatus.EXPIRED,
          expiresAt: new Date(),
        },
      }),
      this.prisma.bookingStatusLog.create({
        data: {
          tenantId: cmd.tenantId,
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: BookingStatus.EXPIRED,
          changedBy: cmd.changedBy,
        },
      }),
    ]);

    return updated;
  }
}
```

- [ ] **Step 8: Update CheckInBookingCommand + handler**

Replace full content of `apps/backend/src/modules/bookings/check-in-booking/check-in-booking.handler.ts`:

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface CheckInBookingCommand {
  tenantId: string;
  bookingId: string;
  changedBy: string;
}

/** Receptionist marks client as arrived — transitions CONFIRMED → CONFIRMED with checkedInAt timestamp. */
@Injectable()
export class CheckInBookingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: CheckInBookingCommand) {
    const booking = await this.prisma.booking.findUnique({ where: { id: cmd.bookingId } });
    if (!booking || booking.tenantId !== cmd.tenantId) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(`Only CONFIRMED bookings can be checked in (status: ${booking.status})`);
    }
    if (booking.checkedInAt) {
      throw new BadRequestException('Booking is already checked in');
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id: cmd.bookingId },
        data: { checkedInAt: new Date() },
      }),
      this.prisma.bookingStatusLog.create({
        data: {
          tenantId: cmd.tenantId,
          bookingId: cmd.bookingId,
          fromStatus: BookingStatus.CONFIRMED,
          toStatus: BookingStatus.CONFIRMED,
          changedBy: cmd.changedBy,
          reason: 'checked-in',
        },
      }),
    ]);

    return updated;
  }
}
```

- [ ] **Step 9: Update PaymentCompletedEventHandler**

Replace full content of `apps/backend/src/modules/bookings/payment-completed-handler/payment-completed.handler.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';

interface PaymentCompletedPayload {
  paymentId: string;
  invoiceId: string;
  bookingId: string;
  tenantId: string;
}

/**
 * Subscribes to finance.payment.completed events.
 * Confirms the booking automatically when full payment is received.
 */
@Injectable()
export class PaymentCompletedEventHandler {
  private readonly logger = new Logger(PaymentCompletedEventHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  register(): void {
    this.eventBus.subscribe<PaymentCompletedPayload>(
      'finance.payment.completed',
      async (envelope) => {
        const { bookingId, tenantId } = envelope.payload;
        try {
          const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
          if (!booking || booking.tenantId !== tenantId) return;
          if (booking.status !== 'PENDING') return;

          await this.prisma.$transaction([
            this.prisma.booking.update({
              where: { id: bookingId },
              data: { status: 'CONFIRMED', confirmedAt: new Date() },
            }),
            this.prisma.bookingStatusLog.create({
              data: {
                tenantId,
                bookingId,
                fromStatus: booking.status,
                toStatus: 'CONFIRMED',
                changedBy: 'system',
                reason: `payment:${envelope.payload.paymentId}`,
              },
            }),
          ]);
        } catch (err) {
          this.logger.error(`Failed to confirm booking ${bookingId} after payment`, err);
          throw err;
        }
      },
    );
  }
}
```

- [ ] **Step 10: Run tests to verify they pass**

```bash
cd apps/backend && npx jest bookings.handler.spec.ts --no-coverage
```

Expected: all tests pass, including the new status-log tests. The mock `$transaction` in `buildPrisma` needs to accept an array and return resolved values. If `$transaction` is not mocked yet, add it:

In the test file's `buildPrisma()`, add:
```typescript
$transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
```

Re-run until green.

- [ ] **Step 11: Commit**

```bash
git add apps/backend/src/modules/bookings/confirm-booking/ \
        apps/backend/src/modules/bookings/cancel-booking/ \
        apps/backend/src/modules/bookings/complete-booking/ \
        apps/backend/src/modules/bookings/no-show-booking/ \
        apps/backend/src/modules/bookings/expire-booking/ \
        apps/backend/src/modules/bookings/check-in-booking/ \
        apps/backend/src/modules/bookings/payment-completed-handler/ \
        apps/backend/src/modules/bookings/bookings.handler.spec.ts
git commit -m "feat(bookings): p12-t2 write BookingStatusLog in every status transition"
```

---

## Task 3: ListBookingStatusLog query

**Files:**
- Create: `apps/backend/src/modules/bookings/list-booking-status-log/list-booking-status-log.handler.ts`
- Modify: `apps/backend/src/modules/bookings/bookings.module.ts`

- [ ] **Step 1: Write the failing test**

Append to `apps/backend/src/modules/bookings/bookings.handler.spec.ts`:

```typescript
import { ListBookingStatusLogHandler } from './list-booking-status-log/list-booking-status-log.handler';

describe('ListBookingStatusLogHandler', () => {
  const mockLog = {
    id: 'log-1',
    tenantId: 'tenant-1',
    bookingId: 'book-1',
    fromStatus: BookingStatus.PENDING,
    toStatus: BookingStatus.CONFIRMED,
    changedBy: 'user-42',
    reason: null,
    createdAt: new Date(),
  };

  it('returns logs ordered by createdAt asc for a booking', async () => {
    const prisma = buildPrisma();
    (prisma as any).bookingStatusLog = {
      findMany: jest.fn().mockResolvedValue([mockLog]),
    };
    const handler = new ListBookingStatusLogHandler(prisma as never);

    const result = await handler.execute({ tenantId: 'tenant-1', bookingId: 'book-1' });

    expect(prisma.bookingStatusLog.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', bookingId: 'book-1' },
      orderBy: { createdAt: 'asc' },
    });
    expect(result).toEqual([mockLog]);
  });

  it('returns empty array when booking has no log entries', async () => {
    const prisma = buildPrisma();
    (prisma as any).bookingStatusLog = { findMany: jest.fn().mockResolvedValue([]) };
    const handler = new ListBookingStatusLogHandler(prisma as never);

    const result = await handler.execute({ tenantId: 'tenant-1', bookingId: 'no-logs' });

    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/backend && npx jest bookings.handler.spec.ts --no-coverage -t "ListBookingStatusLogHandler"
```

Expected: `Cannot find module './list-booking-status-log/list-booking-status-log.handler'`.

- [ ] **Step 3: Create the handler**

Create `apps/backend/src/modules/bookings/list-booking-status-log/list-booking-status-log.handler.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import type { BookingStatusLog } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface ListBookingStatusLogQuery {
  tenantId: string;
  bookingId: string;
}

@Injectable()
export class ListBookingStatusLogHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListBookingStatusLogQuery): Promise<BookingStatusLog[]> {
    return this.prisma.bookingStatusLog.findMany({
      where: { tenantId: query.tenantId, bookingId: query.bookingId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/backend && npx jest bookings.handler.spec.ts --no-coverage -t "ListBookingStatusLogHandler"
```

Expected: 2 tests pass.

- [ ] **Step 5: Wire handler into BookingsModule**

Open `apps/backend/src/modules/bookings/bookings.module.ts` and:

1. Add import at top:
```typescript
import { ListBookingStatusLogHandler } from './list-booking-status-log/list-booking-status-log.handler';
```

2. Add `ListBookingStatusLogHandler` to the `handlers` array (before the closing `]`):
```typescript
  ListBookingStatusLogHandler,
```

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/bookings/list-booking-status-log/ \
        apps/backend/src/modules/bookings/bookings.module.ts \
        apps/backend/src/modules/bookings/bookings.handler.spec.ts
git commit -m "feat(bookings): p12-t3 ListBookingStatusLogHandler"
```

---

## Task 4: BookingSettings schema + migration

**Files:**
- Modify: `apps/backend/prisma/schema/bookings.prisma`
- Create: (migration auto-generated)

- [ ] **Step 1: Add enums + BookingSettings model to bookings.prisma**

Open `apps/backend/prisma/schema/bookings.prisma` and append after the `BookingStatusLog` model:

```prisma
// ─── BookingSettings ──────────────────────────────────────────────────────────

enum RefundType {
  FULL
  PARTIAL
  NONE
}

model BookingSettings {
  id                        String     @id @default(uuid())
  tenantId                  String
  branchId                  String?    // null = global default for tenant

  bufferMinutes             Int        @default(0)    // gap between consecutive bookings
  freeCancelBeforeHours     Int        @default(24)   // free cancellation window
  freeCancelRefundType      RefundType @default(FULL)
  lateCancelRefundPercent   Int        @default(0)    // 0–100

  maxReschedulesPerBooking  Int        @default(3)

  autoCompleteAfterHours    Int        @default(2)    // complete booking N hours after endsAt
  autoNoShowAfterMinutes    Int        @default(30)   // mark no-show N min after scheduledAt

  minBookingLeadMinutes     Int        @default(60)   // must book at least N min ahead
  maxAdvanceBookingDays     Int        @default(90)   // cannot book more than N days ahead

  waitlistEnabled           Boolean    @default(true)
  waitlistMaxPerSlot        Int        @default(5)

  createdAt                 DateTime   @default(now())
  updatedAt                 DateTime   @updatedAt

  @@unique([tenantId, branchId])
  @@index([tenantId])
}
```

- [ ] **Step 2: Generate migration**

```bash
cd apps/backend
npx prisma migrate dev --name p12_t4_booking_settings --create-only
```

Expected: new migration folder with `CREATE TABLE "BookingSettings"` and `CREATE TYPE "RefundType"`.

- [ ] **Step 3: Apply migration**

```bash
npx prisma migrate dev
```

Expected: `Applied 1 migration`.

- [ ] **Step 4: Run existing tests to verify no breakage**

```bash
cd apps/backend && npx jest bookings.handler.spec.ts --no-coverage
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/prisma/schema/bookings.prisma apps/backend/prisma/migrations/
git commit -m "feat(bookings): p12-t4 BookingSettings schema + migration"
```

---

## Task 5: UpsertBookingSettings + GetBookingSettings handlers

**Files:**
- Create: `apps/backend/src/modules/bookings/upsert-booking-settings/upsert-booking-settings.handler.ts`
- Create: `apps/backend/src/modules/bookings/get-booking-settings/get-booking-settings.handler.ts`
- Modify: `apps/backend/src/modules/bookings/bookings.module.ts`

### 5a — GetBookingSettings

- [ ] **Step 1: Write failing tests**

Append to `apps/backend/src/modules/bookings/bookings.handler.spec.ts`:

```typescript
import { GetBookingSettingsHandler } from './get-booking-settings/get-booking-settings.handler';
import { UpsertBookingSettingsHandler } from './upsert-booking-settings/upsert-booking-settings.handler';

const defaultSettings = {
  id: 'settings-1',
  tenantId: 'tenant-1',
  branchId: null,
  bufferMinutes: 0,
  freeCancelBeforeHours: 24,
  freeCancelRefundType: 'FULL',
  lateCancelRefundPercent: 0,
  maxReschedulesPerBooking: 3,
  autoCompleteAfterHours: 2,
  autoNoShowAfterMinutes: 30,
  minBookingLeadMinutes: 60,
  maxAdvanceBookingDays: 90,
  waitlistEnabled: true,
  waitlistMaxPerSlot: 5,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('GetBookingSettingsHandler', () => {
  it('returns branch-level settings when they exist', async () => {
    const branchSettings = { ...defaultSettings, id: 'settings-branch', branchId: 'branch-1', bufferMinutes: 10 };
    const prisma = buildPrisma();
    (prisma as any).bookingSettings = {
      findUnique: jest.fn()
        .mockResolvedValueOnce(branchSettings)  // branch lookup
        .mockResolvedValueOnce(defaultSettings), // global lookup (should not be called)
    };
    const handler = new GetBookingSettingsHandler(prisma as never);

    const result = await handler.execute({ tenantId: 'tenant-1', branchId: 'branch-1' });

    expect(result.bufferMinutes).toBe(10);
    expect(prisma.bookingSettings.findUnique).toHaveBeenCalledTimes(1);
  });

  it('falls back to global settings when no branch-level row exists', async () => {
    const prisma = buildPrisma();
    (prisma as any).bookingSettings = {
      findUnique: jest.fn()
        .mockResolvedValueOnce(null)            // branch lookup: not found
        .mockResolvedValueOnce(defaultSettings), // global lookup
    };
    const handler = new GetBookingSettingsHandler(prisma as never);

    const result = await handler.execute({ tenantId: 'tenant-1', branchId: 'branch-1' });

    expect(result.bufferMinutes).toBe(0);
    expect(prisma.bookingSettings.findUnique).toHaveBeenCalledTimes(2);
  });

  it('returns hardcoded defaults when no settings row exists at all', async () => {
    const prisma = buildPrisma();
    (prisma as any).bookingSettings = {
      findUnique: jest.fn().mockResolvedValue(null),
    };
    const handler = new GetBookingSettingsHandler(prisma as never);

    const result = await handler.execute({ tenantId: 'tenant-1', branchId: 'branch-1' });

    expect(result.bufferMinutes).toBe(0);
    expect(result.freeCancelBeforeHours).toBe(24);
    expect(result.maxReschedulesPerBooking).toBe(3);
  });
});

describe('UpsertBookingSettingsHandler', () => {
  it('upserts settings for a given tenantId + branchId', async () => {
    const prisma = buildPrisma();
    (prisma as any).bookingSettings = {
      upsert: jest.fn().mockResolvedValue({ ...defaultSettings, bufferMinutes: 15 }),
    };
    const handler = new UpsertBookingSettingsHandler(prisma as never);

    const result = await handler.execute({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      bufferMinutes: 15,
    });

    expect(prisma.bookingSettings.upsert).toHaveBeenCalledWith({
      where: { tenantId_branchId: { tenantId: 'tenant-1', branchId: 'branch-1' } },
      update: { bufferMinutes: 15 },
      create: expect.objectContaining({ tenantId: 'tenant-1', branchId: 'branch-1', bufferMinutes: 15 }),
    });
    expect(result.bufferMinutes).toBe(15);
  });

  it('upserts global settings when branchId is null', async () => {
    const prisma = buildPrisma();
    (prisma as any).bookingSettings = {
      upsert: jest.fn().mockResolvedValue(defaultSettings),
    };
    const handler = new UpsertBookingSettingsHandler(prisma as never);

    await handler.execute({ tenantId: 'tenant-1', branchId: null, bufferMinutes: 5 });

    expect(prisma.bookingSettings.upsert).toHaveBeenCalledWith({
      where: { tenantId_branchId: { tenantId: 'tenant-1', branchId: null } },
      update: { bufferMinutes: 5 },
      create: expect.objectContaining({ tenantId: 'tenant-1', branchId: null }),
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/backend && npx jest bookings.handler.spec.ts --no-coverage -t "GetBookingSettingsHandler|UpsertBookingSettingsHandler"
```

Expected: `Cannot find module` errors.

- [ ] **Step 3: Create GetBookingSettingsHandler**

Create `apps/backend/src/modules/bookings/get-booking-settings/get-booking-settings.handler.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import type { BookingSettings } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface GetBookingSettingsQuery {
  tenantId: string;
  branchId: string | null;
}

/** Hardcoded fallback used when no DB row exists for the tenant at all. */
export const DEFAULT_BOOKING_SETTINGS = {
  bufferMinutes: 0,
  freeCancelBeforeHours: 24,
  freeCancelRefundType: 'FULL' as const,
  lateCancelRefundPercent: 0,
  maxReschedulesPerBooking: 3,
  autoCompleteAfterHours: 2,
  autoNoShowAfterMinutes: 30,
  minBookingLeadMinutes: 60,
  maxAdvanceBookingDays: 90,
  waitlistEnabled: true,
  waitlistMaxPerSlot: 5,
} as const;

export type ResolvedBookingSettings = typeof DEFAULT_BOOKING_SETTINGS;

@Injectable()
export class GetBookingSettingsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetBookingSettingsQuery): Promise<BookingSettings | ResolvedBookingSettings> {
    // Branch-level row first.
    if (query.branchId) {
      const branchRow = await this.prisma.bookingSettings.findUnique({
        where: { tenantId_branchId: { tenantId: query.tenantId, branchId: query.branchId } },
      });
      if (branchRow) return branchRow;
    }

    // Global fallback.
    const globalRow = await this.prisma.bookingSettings.findUnique({
      where: { tenantId_branchId: { tenantId: query.tenantId, branchId: null } },
    });
    if (globalRow) return globalRow;

    // Hardcoded defaults — tenant has never configured settings.
    return DEFAULT_BOOKING_SETTINGS;
  }
}
```

- [ ] **Step 4: Create UpsertBookingSettingsHandler**

Create `apps/backend/src/modules/bookings/upsert-booking-settings/upsert-booking-settings.handler.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import type { BookingSettings, RefundType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface UpsertBookingSettingsCommand {
  tenantId: string;
  branchId: string | null;
  bufferMinutes?: number;
  freeCancelBeforeHours?: number;
  freeCancelRefundType?: RefundType;
  lateCancelRefundPercent?: number;
  maxReschedulesPerBooking?: number;
  autoCompleteAfterHours?: number;
  autoNoShowAfterMinutes?: number;
  minBookingLeadMinutes?: number;
  maxAdvanceBookingDays?: number;
  waitlistEnabled?: boolean;
  waitlistMaxPerSlot?: number;
}

@Injectable()
export class UpsertBookingSettingsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpsertBookingSettingsCommand): Promise<BookingSettings> {
    const {
      tenantId,
      branchId,
      bufferMinutes,
      freeCancelBeforeHours,
      freeCancelRefundType,
      lateCancelRefundPercent,
      maxReschedulesPerBooking,
      autoCompleteAfterHours,
      autoNoShowAfterMinutes,
      minBookingLeadMinutes,
      maxAdvanceBookingDays,
      waitlistEnabled,
      waitlistMaxPerSlot,
    } = cmd;

    const updateData = Object.fromEntries(
      Object.entries({
        bufferMinutes,
        freeCancelBeforeHours,
        freeCancelRefundType,
        lateCancelRefundPercent,
        maxReschedulesPerBooking,
        autoCompleteAfterHours,
        autoNoShowAfterMinutes,
        minBookingLeadMinutes,
        maxAdvanceBookingDays,
        waitlistEnabled,
        waitlistMaxPerSlot,
      }).filter(([, v]) => v !== undefined),
    );

    return this.prisma.bookingSettings.upsert({
      where: { tenantId_branchId: { tenantId, branchId } },
      update: updateData,
      create: { tenantId, branchId, ...updateData },
    });
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/backend && npx jest bookings.handler.spec.ts --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: Wire both handlers into BookingsModule**

In `apps/backend/src/modules/bookings/bookings.module.ts`, add imports and add to `handlers` array:

```typescript
import { GetBookingSettingsHandler } from './get-booking-settings/get-booking-settings.handler';
import { UpsertBookingSettingsHandler } from './upsert-booking-settings/upsert-booking-settings.handler';
```

Add both to `handlers`:
```typescript
  GetBookingSettingsHandler,
  UpsertBookingSettingsHandler,
```

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/bookings/get-booking-settings/ \
        apps/backend/src/modules/bookings/upsert-booking-settings/ \
        apps/backend/src/modules/bookings/bookings.module.ts \
        apps/backend/src/modules/bookings/bookings.handler.spec.ts
git commit -m "feat(bookings): p12-t5a GetBookingSettings + UpsertBookingSettings handlers"
```

---

## Task 6: Apply settings in CheckAvailabilityHandler

**Files:**
- Modify: `apps/backend/src/modules/bookings/check-availability/check-availability.handler.ts`

The handler needs to:
1. Inject `GetBookingSettingsHandler`
2. Apply `bufferMinutes` between slots (expand each existing booking's occupied window)
3. Apply `minBookingLeadMinutes` (earliest allowed slot = `now + minBookingLeadMinutes`)
4. Apply `maxAdvanceBookingDays` (reject date if beyond `today + maxAdvanceBookingDays`)

- [ ] **Step 1: Write failing tests**

Append to `apps/backend/src/modules/bookings/bookings.handler.spec.ts`:

```typescript
describe('CheckAvailabilityHandler — settings enforcement', () => {
  const buildSettingsHandler = (overrides: Partial<typeof import('./get-booking-settings/get-booking-settings.handler').DEFAULT_BOOKING_SETTINGS> = {}) => ({
    execute: jest.fn().mockResolvedValue({
      bufferMinutes: 0,
      minBookingLeadMinutes: 0,
      maxAdvanceBookingDays: 90,
      ...overrides,
    }),
  });

  it('returns empty array when date exceeds maxAdvanceBookingDays', async () => {
    const prisma = buildPrisma();
    const settingsHandler = buildSettingsHandler({ maxAdvanceBookingDays: 7 });
    const handler = new CheckAvailabilityHandler(prisma as never, settingsHandler as never);

    const farFuture = new Date(Date.now() + 30 * 86400_000); // 30 days ahead
    const result = await handler.execute({
      tenantId: 'tenant-1',
      employeeId: 'emp-1',
      branchId: 'branch-1',
      date: farFuture,
      durationMins: 60,
    });

    expect(result).toEqual([]);
  });

  it('excludes slots within bufferMinutes of an existing booking', async () => {
    const prisma = buildPrisma();
    // Existing booking: 09:00–10:00 with 15 min buffer → occupied until 10:15
    const tomorrow = new Date(Date.now() + 86400_000);
    tomorrow.setHours(0, 0, 0, 0);
    const bookingStart = new Date(tomorrow); bookingStart.setHours(9, 0, 0, 0);
    const bookingEnd   = new Date(tomorrow); bookingEnd.setHours(10, 0, 0, 0);
    prisma.booking.findMany.mockResolvedValue([{
      ...mockBooking,
      scheduledAt: bookingStart,
      endsAt: bookingEnd,
      durationMins: 60,
    }]);
    const settingsHandler = buildSettingsHandler({ bufferMinutes: 15, minBookingLeadMinutes: 0 });
    const handler = new CheckAvailabilityHandler(prisma as never, settingsHandler as never);

    const slots = await handler.execute({
      tenantId: 'tenant-1',
      employeeId: 'emp-1',
      branchId: 'branch-1',
      date: tomorrow,
      durationMins: 60,
    });

    // 10:00 slot should be blocked (within buffer). 10:15 should be free.
    const tenAM = new Date(tomorrow); tenAM.setHours(10, 0, 0, 0);
    const tenFifteen = new Date(tomorrow); tenFifteen.setHours(10, 15, 0, 0);
    const blockedAt10 = slots.some(s => s.startTime.getTime() === tenAM.getTime());
    const freeAt1015 = slots.some(s => s.startTime.getTime() === tenFifteen.getTime());
    expect(blockedAt10).toBe(false);
    expect(freeAt1015).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/backend && npx jest bookings.handler.spec.ts --no-coverage -t "CheckAvailabilityHandler — settings"
```

Expected: constructor arg count mismatch or assertion failures.

- [ ] **Step 3: Update CheckAvailabilityHandler**

Replace full content of `apps/backend/src/modules/bookings/check-availability/check-availability.handler.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import type { BookingType } from '@prisma/client';

export interface CheckAvailabilityQuery {
  tenantId: string;
  employeeId: string;
  branchId: string;
  date: Date;
  /** Explicit duration — used when serviceId/durationOptionId are not provided */
  durationMins?: number;
  /** When provided the handler resolves durationMins from the matching ServiceDurationOption */
  serviceId?: string;
  durationOptionId?: string | null;
  bookingType?: BookingType | null;
}

export interface AvailableSlot {
  startTime: Date;
  endTime: Date;
}

const SLOT_INTERVAL_MINS = 30;

function parseHHmm(hhmm: string, anchor: Date): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(anchor);
  d.setHours(h, m, 0, 0);
  return d;
}

function intersectWindows(
  a: [Date, Date],
  b: [Date, Date],
): [Date, Date] | null {
  const start = a[0] > b[0] ? a[0] : b[0];
  const end = a[1] < b[1] ? a[1] : b[1];
  return start < end ? [start, end] : null;
}

@Injectable()
export class CheckAvailabilityHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsHandler: GetBookingSettingsHandler,
  ) {}

  async execute(query: CheckAvailabilityQuery): Promise<AvailableSlot[]> {
    const settings = await this.settingsHandler.execute({
      tenantId: query.tenantId,
      branchId: query.branchId,
    });

    const dateOnly = new Date(query.date);
    dateOnly.setHours(0, 0, 0, 0);

    // Reject dates beyond maxAdvanceBookingDays.
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + settings.maxAdvanceBookingDays);
    maxDate.setHours(23, 59, 59, 999);
    if (dateOnly > maxDate) return [];

    // Resolve durationMins from ServiceDurationOption when serviceId is given.
    let durationMins = query.durationMins ?? 0;
    if (query.serviceId) {
      const option = await this.resolveDurationOption(query.tenantId, query.serviceId, query.durationOptionId ?? null, query.bookingType ?? null);
      if (option) durationMins = option.durationMins;
    }
    if (!durationMins) return [];

    const dayOfWeek = dateOnly.getDay();

    const [businessHour, holiday, shifts, exception] = await Promise.all([
      this.prisma.businessHour.findUnique({
        where: { branchId_dayOfWeek: { branchId: query.branchId, dayOfWeek } },
      }),
      this.prisma.holiday.findFirst({
        where: { branchId: query.branchId, date: dateOnly },
      }),
      this.prisma.employeeAvailability.findMany({
        where: { employeeId: query.employeeId, dayOfWeek, isActive: true },
        orderBy: { startTime: 'asc' },
      }),
      this.prisma.employeeAvailabilityException.findFirst({
        where: {
          employeeId: query.employeeId,
          startDate: { lte: dateOnly },
          endDate: { gte: dateOnly },
        },
      }),
    ]);

    if (!businessHour || !businessHour.isOpen) return [];
    if (holiday) return [];
    if (exception) return [];
    if (shifts.length === 0) return [];

    const branchWindow: [Date, Date] = [
      parseHHmm(businessHour.startTime, dateOnly),
      parseHHmm(businessHour.endTime, dateOnly),
    ];

    const windows: [Date, Date][] = [];
    for (const shift of shifts) {
      const shiftWindow: [Date, Date] = [
        parseHHmm(shift.startTime, dateOnly),
        parseHHmm(shift.endTime, dateOnly),
      ];
      const intersection = intersectWindows(shiftWindow, branchWindow);
      if (intersection) windows.push(intersection);
    }

    if (windows.length === 0) return [];

    const earliestStart = windows[0][0];
    const latestEnd = windows[windows.length - 1][1];

    const existingBookings = await this.prisma.booking.findMany({
      where: {
        tenantId: query.tenantId,
        employeeId: query.employeeId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        scheduledAt: { gte: earliestStart, lt: latestEnd },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    // Earliest allowed start = now + minBookingLeadMinutes.
    const earliestAllowed = new Date(Date.now() + settings.minBookingLeadMinutes * 60_000);
    const bufferMs = settings.bufferMinutes * 60_000;

    const slots: AvailableSlot[] = [];

    for (const [windowStart, windowEnd] of windows) {
      let cursor = new Date(windowStart);
      while (cursor.getTime() + durationMins * 60_000 <= windowEnd.getTime()) {
        const slotEnd = new Date(cursor.getTime() + durationMins * 60_000);

        const hasConflict = existingBookings.some((b) => {
          // Extend each booking's end by bufferMinutes.
          const bEnd = new Date(b.scheduledAt.getTime() + b.durationMins * 60_000 + bufferMs);
          return b.scheduledAt < slotEnd && bEnd > cursor;
        });

        if (!hasConflict && cursor >= earliestAllowed) {
          slots.push({ startTime: new Date(cursor), endTime: slotEnd });
        }

        cursor = new Date(cursor.getTime() + SLOT_INTERVAL_MINS * 60_000);
      }
    }

    return slots;
  }

  private async resolveDurationOption(
    tenantId: string,
    serviceId: string,
    durationOptionId: string | null,
    bookingType: BookingType | null,
  ) {
    if (durationOptionId) {
      return this.prisma.serviceDurationOption.findFirst({
        where: { id: durationOptionId, tenantId, serviceId, isActive: true },
        select: { durationMins: true },
      });
    }
    if (bookingType) {
      const scoped = await this.prisma.serviceDurationOption.findFirst({
        where: { tenantId, serviceId, bookingType, isDefault: true, isActive: true },
        select: { durationMins: true },
      });
      if (scoped) return scoped;
    }
    const global = await this.prisma.serviceDurationOption.findFirst({
      where: { tenantId, serviceId, bookingType: null, isDefault: true, isActive: true },
      select: { durationMins: true },
    });
    if (global) return global;
    return this.prisma.serviceDurationOption.findFirst({
      where: { tenantId, serviceId, isActive: true },
      orderBy: [{ bookingType: 'asc' }, { sortOrder: 'asc' }],
      select: { durationMins: true },
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/backend && npx jest bookings.handler.spec.ts --no-coverage
```

Expected: all pass. The existing `CheckAvailabilityHandler` tests use `buildPrisma()` which returns a mock — update the `new CheckAvailabilityHandler(prisma as never)` call in existing tests to pass a settings handler mock too:

Find existing `CheckAvailabilityHandler` test setup and change:
```typescript
const handler = new CheckAvailabilityHandler(prisma as never);
```
to:
```typescript
const defaultSettingsHandler = { execute: jest.fn().mockResolvedValue({ bufferMinutes: 0, minBookingLeadMinutes: 0, maxAdvanceBookingDays: 90 }) };
const handler = new CheckAvailabilityHandler(prisma as never, defaultSettingsHandler as never);
```

Re-run until green.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/bookings/check-availability/ \
        apps/backend/src/modules/bookings/bookings.handler.spec.ts
git commit -m "feat(bookings): p12-t5b apply settings in CheckAvailabilityHandler"
```

---

## Task 7: Apply settings in CancelBookingHandler (free cancel window)

**Files:**
- Modify: `apps/backend/src/modules/bookings/cancel-booking/cancel-booking.handler.ts`

The cancel handler needs to inject `GetBookingSettingsHandler` and attach `freeCancelRefundType` to the response so callers know the refund entitlement. It does **not** process refunds itself (that belongs to the payments BC) — it only determines and returns the refund type.

- [ ] **Step 1: Write failing test**

Append to `apps/backend/src/modules/bookings/bookings.handler.spec.ts`:

```typescript
describe('CancelBookingHandler — free cancel window', () => {
  it('attaches FULL refundType when cancelling within free window', async () => {
    const prisma = buildPrisma();
    const eventBus = { publish: jest.fn() };
    // Booking scheduled 48 hours from now, cancelling 48h before = within 24h free window.
    const in48h = new Date(Date.now() + 48 * 3600_000);
    prisma.booking.findUnique.mockResolvedValue({ ...mockBooking, scheduledAt: in48h });
    const settingsHandler = { execute: jest.fn().mockResolvedValue({
      freeCancelBeforeHours: 24,
      freeCancelRefundType: 'FULL',
      lateCancelRefundPercent: 0,
    })};
    const handler = new CancelBookingHandler(prisma as never, eventBus as never, settingsHandler as never);

    const result = await handler.execute({
      tenantId: 'tenant-1', bookingId: 'book-1',
      reason: CancellationReason.CLIENT_REQUESTED,
      changedBy: 'user-42',
    });

    expect(result.refundType).toBe('FULL');
  });

  it('attaches NONE refundType when cancelling outside free window', async () => {
    const prisma = buildPrisma();
    const eventBus = { publish: jest.fn() };
    // Booking scheduled 10 hours from now, past the 24h free window.
    const in10h = new Date(Date.now() + 10 * 3600_000);
    prisma.booking.findUnique.mockResolvedValue({ ...mockBooking, scheduledAt: in10h });
    const settingsHandler = { execute: jest.fn().mockResolvedValue({
      freeCancelBeforeHours: 24,
      freeCancelRefundType: 'FULL',
      lateCancelRefundPercent: 0,
    })};
    const handler = new CancelBookingHandler(prisma as never, eventBus as never, settingsHandler as never);

    const result = await handler.execute({
      tenantId: 'tenant-1', bookingId: 'book-1',
      reason: CancellationReason.CLIENT_REQUESTED,
      changedBy: 'user-42',
    });

    expect(result.refundType).toBe('NONE');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/backend && npx jest bookings.handler.spec.ts --no-coverage -t "CancelBookingHandler — free cancel"
```

Expected: `result.refundType is undefined`.

- [ ] **Step 3: Update CancelBookingHandler**

Replace full content of `apps/backend/src/modules/bookings/cancel-booking/cancel-booking.handler.ts`:

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus, CancellationReason } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { BookingCancelledEvent } from '../events/booking-cancelled.event';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';

export interface CancelBookingCommand {
  tenantId: string;
  bookingId: string;
  reason: CancellationReason;
  cancelNotes?: string;
  changedBy: string;
}

const CANCELLABLE_STATUSES: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.CONFIRMED];

@Injectable()
export class CancelBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly settingsHandler: GetBookingSettingsHandler,
  ) {}

  async execute(cmd: CancelBookingCommand) {
    const booking = await this.prisma.booking.findUnique({ where: { id: cmd.bookingId } });
    if (!booking || booking.tenantId !== cmd.tenantId) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    if (!CANCELLABLE_STATUSES.includes(booking.status)) {
      throw new BadRequestException(`Booking cannot be cancelled (status: ${booking.status})`);
    }

    const settings = await this.settingsHandler.execute({
      tenantId: cmd.tenantId,
      branchId: booking.branchId,
    });

    const hoursUntilBooking = (booking.scheduledAt.getTime() - Date.now()) / 3_600_000;
    const isWithinFreeWindow = hoursUntilBooking >= settings.freeCancelBeforeHours;
    const refundType = isWithinFreeWindow
      ? settings.freeCancelRefundType
      : 'NONE';

    const [updated] = await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id: cmd.bookingId },
        data: {
          status: BookingStatus.CANCELLED,
          cancelReason: cmd.reason,
          cancelNotes: cmd.cancelNotes,
          cancelledAt: new Date(),
        },
      }),
      this.prisma.bookingStatusLog.create({
        data: {
          tenantId: cmd.tenantId,
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: BookingStatus.CANCELLED,
          changedBy: cmd.changedBy,
          reason: cmd.reason,
        },
      }),
    ]);

    const event = new BookingCancelledEvent(cmd.tenantId, {
      bookingId: booking.id,
      tenantId: booking.tenantId,
      clientId: booking.clientId,
      employeeId: booking.employeeId,
      reason: cmd.reason,
      cancelNotes: cmd.cancelNotes,
    });
    await this.eventBus.publish(event.eventName, event.toEnvelope());

    return { ...updated, refundType };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/backend && npx jest bookings.handler.spec.ts --no-coverage
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/bookings/cancel-booking/ \
        apps/backend/src/modules/bookings/bookings.handler.spec.ts
git commit -m "feat(bookings): p12-t5c apply freeCancelBeforeHours in CancelBookingHandler"
```

---

## Task 8: Apply maxReschedulesPerBooking in RescheduleBookingHandler

**Files:**
- Modify: `apps/backend/src/modules/bookings/reschedule-booking/reschedule-booking.handler.ts`

`maxReschedulesPerBooking` requires counting `BookingStatusLog` entries where `reason` includes a reschedule marker. The cleanest approach: count logs where `fromStatus IN (PENDING, CONFIRMED)` and `toStatus IN (PENDING, CONFIRMED)` and `reason = 'rescheduled'` for this `bookingId`.

The `RescheduleBookingHandler` also needs to write a status log entry (transition stays within PENDING/CONFIRMED, but the action is recorded).

- [ ] **Step 1: Write failing tests**

Append to `apps/backend/src/modules/bookings/bookings.handler.spec.ts`:

```typescript
describe('RescheduleBookingHandler — maxReschedulesPerBooking', () => {
  const buildRescheduleSetup = (rescheduleCount: number, maxReschedules = 3) => {
    const prisma = buildPrisma();
    (prisma as any).bookingStatusLog = {
      count: jest.fn().mockResolvedValue(rescheduleCount),
      create: jest.fn().mockResolvedValue({ id: 'log-1' }),
    };
    const settingsHandler = {
      execute: jest.fn().mockResolvedValue({ maxReschedulesPerBooking: maxReschedules }),
    };
    return { prisma, settingsHandler };
  };

  it('allows reschedule when count is below max', async () => {
    const { prisma, settingsHandler } = buildRescheduleSetup(2, 3);
    const handler = new RescheduleBookingHandler(prisma as never, settingsHandler as never);
    const newTime = new Date(Date.now() + 2 * 86400_000);

    await expect(
      handler.execute({ tenantId: 'tenant-1', bookingId: 'book-1', newScheduledAt: newTime, changedBy: 'user-42' }),
    ).resolves.toBeDefined();
  });

  it('throws BadRequestException when max reschedules reached', async () => {
    const { prisma, settingsHandler } = buildRescheduleSetup(3, 3);
    const handler = new RescheduleBookingHandler(prisma as never, settingsHandler as never);
    const newTime = new Date(Date.now() + 2 * 86400_000);

    await expect(
      handler.execute({ tenantId: 'tenant-1', bookingId: 'book-1', newScheduledAt: newTime, changedBy: 'user-42' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('writes a BookingStatusLog entry on reschedule', async () => {
    const { prisma, settingsHandler } = buildRescheduleSetup(0, 3);
    const handler = new RescheduleBookingHandler(prisma as never, settingsHandler as never);
    const newTime = new Date(Date.now() + 2 * 86400_000);

    await handler.execute({ tenantId: 'tenant-1', bookingId: 'book-1', newScheduledAt: newTime, changedBy: 'user-42' });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId: 'book-1',
        reason: 'rescheduled',
        changedBy: 'user-42',
      }),
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/backend && npx jest bookings.handler.spec.ts --no-coverage -t "RescheduleBookingHandler"
```

Expected: constructor arg mismatch or assertion failures.

- [ ] **Step 3: Update RescheduleBookingHandler**

Replace full content of `apps/backend/src/modules/bookings/reschedule-booking/reschedule-booking.handler.ts`:

```typescript
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';

export interface RescheduleBookingCommand {
  tenantId: string;
  bookingId: string;
  newScheduledAt: Date;
  newDurationMins?: number;
  changedBy: string;
}

@Injectable()
export class RescheduleBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsHandler: GetBookingSettingsHandler,
  ) {}

  async execute(cmd: RescheduleBookingCommand) {
    const booking = await this.prisma.booking.findUnique({ where: { id: cmd.bookingId } });
    if (!booking || booking.tenantId !== cmd.tenantId) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    if (booking.status !== BookingStatus.PENDING && booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(`Booking cannot be rescheduled (status: ${booking.status})`);
    }

    const newScheduledAt = new Date(cmd.newScheduledAt);
    if (newScheduledAt <= new Date()) {
      throw new BadRequestException('New scheduled time must be in the future');
    }

    const settings = await this.settingsHandler.execute({
      tenantId: cmd.tenantId,
      branchId: booking.branchId,
    });

    const rescheduleCount = await this.prisma.bookingStatusLog.count({
      where: { bookingId: cmd.bookingId, reason: 'rescheduled' },
    });
    if (rescheduleCount >= settings.maxReschedulesPerBooking) {
      throw new BadRequestException(
        `Maximum reschedules (${settings.maxReschedulesPerBooking}) reached for this booking`,
      );
    }

    const durationMins = cmd.newDurationMins ?? booking.durationMins;
    const newEndsAt = new Date(newScheduledAt.getTime() + durationMins * 60_000);

    const conflict = await this.prisma.booking.findFirst({
      where: {
        tenantId: cmd.tenantId,
        employeeId: booking.employeeId,
        id: { not: cmd.bookingId },
        status: { in: ['PENDING', 'CONFIRMED'] },
        scheduledAt: { lt: newEndsAt },
        endsAt: { gt: newScheduledAt },
      },
    });
    if (conflict) throw new ConflictException('Employee already has a booking in the new time slot');

    const [updated] = await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id: cmd.bookingId },
        data: { scheduledAt: newScheduledAt, endsAt: newEndsAt, durationMins },
      }),
      this.prisma.bookingStatusLog.create({
        data: {
          tenantId: cmd.tenantId,
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: booking.status,
          changedBy: cmd.changedBy,
          reason: 'rescheduled',
        },
      }),
    ]);

    return updated;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/backend && npx jest bookings.handler.spec.ts --no-coverage
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/bookings/reschedule-booking/ \
        apps/backend/src/modules/bookings/bookings.handler.spec.ts
git commit -m "feat(bookings): p12-t5d apply maxReschedulesPerBooking in RescheduleBookingHandler"
```

---

## Task 9: Apply settings in cron jobs (CronTasksService)

**Files:**
- Modify: `apps/backend/src/modules/ops/cron-tasks/cron-tasks.service.ts`
- Modify: `apps/backend/src/modules/ops/ops.module.ts`

The cron jobs currently use hardcoded thresholds. They need to read `autoCompleteAfterHours` and `autoNoShowAfterMinutes` from `BookingSettings` per tenant. Since cron jobs run globally (not per-request), they query all tenants and apply each tenant's settings independently.

- [ ] **Step 1: Read ops.module.ts**

```bash
cat apps/backend/src/modules/ops/ops.module.ts
```

Note existing imports to avoid duplicating them.

- [ ] **Step 2: Update CronTasksService**

The cron service processes all tenants. Replace `runBookingAutocomplete` and `runBookingNoShow` with per-tenant logic that reads settings. Replace full content of `apps/backend/src/modules/ops/cron-tasks/cron-tasks.service.ts`:

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BookingStatus, WaitlistStatus } from '@prisma/client';
import { BullMqService } from '../../../infrastructure/queue/bull-mq.service';
import { PrismaService } from '../../../infrastructure/database';
import { GetBookingSettingsHandler } from '../../bookings/get-booking-settings/get-booking-settings.handler';

const QUEUE_NAME = 'ops-cron';

/** Cron job names — used as BullMQ job types and repeat keys. */
export const CRON_JOBS = {
  BOOKING_AUTOCOMPLETE: 'booking-autocomplete',
  BOOKING_EXPIRY: 'booking-expiry',
  BOOKING_NOSHOW: 'booking-noshow',
  APPOINTMENT_REMINDERS: 'appointment-reminders',
  GROUP_SESSION_AUTOMATION: 'group-session-automation',
  REFRESH_TOKEN_CLEANUP: 'refresh-token-cleanup',
} as const;

@Injectable()
export class CronTasksService implements OnModuleInit {
  private readonly logger = new Logger(CronTasksService.name);

  constructor(
    private readonly bullMq: BullMqService,
    private readonly prisma: PrismaService,
    private readonly settingsHandler: GetBookingSettingsHandler,
  ) {}

  onModuleInit(): void {
    this.registerRepeatingJobs();
    this.registerWorker();
  }

  // ── Schedule repeating jobs ────────────────────────────────────────────────

  private registerRepeatingJobs(): void {
    const queue = this.bullMq.getQueue(QUEUE_NAME);

    const jobs: Array<{ name: string; cron: string }> = [
      { name: CRON_JOBS.BOOKING_AUTOCOMPLETE, cron: '*/15 * * * *' },
      { name: CRON_JOBS.BOOKING_EXPIRY, cron: '*/10 * * * *' },
      { name: CRON_JOBS.BOOKING_NOSHOW, cron: '*/5 * * * *' },
      { name: CRON_JOBS.APPOINTMENT_REMINDERS, cron: '0 * * * *' },
      { name: CRON_JOBS.GROUP_SESSION_AUTOMATION, cron: '*/30 * * * *' },
      { name: CRON_JOBS.REFRESH_TOKEN_CLEANUP, cron: '0 3 * * *' },
    ];

    for (const { name, cron } of jobs) {
      queue
        .add(name, {}, { repeat: { pattern: cron }, jobId: `repeat:${name}` })
        .catch((err: unknown) =>
          this.logger.error(`Failed to schedule ${name}`, err),
        );
    }

    this.logger.log(`Scheduled ${jobs.length} cron jobs on queue "${QUEUE_NAME}"`);
  }

  // ── Worker processor ───────────────────────────────────────────────────────

  private registerWorker(): void {
    this.bullMq.createWorker<object>(QUEUE_NAME, async (job) => {
      switch (job.name) {
        case CRON_JOBS.BOOKING_AUTOCOMPLETE:
          await this.runBookingAutocomplete();
          break;
        case CRON_JOBS.BOOKING_EXPIRY:
          await this.runBookingExpiry();
          break;
        case CRON_JOBS.BOOKING_NOSHOW:
          await this.runBookingNoShow();
          break;
        case CRON_JOBS.APPOINTMENT_REMINDERS:
          await this.runAppointmentReminders();
          break;
        case CRON_JOBS.GROUP_SESSION_AUTOMATION:
          await this.runGroupSessionAutomation();
          break;
        case CRON_JOBS.REFRESH_TOKEN_CLEANUP:
          await this.runRefreshTokenCleanup();
          break;
        default:
          this.logger.warn(`Unknown cron job: ${job.name}`);
      }
    });
  }

  // ── Job implementations ────────────────────────────────────────────────────

  /**
   * Auto-complete bookings per tenant using each tenant's autoCompleteAfterHours setting.
   * Groups bookings by tenantId and applies per-tenant cutoff.
   */
  private async runBookingAutocomplete(): Promise<void> {
    const tenantIds = await this.prisma.booking
      .findMany({
        where: { status: BookingStatus.CONFIRMED },
        select: { tenantId: true },
        distinct: ['tenantId'],
      })
      .then((rows) => rows.map((r) => r.tenantId));

    let totalCompleted = 0;

    for (const tenantId of tenantIds) {
      const settings = await this.settingsHandler.execute({ tenantId, branchId: null });
      const cutoff = new Date(Date.now() - settings.autoCompleteAfterHours * 3_600_000);

      const result = await this.prisma.booking.updateMany({
        where: {
          tenantId,
          status: BookingStatus.CONFIRMED,
          endsAt: { lte: cutoff },
        },
        data: {
          status: BookingStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
      totalCompleted += result.count;
    }

    if (totalCompleted > 0) {
      this.logger.log(`[booking-autocomplete] completed ${totalCompleted} bookings`);
    }
  }

  /** Expire PENDING bookings that passed their expiresAt. */
  private async runBookingExpiry(): Promise<void> {
    const now = new Date();
    const result = await this.prisma.booking.updateMany({
      where: {
        status: BookingStatus.PENDING,
        expiresAt: { lte: now },
      },
      data: {
        status: BookingStatus.EXPIRED,
      },
    });
    if (result.count > 0) {
      this.logger.log(`[booking-expiry] expired ${result.count} bookings`);
    }
  }

  /**
   * Mark CONFIRMED bookings as NO_SHOW per tenant using each tenant's autoNoShowAfterMinutes setting.
   */
  private async runBookingNoShow(): Promise<void> {
    const tenantIds = await this.prisma.booking
      .findMany({
        where: { status: BookingStatus.CONFIRMED },
        select: { tenantId: true },
        distinct: ['tenantId'],
      })
      .then((rows) => rows.map((r) => r.tenantId));

    let totalNoShow = 0;

    for (const tenantId of tenantIds) {
      const settings = await this.settingsHandler.execute({ tenantId, branchId: null });
      const cutoff = new Date(Date.now() - settings.autoNoShowAfterMinutes * 60_000);

      const result = await this.prisma.booking.updateMany({
        where: {
          tenantId,
          status: BookingStatus.CONFIRMED,
          scheduledAt: { lte: cutoff },
          checkedInAt: null,
        },
        data: {
          status: BookingStatus.NO_SHOW,
          noShowAt: new Date(),
        },
      });
      totalNoShow += result.count;
    }

    if (totalNoShow > 0) {
      this.logger.log(`[booking-noshow] marked ${totalNoShow} as NO_SHOW`);
    }
  }

  /** Promote the oldest WAITING waitlist entry when a slot opens. */
  private async runAppointmentReminders(): Promise<void> {
    const waiting = await this.prisma.waitlistEntry.findMany({
      where: { status: WaitlistStatus.WAITING },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    if (waiting.length > 0) {
      this.logger.log(`[appointment-reminders] ${waiting.length} waitlist entries checked`);
    }
  }

  /** Close past group sessions that are still OPEN. */
  private async runGroupSessionAutomation(): Promise<void> {
    const now = new Date();
    const result = await this.prisma.groupSession.updateMany({
      where: {
        status: 'OPEN',
        scheduledAt: { lte: now },
      },
      data: { status: 'COMPLETED' },
    });
    if (result.count > 0) {
      this.logger.log(`[group-session-automation] closed ${result.count} group sessions`);
    }
  }

  /**
   * Delete expired/revoked refresh tokens older than 30 days.
   * Critical for performance — prevents O(n) bcrypt compare degradation.
   */
  private async runRefreshTokenCleanup(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60_000);
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lte: cutoff } },
          { revokedAt: { not: null, lte: cutoff } },
        ],
      },
    });
    this.logger.log(`[refresh-token-cleanup] deleted ${result.count} stale tokens`);
  }
}
```

- [ ] **Step 3: Read ops.module.ts and add imports**

```bash
cat apps/backend/src/modules/ops/ops.module.ts
```

Then update it to import `BookingsModule` and add `GetBookingSettingsHandler` to `CronTasksService`'s providers. The exact edit depends on the current content, but the pattern is:

- Add `BookingsModule` to `imports` array (so `GetBookingSettingsHandler` is available)
- No need to add `GetBookingSettingsHandler` to providers separately if it's exported from `BookingsModule`

- [ ] **Step 4: Run full backend test suite**

```bash
cd apps/backend && npx jest --no-coverage
```

Expected: all tests pass. Fix any constructor injection errors that surface.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/ops/cron-tasks/ \
        apps/backend/src/modules/ops/ops.module.ts
git commit -m "feat(bookings): p12-t5e apply autoComplete/autoNoShow settings in CronTasksService"
```

---

## Final verification

- [ ] **Run full test suite**

```bash
cd apps/backend && npx jest --no-coverage
```

Expected: all tests green.

- [ ] **Type-check**

```bash
cd apps/backend && npx tsc --noEmit
```

Expected: 0 errors.
