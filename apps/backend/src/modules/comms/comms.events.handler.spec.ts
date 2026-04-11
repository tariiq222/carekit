import { OnBookingCancelledHandler } from './events/on-booking-cancelled.handler';
import { OnBookingReminderHandler } from './events/on-booking-reminder.handler';
import { OnPaymentFailedHandler } from './events/on-payment-failed.handler';
import { OnClientEnrolledHandler } from './events/on-client-enrolled.handler';
import type { SendNotificationHandler } from './send-notification/send-notification.handler';

const buildNotifyHandler = () => ({ execute: jest.fn().mockResolvedValue(undefined) });

describe('OnBookingCancelledHandler', () => {
  it('calls SendNotificationHandler with push + email + in-app channels', async () => {
    const notify = buildNotifyHandler();
    const handler = new OnBookingCancelledHandler(notify as unknown as SendNotificationHandler);
    await handler.handle({
      eventId: 'e-1', correlationId: 'c-1', source: 'bookings', version: 1,
      tenantId: 'tenant-1', occurredAt: new Date(),
      payload: {
        bookingId: 'book-1', tenantId: 'tenant-1', clientId: 'client-1',
        employeeId: 'emp-1', reason: 'CLIENT_REQUEST',
        clientEmail: 'client@example.com', clientName: 'أحمد', clientPhone: '+966500000000',
      },
    });
    expect(notify.execute).toHaveBeenCalledWith(
      expect.objectContaining({ channels: expect.arrayContaining(['push', 'email', 'in-app']) }),
    );
  });
});

describe('OnBookingReminderHandler', () => {
  it('calls SendNotificationHandler with push + sms + in-app channels', async () => {
    const notify = buildNotifyHandler();
    const handler = new OnBookingReminderHandler(notify as unknown as SendNotificationHandler);
    await handler.handle({
      eventId: 'e-2', correlationId: 'c-2', source: 'ops', version: 1,
      tenantId: 'tenant-1', occurredAt: new Date(),
      payload: {
        bookingId: 'book-1', tenantId: 'tenant-1', clientId: 'client-1',
        scheduledAt: new Date(), clientPhone: '+966500000000', fcmToken: 'tok-1',
      },
    });
    expect(notify.execute).toHaveBeenCalledWith(
      expect.objectContaining({ channels: expect.arrayContaining(['push', 'sms', 'in-app']) }),
    );
  });
});

describe('OnPaymentFailedHandler', () => {
  it('calls SendNotificationHandler with push + email + in-app channels', async () => {
    const notify = buildNotifyHandler();
    const handler = new OnPaymentFailedHandler(notify as unknown as SendNotificationHandler);
    await handler.handle({
      eventId: 'e-3', correlationId: 'c-3', source: 'finance', version: 1,
      tenantId: 'tenant-1', occurredAt: new Date(),
      payload: {
        paymentId: 'pay-1', tenantId: 'tenant-1', clientId: 'client-1',
        amount: 200, currency: 'SAR', clientEmail: 'client@example.com',
        clientName: 'أحمد', fcmToken: 'tok-1',
      },
    });
    expect(notify.execute).toHaveBeenCalledWith(
      expect.objectContaining({ channels: expect.arrayContaining(['push', 'email', 'in-app']) }),
    );
  });
});

describe('OnClientEnrolledHandler', () => {
  it('calls SendNotificationHandler with email + in-app channels', async () => {
    const notify = buildNotifyHandler();
    const handler = new OnClientEnrolledHandler(notify as unknown as SendNotificationHandler);
    await handler.handle({
      eventId: 'e-4', correlationId: 'c-4', source: 'people', version: 1,
      tenantId: 'tenant-1', occurredAt: new Date(),
      payload: {
        clientId: 'client-1', tenantId: 'tenant-1', name: 'أحمد',
        email: 'client@example.com', phone: '+966500000000',
      },
    });
    expect(notify.execute).toHaveBeenCalledWith(
      expect.objectContaining({ channels: expect.arrayContaining(['email', 'in-app']) }),
    );
  });
});
