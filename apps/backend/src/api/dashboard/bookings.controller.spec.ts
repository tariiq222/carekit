import { DashboardBookingsController } from './bookings.controller';
import { CancellationReason } from '@prisma/client';

const TENANT = 'tenant-1';
const USER = 'user-1';
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const create = fn({ id: 'book-1' });
  const createRecurring = fn({ ids: ['book-1'] });
  const list = fn({ data: [], meta: {} });
  const get = fn({ id: 'book-1' });
  const cancel = fn({ id: 'book-1' });
  const reschedule = fn({ id: 'book-1' });
  const confirm = fn({ id: 'book-1' });
  const checkIn = fn({ id: 'book-1' });
  const complete = fn({ id: 'book-1' });
  const noShow = fn({ id: 'book-1' });
  const waitlist = fn({ id: 'wl-1' });
  const availability = fn({ available: true });
  const controller = new DashboardBookingsController(
    create as never, createRecurring as never, list as never, get as never,
    cancel as never, reschedule as never, confirm as never, checkIn as never,
    complete as never, noShow as never, waitlist as never, availability as never,
  );
  return { controller, create, createRecurring, list, get, cancel, reschedule, confirm, checkIn, complete, noShow, waitlist, availability };
}

describe('DashboardBookingsController', () => {
  it('createBooking — passes tenantId and converts date strings to Date', async () => {
    const { controller, create } = buildController();
    await controller.createBooking(TENANT, {
      scheduledAt: '2026-06-01T10:00:00Z',
      clientId: 'c-1', employeeId: 'e-1', serviceId: 's-1',
      branchId: 'b-1', durationMins: 60, bookingType: 'INDIVIDUAL',
    } as never);
    expect(create.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, scheduledAt: expect.any(Date) }),
    );
  });

  it('listBookings — passes tenantId and default pagination', async () => {
    const { controller, list } = buildController();
    await controller.listBookings(TENANT, {} as never);
    expect(list.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, page: 1 }),
    );
  });

  it('getBooking — passes tenantId and bookingId', async () => {
    const { controller, get } = buildController();
    await controller.getBooking(TENANT, 'book-1');
    expect(get.execute).toHaveBeenCalledWith({ tenantId: TENANT, bookingId: 'book-1' });
  });

  it('cancelBooking — passes tenantId, bookingId, and changedBy', async () => {
    const { controller, cancel } = buildController();
    await controller.cancelBooking(TENANT, USER, 'book-1', { reason: CancellationReason.CLIENT_REQUESTED } as never);
    expect(cancel.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, bookingId: 'book-1', changedBy: USER }),
    );
  });

  it('confirmBooking — passes tenantId and bookingId', async () => {
    const { controller, confirm } = buildController();
    await controller.confirmBooking(TENANT, USER, 'book-1');
    expect(confirm.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, bookingId: 'book-1' }),
    );
  });

  it('checkInBooking — passes tenantId and bookingId', async () => {
    const { controller, checkIn } = buildController();
    await controller.checkInBooking(TENANT, USER, 'book-1');
    expect(checkIn.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, bookingId: 'book-1' }),
    );
  });

  it('completeBooking — passes tenantId and bookingId', async () => {
    const { controller, complete } = buildController();
    await controller.completeBooking(TENANT, USER, 'book-1', {} as never);
    expect(complete.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, bookingId: 'book-1' }),
    );
  });

  it('noShowBooking — passes tenantId and bookingId', async () => {
    const { controller, noShow } = buildController();
    await controller.noShowBooking(TENANT, USER, 'book-1');
    expect(noShow.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, bookingId: 'book-1' }),
    );
  });

  it('addToWaitlist — passes tenantId', async () => {
    const { controller, waitlist } = buildController();
    await controller.addToWaitlist(TENANT, { serviceId: 's-1' } as never);
    expect(waitlist.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('checkAvailability — passes tenantId', async () => {
    const { controller, availability } = buildController();
    await controller.checkAvailability(TENANT, {} as never);
    expect(availability.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('rescheduleBooking — converts new date string to Date', async () => {
    const { controller, reschedule } = buildController();
    await controller.rescheduleBooking(TENANT, USER, 'book-1', { newScheduledAt: '2026-07-01T09:00:00Z' } as never);
    expect(reschedule.execute).toHaveBeenCalledWith(
      expect.objectContaining({ newScheduledAt: expect.any(Date) }),
    );
  });

  it('createRecurringBooking — handles all optional date fields', async () => {
    const { controller, createRecurring } = buildController();
    await controller.createRecurringBooking(TENANT, {
      scheduledAt: '2026-06-01T10:00:00Z',
      expiresAt: '2026-12-31T23:59:59Z',
      until: '2026-12-31T23:59:59Z',
      customDates: ['2026-06-15T10:00:00Z', '2026-06-22T10:00:00Z'],
      clientId: 'c-1', employeeId: 'e-1', serviceId: 's-1',
      branchId: 'b-1', durationMins: 60, bookingType: 'INDIVIDUAL',
    } as never);
    expect(createRecurring.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT,
        scheduledAt: expect.any(Date),
        expiresAt: expect.any(Date),
        until: expect.any(Date),
        customDates: expect.arrayContaining([expect.any(Date)]),
      }),
    );
  });

  it('createRecurringBooking — handles missing optional dates', async () => {
    const { controller, createRecurring } = buildController();
    await controller.createRecurringBooking(TENANT, {
      scheduledAt: '2026-06-01T10:00:00Z',
      clientId: 'c-1', employeeId: 'e-1', serviceId: 's-1',
      branchId: 'b-1', durationMins: 60, bookingType: 'INDIVIDUAL',
    } as never);
    expect(createRecurring.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT,
        scheduledAt: expect.any(Date),
        expiresAt: undefined,
        until: undefined,
        customDates: undefined,
      }),
    );
  });
});