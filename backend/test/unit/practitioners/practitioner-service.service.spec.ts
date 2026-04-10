/**
 * PractitionerServiceService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PractitionerServiceService } from '../../../src/modules/practitioners/practitioner-service.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

const practitionerId = 'pract-uuid-1';
const serviceId = 'svc-uuid-1';
const psId = 'ps-uuid-1';

const mockPractitioner = { id: practitionerId, userId: 'user-uuid-1', deletedAt: null };
const mockService = { id: serviceId, deletedAt: null, nameEn: 'Consultation', price: 20000, duration: 30 };
const mockPs = {
  id: psId,
  practitionerId,
  serviceId,
  priceClinic: null,
  pricePhone: null,
  priceVideo: null,
  isActive: true,
  bufferMinutes: 0,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  practitioner: { findFirst: jest.fn() },
  service: { findFirst: jest.fn() },
  practitionerService: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findFirst: jest.fn(),
  },
  practitionerServiceType: {
    findMany: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  booking: { count: jest.fn() },
  user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-uuid-1' }) },
};

describe('PractitionerServiceService', () => {
  let service: PractitionerServiceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PractitionerServiceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PractitionerServiceService>(PractitionerServiceService);
    jest.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-uuid-1' });
  });

  describe('assignService', () => {
    it('should assign a service to a practitioner', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.service.findFirst.mockResolvedValue(mockService);
      mockPrisma.practitionerService.findUnique.mockResolvedValue(null);
      mockPrisma.practitionerService.create.mockResolvedValue(mockPs);
      mockPrisma.practitionerService.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
        ...mockPs,
        service: mockService,
        serviceTypes: [],
      });

      const result = await service.assignService(practitionerId, { serviceId });

      expect(mockPrisma.practitionerService.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when practitioner not found', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(null);

      await expect(
        service.assignService(practitionerId, { serviceId }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when service not found', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.service.findFirst.mockResolvedValue(null);

      await expect(
        service.assignService(practitionerId, { serviceId }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when service already assigned', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.service.findFirst.mockResolvedValue(mockService);
      mockPrisma.practitionerService.findUnique.mockResolvedValue(mockPs);

      await expect(
        service.assignService(practitionerId, { serviceId }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('listServices', () => {
    it('should return list of services for a practitioner', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerService.findMany.mockResolvedValue([mockPs]);

      const result = await service.listServices(practitionerId);

      expect(result).toHaveLength(1);
      expect(mockPrisma.practitionerService.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { practitionerId, isActive: true } }),
      );
    });

    it('should throw NotFoundException when practitioner not found', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(null);
      await expect(service.listServices('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateService', () => {
    it('should update practitioner service', async () => {
      const updatedPs = { ...mockPs, isActive: false };
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerService.findUnique.mockResolvedValueOnce(mockPs).mockResolvedValueOnce({
        ...updatedPs,
        service: mockService,
        serviceTypes: [],
      });
      mockPrisma.practitionerService.update.mockResolvedValue(updatedPs);

      const result = await service.updateService(practitionerId, serviceId, { isActive: false });

      expect(mockPrisma.practitionerService.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when practitioner service not found', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerService.findUnique.mockResolvedValue(null);

      await expect(
        service.updateService(practitionerId, serviceId, {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeService', () => {
    it('should remove a service assignment', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerService.findUnique.mockResolvedValue(mockPs);
      mockPrisma.booking.count.mockResolvedValue(0);
      mockPrisma.practitionerService.delete.mockResolvedValue(mockPs);

      const result = await service.removeService(practitionerId, serviceId);

      expect(result).toEqual({ deleted: true });
      expect(mockPrisma.practitionerService.delete).toHaveBeenCalledWith({ where: { id: psId } });
    });

    it('should throw ConflictException when active bookings exist', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerService.findUnique.mockResolvedValue(mockPs);
      mockPrisma.booking.count.mockResolvedValue(2);

      await expect(
        service.removeService(practitionerId, serviceId),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when assignment not found', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerService.findUnique.mockResolvedValue(null);

      await expect(
        service.removeService(practitionerId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getServiceTypes', () => {
    it('should return service types for a practitioner service', async () => {
      mockPrisma.practitionerService.findFirst.mockResolvedValue(mockPs);
      mockPrisma.practitionerServiceType.findMany.mockResolvedValue([]);

      const result = await service.getServiceTypes(practitionerId, serviceId);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should throw NotFoundException when assignment not found', async () => {
      mockPrisma.practitionerService.findFirst.mockResolvedValue(null);

      await expect(
        service.getServiceTypes(practitionerId, serviceId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Hard edge cases ────────────────────────────────────────────────────────

  describe('[FIXED] removeService guards all 4 active booking statuses', () => {
    it('throws ConflictException when a checked_in booking exists', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerService.findUnique.mockResolvedValue(mockPs);
      mockPrisma.booking.count.mockResolvedValue(1);

      await expect(
        service.removeService(practitionerId, serviceId),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when an in_progress booking exists', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerService.findUnique.mockResolvedValue(mockPs);
      mockPrisma.booking.count.mockResolvedValue(1);

      await expect(
        service.removeService(practitionerId, serviceId),
      ).rejects.toThrow(ConflictException);
    });

    it('verifies booking.count query includes all 4 active statuses', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerService.findUnique.mockResolvedValue(mockPs);
      mockPrisma.booking.count.mockResolvedValue(0);
      mockPrisma.practitionerService.delete.mockResolvedValue(mockPs);

      await service.removeService(practitionerId, serviceId);

      expect(mockPrisma.booking.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['pending', 'confirmed', 'checked_in', 'in_progress'] },
          }),
        }),
      );
    });

    it('allows removal when no active bookings exist', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerService.findUnique.mockResolvedValue(mockPs);
      mockPrisma.booking.count.mockResolvedValue(0);
      mockPrisma.practitionerService.delete.mockResolvedValue(mockPs);

      const result = await service.removeService(practitionerId, serviceId);

      expect(result).toEqual({ deleted: true });
    });
  });
});
