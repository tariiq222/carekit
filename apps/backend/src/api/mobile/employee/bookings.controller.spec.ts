import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CancellationReason } from '@prisma/client';
import { MobileEmployeeBookingsController } from './bookings.controller';

const USER = { sub: 'employee-1' };

const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController(bookingRow: { id: string; employeeId: string } | null) {
  const prisma = {
    booking: {
      findFirst: jest.fn().mockResolvedValue(bookingRow),
    },
  };
  const listHandler = fn({ data: [], meta: {} });
  const getHandler = fn({ id: 'b1' });
  const checkInHandler = fn({ id: 'b1' });
  const completeHandler = fn({ id: 'b1' });
  const cancelHandler = fn({ id: 'b1' });
  const requestCancelHandler = fn({ id: 'b1' });
  const createEmployeeHandler = fn({ id: 'b1' });

  const controller = new MobileEmployeeBookingsController(
    prisma as never,
    listHandler as never,
    getHandler as never,
    checkInHandler as never,
    completeHandler as never,
    cancelHandler as never,
    requestCancelHandler as never,
    createEmployeeHandler as never,
  );

  return {
    controller,
    prisma,
    listHandler,
    getHandler,
    createEmployeeHandler,
    checkInHandler,
    completeHandler,
    cancelHandler,
    requestCancelHandler,
  };
}

describe('MobileEmployeeBookingsController', () => {
  describe('createMyBooking', () => {
    it('delegates to createEmployeeHandler with employeeId derived from JWT', async () => {
      const { controller, createEmployeeHandler } = buildController(null);
      const dto = { branchId: 'b-1', clientId: 'c-1', serviceId: 's-1', scheduledAt: '2026-05-01T10:00:00Z' };
      await controller.createMyBooking(USER as never, dto as never);
      expect(createEmployeeHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({ ...dto, employeeId: USER.sub }),
      );
    });
  });

  describe('listMyBookings', () => {
    it('forces employeeId to authenticated user.sub', async () => {
      const { controller, listHandler } = buildController(null);
      await controller.listMyBookings(USER as never, {} as never);
      expect(listHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: USER.sub, page: 1, limit: 20 }),
      );
    });

    it('overrides any employeeId passed by the caller', async () => {
      const { controller, listHandler } = buildController(null);
      await controller.listMyBookings(USER as never, { employeeId: 'other-employee' } as never);
      const call = listHandler.execute.mock.calls[0][0] as { employeeId: string };
      expect(call.employeeId).toBe(USER.sub);
    });
  });

  describe('ownership enforcement', () => {
    it('throws NotFoundException when the booking is missing', async () => {
      const { controller } = buildController(null);
      await expect(controller.start(USER as never, 'missing-id')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when the booking belongs to a different employee', async () => {
      const { controller, checkInHandler } = buildController({ id: 'b1', employeeId: 'someone-else' });
      await expect(controller.start(USER as never, 'b1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(checkInHandler.execute).not.toHaveBeenCalled();
    });
  });

  describe('start', () => {
    it('calls CheckInBookingHandler when the booking is owned by the caller', async () => {
      const { controller, checkInHandler } = buildController({ id: 'b1', employeeId: USER.sub });
      await controller.start(USER as never, 'b1');
      expect(checkInHandler.execute).toHaveBeenCalledWith({ bookingId: 'b1', changedBy: USER.sub });
    });
  });

  describe('complete', () => {
    it('forwards completion notes to CompleteBookingHandler', async () => {
      const { controller, completeHandler } = buildController({ id: 'b1', employeeId: USER.sub });
      await controller.complete(USER as never, 'b1', { completionNotes: 'done' } as never);
      expect(completeHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({ bookingId: 'b1', changedBy: USER.sub, completionNotes: 'done' }),
      );
    });
  });

  describe('employeeCancel', () => {
    it('defaults reason to EMPLOYEE_UNAVAILABLE and tags source as employee', async () => {
      const { controller, cancelHandler } = buildController({ id: 'b1', employeeId: USER.sub });
      await controller.employeeCancel(USER as never, 'b1', {} as never);
      expect(cancelHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: 'b1',
          changedBy: USER.sub,
          reason: CancellationReason.EMPLOYEE_UNAVAILABLE,
          source: 'employee',
        }),
      );
    });
  });

  describe('cancelRequest', () => {
    it('calls RequestCancelBookingHandler with requestedBy = user.sub', async () => {
      const { controller, requestCancelHandler } = buildController({ id: 'b1', employeeId: USER.sub });
      await controller.cancelRequest(USER as never, 'b1', { cancelNotes: 'need to reschedule' } as never);
      expect(requestCancelHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: 'b1',
          requestedBy: USER.sub,
          reason: CancellationReason.EMPLOYEE_UNAVAILABLE,
          cancelNotes: 'need to reschedule',
        }),
      );
    });
  });
});
