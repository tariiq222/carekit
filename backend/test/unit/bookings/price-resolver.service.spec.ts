/**
 * PriceResolverService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PriceResolverService } from '../../../src/modules/bookings/price-resolver.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

const serviceId = 'svc-uuid';
const practitionerServiceId = 'ps-uuid';
const bookingType = 'in_person' as const;

const durationOption = { id: 'opt-1', price: 15000, durationMinutes: 30, isDefault: true, sortOrder: 0 };

const mockSbt = {
  id: 'sbt-1',
  serviceId,
  bookingType,
  price: 20000,
  duration: 45,
  isActive: true,
  durationOptions: [],
};

const mockPst = {
  id: 'pst-1',
  practitionerServiceId,
  bookingType,
  price: 18000,
  duration: 30,
  isActive: true,
  useCustomOptions: false,
  durationOptions: [],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  serviceBookingType: { findUnique: jest.fn() },
  practitionerServiceType: { findUnique: jest.fn() },
};

describe('PriceResolverService', () => {
  let service: PriceResolverService;

  const baseParams = { serviceId, practitionerServiceId, bookingType };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceResolverService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PriceResolverService>(PriceResolverService);
    jest.clearAllMocks();
  });

  describe('resolve — service not available', () => {
    it('should throw BadRequestException when SBT not found', async () => {
      mockPrisma.serviceBookingType.findUnique.mockResolvedValue(null);

      await expect(service.resolve(baseParams)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when SBT is inactive', async () => {
      mockPrisma.serviceBookingType.findUnique.mockResolvedValue({ ...mockSbt, isActive: false });

      await expect(service.resolve(baseParams)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when PST is inactive', async () => {
      mockPrisma.serviceBookingType.findUnique.mockResolvedValue(mockSbt);
      mockPrisma.practitionerServiceType.findUnique.mockResolvedValue({ ...mockPst, isActive: false });

      await expect(service.resolve(baseParams)).rejects.toThrow(BadRequestException);
    });
  });

  describe('resolve — source: service_type (no practitioner override)', () => {
    it('should return service flat price when no PST exists', async () => {
      mockPrisma.serviceBookingType.findUnique.mockResolvedValue(mockSbt);
      mockPrisma.practitionerServiceType.findUnique.mockResolvedValue(null);

      const result = await service.resolve(baseParams);

      expect(result.price).toBe(20000);
      expect(result.duration).toBe(45);
      expect(result.source).toBe('service_type');
    });

    it('should return service_option when SBT has duration options', async () => {
      mockPrisma.serviceBookingType.findUnique.mockResolvedValue({
        ...mockSbt,
        durationOptions: [durationOption],
      });
      mockPrisma.practitionerServiceType.findUnique.mockResolvedValue(null);

      const result = await service.resolve(baseParams);

      expect(result.source).toBe('service_option');
      expect(result.price).toBe(15000);
      expect(result.duration).toBe(30);
      expect(result.durationOptionId).toBe('opt-1');
    });
  });

  describe('resolve — source: practitioner_type', () => {
    it('should return practitioner flat price when PST exists without options', async () => {
      mockPrisma.serviceBookingType.findUnique.mockResolvedValue(mockSbt);
      mockPrisma.practitionerServiceType.findUnique.mockResolvedValue(mockPst);

      const result = await service.resolve(baseParams);

      expect(result.price).toBe(18000);
      expect(result.duration).toBe(30);
      expect(result.source).toBe('practitioner_type');
    });
  });

  describe('resolve — source: practitioner_option', () => {
    it('should return practitioner custom option when useCustomOptions is true', async () => {
      mockPrisma.serviceBookingType.findUnique.mockResolvedValue(mockSbt);
      mockPrisma.practitionerServiceType.findUnique.mockResolvedValue({
        ...mockPst,
        useCustomOptions: true,
        durationOptions: [durationOption],
      });

      const result = await service.resolve(baseParams);

      expect(result.source).toBe('practitioner_option');
      expect(result.price).toBe(15000);
      expect(result.durationOptionId).toBe('opt-1');
    });
  });

  describe('resolve — with specific durationOptionId', () => {
    it('should return service option when matching ID found in SBT', async () => {
      mockPrisma.serviceBookingType.findUnique.mockResolvedValue({
        ...mockSbt,
        durationOptions: [durationOption],
      });
      mockPrisma.practitionerServiceType.findUnique.mockResolvedValue(null);

      const result = await service.resolve({ ...baseParams, durationOptionId: 'opt-1' });

      expect(result.source).toBe('service_option');
      expect(result.durationOptionId).toBe('opt-1');
    });

    it('should return practitioner option when ID found in PST', async () => {
      const practOpt = { id: 'popt-1', price: 12000, durationMinutes: 25 };
      mockPrisma.serviceBookingType.findUnique.mockResolvedValue(mockSbt);
      mockPrisma.practitionerServiceType.findUnique.mockResolvedValue({
        ...mockPst,
        useCustomOptions: true,
        durationOptions: [practOpt],
      });

      const result = await service.resolve({ ...baseParams, durationOptionId: 'popt-1' });

      expect(result.source).toBe('practitioner_option');
      expect(result.durationOptionId).toBe('popt-1');
    });

    it('should throw BadRequestException when durationOptionId not found', async () => {
      mockPrisma.serviceBookingType.findUnique.mockResolvedValue(mockSbt);
      mockPrisma.practitionerServiceType.findUnique.mockResolvedValue(null);

      await expect(
        service.resolve({ ...baseParams, durationOptionId: 'non-existent' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
