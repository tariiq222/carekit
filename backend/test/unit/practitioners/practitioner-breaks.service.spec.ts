/**
 * PractitionerBreaksService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PractitionerBreaksService } from '../../../src/modules/practitioners/practitioner-breaks.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

const practitionerId = 'pract-uuid-1';
const userId = 'user-uuid-1';
const mockPractitioner = { id: practitionerId, userId, deletedAt: null };

const mockAvailability = [
  {
    practitionerId,
    dayOfWeek: 1,
    startTime: '08:00',
    endTime: '17:00',
    isActive: true,
  },
];

const validBreaks = [{ dayOfWeek: 1, startTime: '12:00', endTime: '13:00' }];

const mockTx: any = {
  practitionerBreak: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    createMany: jest.fn().mockResolvedValue({ count: 1 }),
    findMany: jest.fn().mockResolvedValue(validBreaks),
  },
};

const mockPrisma: any = {
  practitioner: { findFirst: jest.fn() },
  practitionerBreak: { findMany: jest.fn() },
  practitionerAvailability: { findMany: jest.fn() },
  user: { findUnique: jest.fn().mockResolvedValue({ id: userId }) },
  $transaction: jest.fn((fn: (tx: typeof mockTx) => Promise<unknown>) =>
    fn(mockTx),
  ),
};

describe('PractitionerBreaksService', () => {
  let service: PractitionerBreaksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PractitionerBreaksService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PractitionerBreaksService>(PractitionerBreaksService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
    );
    mockPrisma.user.findUnique.mockResolvedValue({ id: userId });
  });

  describe('getBreaks', () => {
    it('should return breaks for a practitioner', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerBreak.findMany.mockResolvedValue(validBreaks);

      const result = await service.getBreaks(practitionerId);

      expect(result).toHaveLength(1);
      expect(mockPrisma.practitionerBreak.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { practitionerId } }),
      );
    });

    it('should throw NotFoundException when practitioner not found', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(null);
      await expect(service.getBreaks('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when practitioner is soft-deleted', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue({
        ...mockPractitioner,
        deletedAt: new Date(),
      });
      await expect(service.getBreaks(practitionerId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('setBreaks', () => {
    it('should replace breaks atomically', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerAvailability.findMany.mockResolvedValue(
        mockAvailability,
      );
      mockTx.practitionerBreak.findMany.mockResolvedValue(validBreaks);

      const result = await service.setBreaks(practitionerId, {
        breaks: validBreaks,
      });

      expect(mockTx.practitionerBreak.deleteMany).toHaveBeenCalledWith({
        where: { practitionerId },
      });
      expect(mockTx.practitionerBreak.createMany).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('should return empty array when breaks list is empty', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerAvailability.findMany.mockResolvedValue([]);
      mockTx.practitionerBreak.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.setBreaks(practitionerId, { breaks: [] });

      expect(result).toEqual([]);
      expect(mockTx.practitionerBreak.createMany).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when practitioner not found', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(null);
      await expect(
        service.setBreaks(practitionerId, { breaks: validBreaks }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid dayOfWeek', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);

      await expect(
        service.setBreaks(practitionerId, {
          breaks: [{ dayOfWeek: 7, startTime: '12:00', endTime: '13:00' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid time format', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);

      await expect(
        service.setBreaks(practitionerId, {
          breaks: [{ dayOfWeek: 1, startTime: '1200', endTime: '13:00' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when startTime >= endTime', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);

      await expect(
        service.setBreaks(practitionerId, {
          breaks: [{ dayOfWeek: 1, startTime: '13:00', endTime: '12:00' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for overlapping breaks', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);

      await expect(
        service.setBreaks(practitionerId, {
          breaks: [
            { dayOfWeek: 1, startTime: '12:00', endTime: '13:00' },
            { dayOfWeek: 1, startTime: '12:30', endTime: '13:30' },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when break is outside availability', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerAvailability.findMany.mockResolvedValue([
        {
          practitionerId,
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '12:00',
          isActive: true,
        },
      ]);

      await expect(
        service.setBreaks(practitionerId, {
          breaks: [{ dayOfWeek: 1, startTime: '12:00', endTime: '14:00' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
