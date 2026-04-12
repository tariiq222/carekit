import { MobileEmployeeScheduleController } from './schedule.controller';

const TENANT = 'tenant-1';
const USER = { sub: 'user-1' };
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const listBookings = fn({ data: [], meta: {} });
  const updateAvailability = fn({ windows: [], exceptions: [] });
  const controller = new MobileEmployeeScheduleController(listBookings as never, updateAvailability as never);
  return { controller, listBookings, updateAvailability };
}

describe('MobileEmployeeScheduleController', () => {
  describe('today', () => {
    it('passes tenantId and user.sub as employeeId', async () => {
      const { controller, listBookings } = buildController();
      await controller.today(TENANT, USER);
      expect(listBookings.execute).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT, employeeId: USER.sub }),
      );
    });

    it('sets fromDate and toDate to today boundaries', async () => {
      const { controller, listBookings } = buildController();
      await controller.today(TENANT, USER);
      const call = listBookings.execute.mock.calls[0][0] as { fromDate: Date; toDate: Date };
      expect(call.fromDate).toBeInstanceOf(Date);
      expect(call.toDate).toBeInstanceOf(Date);
      // toDate should be tomorrow (one day after fromDate)
      expect(call.toDate.getTime() - call.fromDate.getTime()).toBe(86_400_000);
    });

    it('defaults page to 1 and limit to 50', async () => {
      const { controller, listBookings } = buildController();
      await controller.today(TENANT, USER);
      expect(listBookings.execute).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 50 }),
      );
    });
  });

  describe('weekly', () => {
    it('passes tenantId and user.sub as employeeId', async () => {
      const { controller, listBookings } = buildController();
      await controller.weekly(TENANT, USER, {} as never);
      expect(listBookings.execute).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT, employeeId: USER.sub }),
      );
    });

    it('converts fromDate and toDate query params to Date objects', async () => {
      const { controller, listBookings } = buildController();
      await controller.weekly(TENANT, USER, { fromDate: '2026-06-01T00:00:00Z', toDate: '2026-06-07T23:59:59Z' } as never);
      const call = listBookings.execute.mock.calls[0][0] as { fromDate: Date; toDate: Date };
      expect(call.fromDate).toBeInstanceOf(Date);
      expect(call.toDate).toBeInstanceOf(Date);
    });

    it('defaults page to 1 when not provided', async () => {
      const { controller, listBookings } = buildController();
      await controller.weekly(TENANT, USER, {} as never);
      expect(listBookings.execute).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 }),
      );
    });

    it('defaults limit to 100 when not provided', async () => {
      const { controller, listBookings } = buildController();
      await controller.weekly(TENANT, USER, {} as never);
      expect(listBookings.execute).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 }),
      );
    });

    it('uses provided page and limit', async () => {
      const { controller, listBookings } = buildController();
      await controller.weekly(TENANT, USER, { page: 2, limit: 50 } as never);
      expect(listBookings.execute).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, limit: 50 }),
      );
    });
  });

  describe('updateAvailabilityEndpoint', () => {
    it('passes tenantId and user.sub as employeeId', async () => {
      const { controller, updateAvailability } = buildController();
      await controller.updateAvailabilityEndpoint(TENANT, USER, { windows: [] } as never);
      expect(updateAvailability.execute).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT, employeeId: USER.sub }),
      );
    });

    it('passes windows array from body', async () => {
      const { controller, updateAvailability } = buildController();
      const windows = [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }];
      await controller.updateAvailabilityEndpoint(TENANT, USER, { windows } as never);
      expect(updateAvailability.execute).toHaveBeenCalledWith(
        expect.objectContaining({ windows }),
      );
    });

    it('passes exceptions array when provided', async () => {
      const { controller, updateAvailability } = buildController();
      const exceptions = [{ date: '2026-06-15', type: 'HOLIDAY' as const }];
      await controller.updateAvailabilityEndpoint(TENANT, USER, { windows: [], exceptions } as never);
      expect(updateAvailability.execute).toHaveBeenCalledWith(
        expect.objectContaining({ exceptions }),
      );
    });
  });
});
