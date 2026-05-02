import { DashboardBookingsController } from './bookings.controller';
import { CancellationReason } from '@prisma/client';
import { REQUIRE_FEATURE_KEY } from '../../modules/platform/billing/feature.decorator';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';

const USER = 'user-1';
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const create = fn({ id: 'book-1' });
  const createRecurring = fn({ ids: ['book-1'] });
  const list = fn({ data: [], meta: {} });
  const stats = fn({ todayCount: 0, pendingCount: 0, completedToday: 0, revenueToday: 0 });
  const get = fn({ id: 'book-1' });
  const cancel = fn({ id: 'book-1' });
  const reschedule = fn({ id: 'book-1' });
  const confirm = fn({ id: 'book-1' });
  const retryZoom = fn({ id: 'book-1' });
  const checkIn = fn({ id: 'book-1' });
  const complete = fn({ id: 'book-1' });
  const noShow = fn({ id: 'book-1' });
  const waitlist = fn({ id: 'wl-1' });
  const listWaitlist = fn([] as unknown);
  const removeWaitlist = fn(undefined);
  const availability = fn({ available: true });
  const statusLog = fn([]);
  const controller = new DashboardBookingsController(
    create as never, createRecurring as never, list as never, stats as never,
    get as never, cancel as never, reschedule as never, confirm as never,
    retryZoom as never,
    checkIn as never, complete as never, noShow as never, waitlist as never,
    listWaitlist as never, removeWaitlist as never, availability as never,
    statusLog as never,
  );
  return { controller, create, createRecurring, list, stats, get, cancel, reschedule, confirm, checkIn, complete, noShow, waitlist, listWaitlist, removeWaitlist, availability, statusLog };
}

describe('DashboardBookingsController', () => {
  it('createBooking — converts date strings to Date', async () => {
    const { controller, create } = buildController();
    await controller.createBooking(USER, {
      scheduledAt: '2026-06-01T10:00:00Z',
      clientId: 'c-1', employeeId: 'e-1', serviceId: 's-1',
      branchId: 'b-1', durationMins: 60, bookingType: 'INDIVIDUAL',
    } as never);
    expect(create.execute).toHaveBeenCalledWith(
      expect.objectContaining({ scheduledAt: expect.any(Date) }),
    );
  });

  it('listBookings — passes default pagination', async () => {
    const { controller, list } = buildController();
    await controller.listBookings({} as never);
    expect(list.execute).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 }),
    );
  });

  it('getBooking — passes bookingId', async () => {
    const { controller, get } = buildController();
    await controller.getBooking('book-1');
    expect(get.execute).toHaveBeenCalledWith({ bookingId: 'book-1' });
  });

  it('cancelBooking — passes bookingId and changedBy', async () => {
    const { controller, cancel } = buildController();
    await controller.cancelBooking(USER, 'book-1', { reason: CancellationReason.CLIENT_REQUESTED } as never);
    expect(cancel.execute).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'book-1', changedBy: USER }),
    );
  });

  it('confirmBooking — passes bookingId', async () => {
    const { controller, confirm } = buildController();
    await controller.confirmBooking(USER, 'book-1');
    expect(confirm.execute).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'book-1' }),
    );
  });

  it('checkInBooking — passes bookingId', async () => {
    const { controller, checkIn } = buildController();
    await controller.checkInBooking(USER, 'book-1');
    expect(checkIn.execute).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'book-1' }),
    );
  });

  it('completeBooking — passes bookingId', async () => {
    const { controller, complete } = buildController();
    await controller.completeBooking(USER, 'book-1', {} as never);
    expect(complete.execute).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'book-1' }),
    );
  });

  it('noShowBooking — passes bookingId', async () => {
    const { controller, noShow } = buildController();
    await controller.noShowBooking(USER, 'book-1');
    expect(noShow.execute).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'book-1' }),
    );
  });

  it('addToWaitlist — passes serviceId', async () => {
    const { controller, waitlist } = buildController();
    await controller.addToWaitlist({ serviceId: 's-1' } as never);
    expect(waitlist.execute).toHaveBeenCalledWith(expect.objectContaining({ serviceId: 's-1' }));
  });

  it('checkAvailability — passes date as Date', async () => {
    const { controller, availability } = buildController();
    await controller.checkAvailability({ date: '2026-06-01T00:00:00Z' } as never);
    expect(availability.execute).toHaveBeenCalledWith(expect.objectContaining({ date: expect.any(Date) }));
  });

  it('rescheduleBooking — converts new date string to Date', async () => {
    const { controller, reschedule } = buildController();
    await controller.rescheduleBooking(USER, 'book-1', { newScheduledAt: '2026-07-01T09:00:00Z' } as never);
    expect(reschedule.execute).toHaveBeenCalledWith(
      expect.objectContaining({ newScheduledAt: expect.any(Date) }),
    );
  });

  it('createRecurringBooking — handles all optional date fields', async () => {
    const { controller, createRecurring } = buildController();
    await controller.createRecurringBooking({
      scheduledAt: '2026-06-01T10:00:00Z',
      expiresAt: '2026-12-31T23:59:59Z',
      until: '2026-12-31T23:59:59Z',
      customDates: ['2026-06-15T10:00:00Z', '2026-06-22T10:00:00Z'],
      clientId: 'c-1', employeeId: 'e-1', serviceId: 's-1',
      branchId: 'b-1', durationMins: 60, bookingType: 'INDIVIDUAL',
    } as never);
    expect(createRecurring.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduledAt: expect.any(Date),
        expiresAt: expect.any(Date),
        until: expect.any(Date),
        customDates: expect.arrayContaining([expect.any(Date)]),
      }),
    );
  });

  it('createRecurringBooking — handles missing optional dates', async () => {
    const { controller, createRecurring } = buildController();
    await controller.createRecurringBooking({
      scheduledAt: '2026-06-01T10:00:00Z',
      clientId: 'c-1', employeeId: 'e-1', serviceId: 's-1',
      branchId: 'b-1', durationMins: 60, bookingType: 'INDIVIDUAL',
    } as never);
    expect(createRecurring.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduledAt: expect.any(Date),
        expiresAt: undefined,
        until: undefined,
        customDates: undefined,
      }),
    );
  });
});

describe('@RequireFeature metadata — RECURRING_BOOKINGS', () => {
  it.each([
    'createRecurringBooking',
  ])('annotates %s with FeatureKey.RECURRING_BOOKINGS', (method) => {
    const meta = Reflect.getMetadata(
      REQUIRE_FEATURE_KEY,
      (DashboardBookingsController.prototype as Record<string, unknown>)[method] as object,
    );
    expect(meta).toBe(FeatureKey.RECURRING_BOOKINGS);
  });
});

describe('@RequireFeature metadata — WAITLIST', () => {
  it.each([
    'addToWaitlist',
    'listWaitlist',
    'removeWaitlistEntry',
  ])('annotates %s with FeatureKey.WAITLIST', (method) => {
    const meta = Reflect.getMetadata(
      REQUIRE_FEATURE_KEY,
      (DashboardBookingsController.prototype as Record<string, unknown>)[method] as object,
    );
    expect(meta).toBe(FeatureKey.WAITLIST);
  });
});
