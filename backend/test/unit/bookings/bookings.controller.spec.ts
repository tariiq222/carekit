/**
 * CareKit — BookingsController Unit Tests (delegation tests)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BookingsController } from '../../../src/modules/bookings/bookings.controller.js';
import { BookingActionsController } from '../../../src/modules/bookings/booking-actions.controller.js';
import { BookingsService } from '../../../src/modules/bookings/bookings.service.js';
import { BookingRecurringService } from '../../../src/modules/bookings/booking-recurring.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

// ── Mocks ────────────────────────────────────────────────────────────────

const mockBookingsService = {
  create: jest.fn(),
  findAllScoped: jest.fn(),
  findOneScoped: jest.fn(),
  findMyBookings: jest.fn(),
  findTodayBookingsForUser: jest.fn(),
  confirm: jest.fn(),
  complete: jest.fn(),
  reschedule: jest.fn(),
  cancel: jest.fn(),
  markNoShow: jest.fn(),
  requestCancellation: jest.fn(),
  approveCancellation: jest.fn(),
  rejectCancellation: jest.fn(),
  adminDirectCancel: jest.fn(),
  practitionerCancel: jest.fn(),
  checkIn: jest.fn(),
  startSession: jest.fn(),
  getStats: jest.fn(),
  getPaymentStatus: jest.fn(),
  patientReschedule: jest.fn(),
};

const mockRecurringService = {
  createRecurring: jest.fn(),
};

const defaultUser = {
  id: 'user-1',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  phone: null,
  gender: null,
  isActive: true,
  emailVerified: true,
  createdAt: new Date(),
  roles: [{ id: 'role-1', name: 'Patient', slug: 'patient' }],
  permissions: [],
} as import('../../../src/common/types/user-payload.type.js').UserPayload;

// ── Tests ────────────────────────────────────────────────────────────────

describe('BookingsController', () => {
  let controller: BookingsController;
  let actionsController: BookingActionsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController, BookingActionsController],
      providers: [
        { provide: BookingsService, useValue: mockBookingsService },
        { provide: BookingRecurringService, useValue: mockRecurringService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BookingsController>(BookingsController);
    actionsController = module.get<BookingActionsController>(BookingActionsController);
  });

  // ─── create ─────────────────────────────────────────────────────────

  describe('create', () => {
    it('should delegate to bookingsService.create', async () => {
      const dto = { serviceId: 'svc-1', date: '2026-04-01' };
      const booking = { id: 'bk-1', status: 'pending' };
      mockBookingsService.create.mockResolvedValue(booking);

      const result = await controller.create(dto as any, defaultUser);

      expect(mockBookingsService.create).toHaveBeenCalledWith(
        'user-1',
        dto,
        defaultUser.roles,
      );
      expect(result).toEqual(booking);
    });
  });

  // ─── findAll ────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should delegate to bookingsService.findAllScoped', async () => {
      const query = { page: 1, perPage: 20 };
      const bookings = [{ id: 'bk-1' }, { id: 'bk-2' }];
      mockBookingsService.findAllScoped.mockResolvedValue(bookings);

      const result = await controller.findAll(query as any, defaultUser);

      expect(mockBookingsService.findAllScoped).toHaveBeenCalledWith(
        query,
        'user-1',
      );
      expect(result).toEqual(bookings);
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should delegate to bookingsService.findOneScoped', async () => {
      const booking = { id: 'bk-1', status: 'confirmed' };
      mockBookingsService.findOneScoped.mockResolvedValue(booking);

      const result = await controller.findOne('bk-1', defaultUser);

      expect(mockBookingsService.findOneScoped).toHaveBeenCalledWith(
        'bk-1',
        'user-1',
      );
      expect(result).toEqual(booking);
    });
  });

  // ─── confirm ────────────────────────────────────────────────────────

  describe('confirm', () => {
    it('should delegate to bookingsService.confirm', async () => {
      const booking = { id: 'bk-1', status: 'confirmed' };
      mockBookingsService.confirm.mockResolvedValue(booking);

      const result = await actionsController.confirm('bk-1', defaultUser);

      expect(mockBookingsService.confirm).toHaveBeenCalledWith(
        'bk-1',
        'user-1',
      );
      expect(result).toEqual(booking);
    });
  });

  // ─── complete ───────────────────────────────────────────────────────

  describe('complete', () => {
    it('should delegate to bookingsService.complete', async () => {
      const dto = { notes: 'Session completed' };
      const booking = { id: 'bk-1', status: 'completed' };
      mockBookingsService.complete.mockResolvedValue(booking);

      const result = await actionsController.complete('bk-1', dto as any, defaultUser);

      expect(mockBookingsService.complete).toHaveBeenCalledWith(
        'bk-1',
        dto,
        'user-1',
      );
      expect(result).toEqual(booking);
    });
  });

  // ─── cancelRequest ──────────────────────────────────────────────────

  describe('cancelRequest', () => {
    it('should delegate to bookingsService.requestCancellation', async () => {
      const dto = { reason: 'Schedule conflict' };
      const cancellation = { id: 'cancel-1', status: 'pending' };
      mockBookingsService.requestCancellation.mockResolvedValue(cancellation);

      const result = await actionsController.cancelRequest(
        'bk-1',
        dto as any,
        defaultUser,
      );

      expect(mockBookingsService.requestCancellation).toHaveBeenCalledWith(
        'bk-1',
        'user-1',
        'Schedule conflict',
      );
      expect(result).toEqual(cancellation);
    });
  });

  // ─── reschedule ─────────────────────────────────────────────────────

  describe('reschedule', () => {
    it('should delegate to bookingsService.reschedule', async () => {
      const dto = { date: '2026-04-05', time: '10:00' };
      const booking = { id: 'bk-1', status: 'confirmed' };
      mockBookingsService.reschedule.mockResolvedValue(booking);

      const result = await controller.reschedule(
        'bk-1',
        dto as any,
        defaultUser,
      );

      expect(mockBookingsService.reschedule).toHaveBeenCalledWith(
        'bk-1',
        dto,
        'user-1',
      );
      expect(result).toEqual(booking);
    });
  });

  // ─── findMyBookings ─────────────────────────────────────────────────

  describe('findMyBookings', () => {
    it('should delegate to bookingsService.findMyBookings', async () => {
      const bookings = [{ id: 'bk-1' }];
      mockBookingsService.findMyBookings.mockResolvedValue(bookings);

      const pagination = { page: 1, perPage: 20 };
      const result = await controller.findMyBookings(defaultUser, pagination as any);

      expect(mockBookingsService.findMyBookings).toHaveBeenCalledWith('user-1', 1, 20);
      expect(result).toEqual(bookings);
    });
  });

  // ─── getStats ───────────────────────────────────────────────────────

  describe('getStats', () => {
    it('should delegate to bookingsService.getStats', async () => {
      const stats = { total: 10, confirmed: 5 };
      mockBookingsService.getStats.mockResolvedValue(stats);

      const result = await controller.getStats(
        defaultUser,
        '2026-04-01',
        '2026-04-30',
      );

      expect(mockBookingsService.getStats).toHaveBeenCalledWith(
        'user-1',
        '2026-04-01',
        '2026-04-30',
      );
      expect(result).toEqual(stats);
    });
  });

  // ─── createRecurring ────────────────────────────────────────────────

  describe('createRecurring', () => {
    it('should delegate to bookingRecurringService.createRecurring', async () => {
      const dto = { serviceId: 'svc-1', frequency: 'weekly' };
      const data = { created: 4 };
      mockRecurringService.createRecurring.mockResolvedValue(data);

      const result = await controller.createRecurring(dto as any, defaultUser);

      expect(mockRecurringService.createRecurring).toHaveBeenCalledWith(
        'user-1',
        dto,
        defaultUser.roles,
      );
      expect(result).toEqual(data);
    });
  });

  // ─── markNoShow ─────────────────────────────────────────────────────

  describe('markNoShow', () => {
    it('should delegate to bookingsService.markNoShow', async () => {
      const booking = { id: 'bk-1', status: 'no_show' };
      mockBookingsService.markNoShow.mockResolvedValue(booking);

      const result = await actionsController.markNoShow('bk-1', defaultUser);

      expect(mockBookingsService.markNoShow).toHaveBeenCalledWith(
        'bk-1',
        'user-1',
      );
      expect(result).toEqual(booking);
    });
  });

  // ─── adminCancel ────────────────────────────────────────────────────

  describe('adminCancel', () => {
    it('should delegate to bookingsService.adminDirectCancel', async () => {
      const dto = { reason: 'Admin override' };
      const data = { id: 'bk-1', status: 'cancelled' };
      mockBookingsService.adminDirectCancel.mockResolvedValue(data);

      const result = await actionsController.adminCancel(
        'bk-1',
        dto as any,
        defaultUser,
      );

      expect(mockBookingsService.adminDirectCancel).toHaveBeenCalledWith(
        'bk-1',
        'user-1',
        dto,
      );
      expect(result).toEqual(data);
    });
  });
});
