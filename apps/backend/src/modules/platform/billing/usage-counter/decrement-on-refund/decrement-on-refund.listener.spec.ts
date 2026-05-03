import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { DecrementOnRefundListener } from './decrement-on-refund.listener';
import { startOfMonthUTC } from '../period.util';

const ORG_ID = 'org-decrement-1';
const REFUND_ID = 'rr-decrement-1';
const BOOKING_ID = 'book-decrement-1';

function buildCls(): ClsService {
  // Minimal CLS shim — runs the callback synchronously and ignores the keys.
  // The listener only uses `cls.run(fn)` + `cls.set(...)`; we don't need to
  // surface the values back because the unit test mocks the prisma layer
  // directly (it doesn't go through the tenant-scoping extension).
  const store = new Map<string, unknown>();
  return {
    run: async (fn: () => Promise<unknown>) => fn(),
    set: (key: string, value: unknown) => store.set(key, value),
    get: (key: string) => store.get(key),
  } as unknown as ClsService;
}

function buildPayload(scheduledAt: Date) {
  return {
    refundRequestId: REFUND_ID,
    organizationId: ORG_ID,
    invoiceId: 'inv-1',
    paymentId: 'pay-1',
    bookingId: BOOKING_ID,
    amount: 200,
    currency: 'SAR',
    scheduledAt,
  };
}

function buildListener(opts: {
  bookingScheduledAt: Date | null;
  duplicateLog?: boolean;
}) {
  const counters = {
    increment: jest.fn().mockResolvedValue(undefined),
  };

  const refundUsageRevertLog = {
    create: jest.fn().mockImplementation(async () => {
      if (opts.duplicateLog) {
        const err = new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed',
          { code: 'P2002', clientVersion: 'test' },
        );
        throw err;
      }
      return { id: 'log-1' };
    }),
  };

  const prisma = {
    booking: {
      findFirst: jest.fn().mockResolvedValue(
        opts.bookingScheduledAt
          ? { id: BOOKING_ID, scheduledAt: opts.bookingScheduledAt, organizationId: ORG_ID }
          : null,
      ),
    },
    refundUsageRevertLog,
  } as const;

  const eventBus = { subscribe: jest.fn(), publish: jest.fn() };

  const listener = new DecrementOnRefundListener(
    counters as never,
    eventBus as never,
    prisma as never,
    buildCls(),
  );

  return { listener, counters, prisma, eventBus };
}

describe('DecrementOnRefundListener', () => {
  it('decrements MONTHLY_BOOKINGS by 1 when refund booking is in current period', async () => {
    const { listener, counters, prisma } = buildListener({
      bookingScheduledAt: new Date(),
    });

    await listener.handle(buildPayload(new Date()));

    expect(prisma.refundUsageRevertLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: ORG_ID,
        refundRequestId: REFUND_ID,
        metric: FeatureKey.MONTHLY_BOOKINGS,
        amount: -1,
      }),
    });
    expect(counters.increment).toHaveBeenCalledWith(
      ORG_ID,
      FeatureKey.MONTHLY_BOOKINGS,
      startOfMonthUTC(),
      -1,
    );
  });

  it('is idempotent — duplicate event does NOT decrement counter again', async () => {
    const { listener, counters } = buildListener({
      bookingScheduledAt: new Date(),
      duplicateLog: true,
    });

    await listener.handle(buildPayload(new Date()));

    expect(counters.increment).not.toHaveBeenCalled();
  });

  it('skips bookings outside the current period (period rollover edge case)', async () => {
    // Schedule the booking 2 months in the past — outside current monthly period.
    const past = new Date();
    past.setUTCMonth(past.getUTCMonth() - 2);
    const { listener, counters, prisma } = buildListener({
      bookingScheduledAt: past,
    });

    await listener.handle(buildPayload(past));

    expect(prisma.refundUsageRevertLog.create).not.toHaveBeenCalled();
    expect(counters.increment).not.toHaveBeenCalled();
  });

  it('skips when booking record is missing (defensive)', async () => {
    const { listener, counters, prisma } = buildListener({
      bookingScheduledAt: null,
    });

    await listener.handle(buildPayload(new Date()));

    expect(prisma.refundUsageRevertLog.create).not.toHaveBeenCalled();
    expect(counters.increment).not.toHaveBeenCalled();
  });
});
