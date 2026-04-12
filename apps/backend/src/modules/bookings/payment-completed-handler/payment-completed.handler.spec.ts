import { PaymentCompletedEventHandler } from './payment-completed.handler';
import { buildPrisma, buildEventBus, mockBooking } from '../testing/booking-test-helpers';
import { BookingStatus } from '@prisma/client';

function buildHandler() {
  const prisma = buildPrisma();
  const eb = {
    subscribe: jest.fn(),
    publish: jest.fn().mockResolvedValue(undefined),
  };
  let subscriber: ((envelope: { payload: { bookingId: string; tenantId: string; paymentId: string; invoiceId: string } }) => Promise<void>) | null = null;
  eb.subscribe = jest.fn((_, cb) => { subscriber = cb as typeof subscriber; });
  const handler = new PaymentCompletedEventHandler(prisma as never, eb as never);
  handler.register();
  return { prisma, eb, handler, getSubscriber: () => subscriber! };
}

const makeEnvelope = (overrides: Partial<{ bookingId: string; tenantId: string; paymentId: string; invoiceId: string }> = {}) => ({
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
