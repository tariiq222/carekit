/**
 * WaitlistService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { WaitlistService } from '../../../src/modules/bookings/waitlist.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { MessagingDispatcherService } from '../../../src/modules/messaging/core/messaging-dispatcher.service.js';
import { BookingSettingsService } from '../../../src/modules/bookings/booking-settings.service.js';
import { ClinicSettingsService } from '../../../src/modules/clinic-settings/clinic-settings.service.js';

const patientId = 'patient-uuid-1';
const practitionerId = 'pract-uuid-1';
const entryId = 'entry-uuid-1';

const mockEntry = {
  id: entryId,
  patientId,
  practitionerId,
  status: 'waiting',
  createdAt: new Date('2026-01-01'),
};

const defaultSettings = {
  waitlistEnabled: true,
  waitlistMaxPerSlot: 10,
  waitlistAutoNotify: true,
};

const joinDto = { practitionerId };

const mockPrisma: any = {
  waitlistEntry: {
    count: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn().mockResolvedValue(mockEntry),
    update: jest.fn().mockResolvedValue({ ...mockEntry, status: 'cancelled' }),
  },
};

const mockNotifications: any = {
  dispatch: jest.fn().mockResolvedValue(undefined),
};

const mockSettings: any = {
  get: jest.fn().mockResolvedValue(defaultSettings),
};

const mockClinicSettings: any = {
  getTimezone: jest.fn().mockResolvedValue('Asia/Riyadh'),
};

describe('WaitlistService', () => {
  let service: WaitlistService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaitlistService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MessagingDispatcherService, useValue: mockNotifications },
        { provide: BookingSettingsService, useValue: mockSettings },
        { provide: ClinicSettingsService, useValue: mockClinicSettings },
      ],
    }).compile();

    service = module.get<WaitlistService>(WaitlistService);
    jest.clearAllMocks();
    mockSettings.get.mockResolvedValue(defaultSettings);
    mockNotifications.dispatch.mockResolvedValue(undefined);
  });

  describe('join', () => {
    it('should add patient to waitlist', async () => {
      mockPrisma.waitlistEntry.count.mockResolvedValue(0);
      mockPrisma.waitlistEntry.findFirst.mockResolvedValue(null);
      mockPrisma.waitlistEntry.create.mockResolvedValue(mockEntry);

      const result = await service.join(patientId, joinDto);

      expect(result.id).toBe(entryId);
      expect(mockPrisma.waitlistEntry.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException when waitlist not enabled', async () => {
      mockSettings.get.mockResolvedValue({
        ...defaultSettings,
        waitlistEnabled: false,
      });

      await expect(service.join(patientId, joinDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when waitlist is full', async () => {
      mockPrisma.waitlistEntry.count.mockResolvedValue(10);

      await expect(service.join(patientId, joinDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException when already on waitlist', async () => {
      mockPrisma.waitlistEntry.count.mockResolvedValue(0);
      mockPrisma.waitlistEntry.findFirst.mockResolvedValue(mockEntry);

      await expect(service.join(patientId, joinDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('leave', () => {
    it('should cancel waitlist entry', async () => {
      mockPrisma.waitlistEntry.findFirst.mockResolvedValue(mockEntry);
      mockPrisma.waitlistEntry.update.mockResolvedValue({
        ...mockEntry,
        status: 'cancelled',
      });

      const result = await service.leave(entryId, patientId);

      expect(result.status).toBe('cancelled');
      expect(mockPrisma.waitlistEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: entryId },
          data: { status: 'cancelled' },
        }),
      );
    });

    it('should throw NotFoundException when entry not found', async () => {
      mockPrisma.waitlistEntry.findFirst.mockResolvedValue(null);

      await expect(service.leave('non-existent', patientId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findMyEntries', () => {
    it('should return waitlist entries for patient', async () => {
      mockPrisma.waitlistEntry.findMany.mockResolvedValue([mockEntry]);

      const result = await service.findMyEntries(patientId);

      expect(result).toHaveLength(1);
      expect(mockPrisma.waitlistEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { patientId, status: { in: ['waiting', 'notified'] } },
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return all entries without filter', async () => {
      mockPrisma.waitlistEntry.findMany.mockResolvedValue([mockEntry]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
    });

    it('should filter by practitionerId and status when provided', async () => {
      mockPrisma.waitlistEntry.findMany.mockResolvedValue([mockEntry]);

      await service.findAll({ practitionerId, status: 'waiting' });

      expect(mockPrisma.waitlistEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ practitionerId, status: 'waiting' }),
        }),
      );
    });
  });

  describe('checkAndNotify', () => {
    it('should skip when waitlist not enabled', async () => {
      mockSettings.get.mockResolvedValue({
        waitlistEnabled: false,
        waitlistAutoNotify: true,
      });

      await service.checkAndNotify(practitionerId, new Date());

      expect(mockPrisma.waitlistEntry.findMany).not.toHaveBeenCalled();
    });

    it('should skip when autoNotify not enabled', async () => {
      mockSettings.get.mockResolvedValue({
        waitlistEnabled: true,
        waitlistAutoNotify: false,
      });

      await service.checkAndNotify(practitionerId, new Date());

      expect(mockPrisma.waitlistEntry.findMany).not.toHaveBeenCalled();
    });

    it('should notify waiting patients when slot opens', async () => {
      const entryWithPractitioner = {
        ...mockEntry,
        practitioner: { user: { firstName: 'Ahmad', lastName: 'Al-Omari' } },
      };
      mockPrisma.waitlistEntry.findMany.mockResolvedValue([
        entryWithPractitioner,
      ]);
      mockPrisma.waitlistEntry.update.mockResolvedValue({});

      await service.checkAndNotify(practitionerId, new Date('2026-05-10'));

      expect(mockPrisma.waitlistEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'notified', notifiedAt: expect.any(Date) },
        }),
      );
      expect(mockNotifications.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientUserId: patientId,
          event: 'booking.waitlist_slot_available',
        }),
      );
    });

    it('should do nothing when no entries waiting', async () => {
      mockPrisma.waitlistEntry.findMany.mockResolvedValue([]);

      await service.checkAndNotify(practitionerId, new Date());

      expect(mockPrisma.waitlistEntry.update).not.toHaveBeenCalled();
    });
  });
});
