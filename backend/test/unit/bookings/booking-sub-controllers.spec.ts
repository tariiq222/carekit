/**
 * CareKit — Delegation tests for BookingSettingsController,
 * BookingStatusLogController, and WaitlistController.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BookingSettingsController } from '../../../src/modules/bookings/booking-settings.controller.js';
import { BookingStatusLogController } from '../../../src/modules/bookings/booking-status-log.controller.js';
import { WaitlistController } from '../../../src/modules/bookings/waitlist.controller.js';
import { BookingSettingsService } from '../../../src/modules/bookings/booking-settings.service.js';
import { BookingStatusLogService } from '../../../src/modules/bookings/booking-status-log.service.js';
import { WaitlistService } from '../../../src/modules/bookings/waitlist.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockBookingSettingsService = {
  get: jest.fn(),
  update: jest.fn(),
};

const mockBookingStatusLogService = {
  findByBooking: jest.fn(),
};

const mockWaitlistService = {
  findMyEntries: jest.fn(),
  findAll: jest.fn(),
  join: jest.fn(),
  leave: jest.fn(),
};

const guardOverride = { canActivate: () => true };

// ── BookingSettingsController ─────────────────────────────────────────────────

describe('BookingSettingsController', () => {
  let controller: BookingSettingsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingSettingsController],
      providers: [
        { provide: BookingSettingsService, useValue: mockBookingSettingsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(guardOverride)
      .overrideGuard(PermissionsGuard)
      .useValue(guardOverride)
      .compile();

    controller = module.get<BookingSettingsController>(BookingSettingsController);
  });

  describe('get', () => {
    it('should delegate to service.get and wrap in success envelope', async () => {
      const settings = { allowOnlineBooking: true, leadTimeHours: 2 };
      mockBookingSettingsService.get.mockResolvedValue(settings);

      const result = await controller.get();

      expect(mockBookingSettingsService.get).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: true, data: settings });
    });
  });

  describe('update', () => {
    it('should delegate to service.update with dto and wrap in success envelope', async () => {
      const dto = { allowOnlineBooking: false, leadTimeHours: 4 };
      const updated = { ...dto };
      mockBookingSettingsService.update.mockResolvedValue(updated);

      const result = await controller.update(dto as any);

      expect(mockBookingSettingsService.update).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ success: true, data: updated });
    });
  });
});

// ── BookingStatusLogController ────────────────────────────────────────────────

describe('BookingStatusLogController', () => {
  let controller: BookingStatusLogController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingStatusLogController],
      providers: [
        { provide: BookingStatusLogService, useValue: mockBookingStatusLogService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(guardOverride)
      .overrideGuard(PermissionsGuard)
      .useValue(guardOverride)
      .compile();

    controller = module.get<BookingStatusLogController>(BookingStatusLogController);
  });

  describe('getStatusLog', () => {
    it('should delegate to service.findByBooking with the booking id', async () => {
      const bookingId = 'bk-uuid-001';
      const log = [{ status: 'confirmed', changedAt: new Date() }];
      mockBookingStatusLogService.findByBooking.mockResolvedValue(log);

      const result = await controller.getStatusLog(bookingId);

      expect(mockBookingStatusLogService.findByBooking).toHaveBeenCalledWith(bookingId);
      expect(result).toEqual({ success: true, data: log });
    });
  });
});

// ── WaitlistController ────────────────────────────────────────────────────────

describe('WaitlistController', () => {
  let controller: WaitlistController;
  const user = { id: 'user-uuid-001' };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WaitlistController],
      providers: [
        { provide: WaitlistService, useValue: mockWaitlistService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(guardOverride)
      .overrideGuard(PermissionsGuard)
      .useValue(guardOverride)
      .compile();

    controller = module.get<WaitlistController>(WaitlistController);
  });

  describe('findMyEntries', () => {
    it('should delegate to service.findMyEntries with user id', async () => {
      const entries = [{ id: 'wl-1', status: 'waiting' }];
      mockWaitlistService.findMyEntries.mockResolvedValue(entries);

      const result = await controller.findMyEntries(user);

      expect(mockWaitlistService.findMyEntries).toHaveBeenCalledWith(user.id);
      expect(result).toEqual({ success: true, data: entries });
    });
  });

  describe('findAll', () => {
    it('should delegate to service.findAll with optional filters', async () => {
      const entries = [{ id: 'wl-1' }, { id: 'wl-2' }];
      mockWaitlistService.findAll.mockResolvedValue(entries);

      const result = await controller.findAll('prac-uuid-001', 'waiting');

      expect(mockWaitlistService.findAll).toHaveBeenCalledWith({
        practitionerId: 'prac-uuid-001',
        status: 'waiting',
      });
      expect(result).toEqual({ success: true, data: entries });
    });

    it('should pass undefined filters when no query params provided', async () => {
      const entries: unknown[] = [];
      mockWaitlistService.findAll.mockResolvedValue(entries);

      const result = await controller.findAll(undefined, undefined);

      expect(mockWaitlistService.findAll).toHaveBeenCalledWith({
        practitionerId: undefined,
        status: undefined,
      });
      expect(result).toEqual({ success: true, data: entries });
    });
  });

  describe('join', () => {
    it('should delegate to service.join and return success message', async () => {
      const dto = { serviceId: 'svc-1', practitionerId: 'prac-1' };
      const entry = { id: 'wl-1', status: 'waiting' };
      mockWaitlistService.join.mockResolvedValue(entry);

      const result = await controller.join(dto as any, user);

      expect(mockWaitlistService.join).toHaveBeenCalledWith(user.id, dto);
      expect(result).toEqual({
        success: true,
        data: entry,
        message: 'Joined waitlist successfully',
      });
    });
  });

  describe('leave', () => {
    it('should call service.leave and return success message without data', async () => {
      mockWaitlistService.leave.mockResolvedValue(undefined);

      const result = await controller.leave('wl-uuid-001', user);

      expect(mockWaitlistService.leave).toHaveBeenCalledWith('wl-uuid-001', user.id);
      expect(result).toEqual({ success: true, message: 'Left waitlist successfully' });
    });
  });
});
