import { CancellationReason } from '@prisma/client';
import { MobileClientBookingsController, MobileCreateBookingDto, MobileCancelBookingDto, MobileListBookingsDto } from './bookings.controller';

const TENANT = 'tenant-1';
const USER = { sub: 'client-1', email: 'client@test.com', role: 'client' as const };

const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const list = fn({ data: [], meta: {} });
  const get = fn({ id: 'booking-1' });
  const create = fn({ id: 'booking-1' });
  const cancel = fn({ id: 'booking-1', status: 'cancelled' });
  const reschedule = fn({ id: 'booking-1', scheduledAt: new Date() });
  const controller = new MobileClientBookingsController(
    list as never, get as never, create as never, cancel as never, reschedule as never,
  );
  return { controller, list, get, create, cancel, reschedule };
}

describe('MobileClientBookingsController', () => {
  describe('createBooking', () => {
    it('passes tenantId, clientId, and booking fields to handler', async () => {
      const { controller, create } = buildController();
      const body: MobileCreateBookingDto = {
        branchId: 'branch-1',
        employeeId: 'emp-1',
        serviceId: 'svc-1',
        scheduledAt: '2026-07-01T10:00:00Z',
      };
      await controller.createBooking(TENANT, USER, body);
      expect(create.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT,
          clientId: USER.sub,
          branchId: body.branchId,
          employeeId: body.employeeId,
          serviceId: body.serviceId,
          scheduledAt: expect.any(Date),
        }),
      );
    });

    it('converts scheduledAt to Date', async () => {
      const { controller, create } = buildController();
      await controller.createBooking(TENANT, USER, {
        branchId: 'branch-1', employeeId: 'emp-1', serviceId: 'svc-1', scheduledAt: '2026-07-01T10:00:00Z',
      });
      expect(create.execute).toHaveBeenCalledWith(
        expect.objectContaining({ scheduledAt: expect.any(Date) }),
      );
    });

    it('passes optional durationOptionId and notes', async () => {
      const { controller, create } = buildController();
      await controller.createBooking(TENANT, USER, {
        branchId: 'branch-1', employeeId: 'emp-1', serviceId: 'svc-1', scheduledAt: '2026-07-01T10:00:00Z',
        durationOptionId: 'dur-1', notes: 'please be gentle',
      });
      expect(create.execute).toHaveBeenCalledWith(
        expect.objectContaining({ durationOptionId: 'dur-1', notes: 'please be gentle' }),
      );
    });
  });

  describe('listMyBookings', () => {
    it('passes tenantId, clientId, and pagination defaults', async () => {
      const { controller, list } = buildController();
      await controller.listMyBookings(TENANT, USER, {});
      expect(list.execute).toHaveBeenCalledWith({
        tenantId: TENANT, clientId: USER.sub, page: 1, limit: 20, status: undefined,
      });
    });

    it('uses query params for page, limit, and status', async () => {
      const { controller, list } = buildController();
      const q: MobileListBookingsDto = { page: 3, limit: 50, status: 'CONFIRMED' };
      await controller.listMyBookings(TENANT, USER, q);
      expect(list.execute).toHaveBeenCalledWith({
        tenantId: TENANT, clientId: USER.sub, page: 3, limit: 50, status: 'CONFIRMED',
      });
    });
  });

  describe('getBooking', () => {
    it('passes tenantId and bookingId to handler', async () => {
      const { controller, get } = buildController();
      await controller.getBooking(TENANT, 'booking-123');
      expect(get.execute).toHaveBeenCalledWith({ tenantId: TENANT, bookingId: 'booking-123' });
    });
  });

  describe('cancelBooking', () => {
    it('passes tenantId, bookingId, reason, cancelNotes, changedBy, and source', async () => {
      const { controller, cancel } = buildController();
      const body: MobileCancelBookingDto = { reason: CancellationReason.CLIENT_REQUEST, cancelNotes: 'changed mind' };
      await controller.cancelBooking(TENANT, USER, 'booking-1', body);
      expect(cancel.execute).toHaveBeenCalledWith({
        tenantId: TENANT,
        bookingId: 'booking-1',
        reason: CancellationReason.CLIENT_REQUEST,
        cancelNotes: 'changed mind',
        changedBy: USER.sub,
        source: 'client',
      });
    });

    it('works without cancelNotes', async () => {
      const { controller, cancel } = buildController();
      await controller.cancelBooking(TENANT, USER, 'booking-1', { reason: CancellationReason.OTHER });
      expect(cancel.execute).toHaveBeenCalledWith(
        expect.objectContaining({ cancelNotes: undefined, source: 'client' }),
      );
    });
  });

  describe('rescheduleBooking', () => {
    it('passes tenantId, bookingId, newScheduledAt, newDurationMins, and changedBy', async () => {
      const { controller, reschedule } = buildController();
      const body = { newScheduledAt: '2026-07-15T14:00:00Z', newDurationMins: 60 };
      await controller.rescheduleBooking(TENANT, USER, 'booking-1', body as never);
      expect(reschedule.execute).toHaveBeenCalledWith({
        tenantId: TENANT,
        bookingId: 'booking-1',
        newScheduledAt: expect.any(Date),
        newDurationMins: 60,
        changedBy: USER.sub,
      });
    });

    it('converts newScheduledAt to Date', async () => {
      const { controller, reschedule } = buildController();
      await controller.rescheduleBooking(TENANT, USER, 'booking-1', { newScheduledAt: '2026-07-15T14:00:00Z' } as never);
      expect(reschedule.execute).toHaveBeenCalledWith(
        expect.objectContaining({ newScheduledAt: expect.any(Date) }),
      );
    });
  });
});
