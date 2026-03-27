/**
 * ServiceBookingTypeService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ServiceBookingTypeService } from '../../../src/modules/services/service-booking-type.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

const serviceId = 'service-uuid-1';
const mockService = { id: serviceId, deletedAt: null };

const mockBookingType = {
  id: 'bt-uuid-1',
  serviceId,
  bookingType: 'clinic_visit',
  price: 20000,
  duration: 30,
  isActive: true,
  durationOptions: [],
  createdAt: new Date('2026-01-01'),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTx: any = {
  serviceBookingType: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    create: jest.fn().mockResolvedValue(mockBookingType),
    findMany: jest.fn().mockResolvedValue([mockBookingType]),
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  service: { findFirst: jest.fn() },
  serviceBookingType: { findMany: jest.fn() },
  $transaction: jest.fn((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
};

describe('ServiceBookingTypeService', () => {
  let service: ServiceBookingTypeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceBookingTypeService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ServiceBookingTypeService>(ServiceBookingTypeService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
    );
  });

  describe('getByService', () => {
    it('should return booking types with durationOptions', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(mockService);
      mockPrisma.serviceBookingType.findMany.mockResolvedValue([mockBookingType]);

      const result = await service.getByService(serviceId);

      expect(result).toHaveLength(1);
      expect(mockPrisma.serviceBookingType.findMany).toHaveBeenCalledWith({
        where: { serviceId },
        include: { durationOptions: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should throw NotFoundException if service not found', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(null);
      await expect(service.getByService(serviceId)).rejects.toThrow(NotFoundException);
    });

    it('should return empty array when no booking types exist', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(mockService);
      mockPrisma.serviceBookingType.findMany.mockResolvedValue([]);

      const result = await service.getByService(serviceId);
      expect(result).toEqual([]);
    });
  });

  describe('setBookingTypes', () => {
    it('should delete old and create new booking types', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(mockService);
      mockTx.serviceBookingType.deleteMany.mockResolvedValue({ count: 1 });
      mockTx.serviceBookingType.create.mockResolvedValue(mockBookingType);
      mockTx.serviceBookingType.findMany.mockResolvedValue([mockBookingType]);

      const dto = {
        types: [
          { bookingType: 'clinic_visit', price: 20000, duration: 30 },
        ],
      };

      const result = await service.setBookingTypes(serviceId, dto);

      expect(mockTx.serviceBookingType.deleteMany).toHaveBeenCalledWith({ where: { serviceId } });
      expect(mockTx.serviceBookingType.create).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
    });

    it('should set isActive to true by default when not provided', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(mockService);
      mockTx.serviceBookingType.deleteMany.mockResolvedValue({ count: 0 });
      mockTx.serviceBookingType.create.mockResolvedValue(mockBookingType);
      mockTx.serviceBookingType.findMany.mockResolvedValue([mockBookingType]);

      await service.setBookingTypes(serviceId, {
        types: [{ bookingType: 'clinic_visit', price: 20000, duration: 30 }],
      });

      const createCall = mockTx.serviceBookingType.create.mock.calls[0][0];
      expect(createCall.data.isActive).toBe(true);
    });

    it('should create booking type without durationOptions when none provided', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(mockService);
      mockTx.serviceBookingType.deleteMany.mockResolvedValue({ count: 0 });
      mockTx.serviceBookingType.create.mockResolvedValue(mockBookingType);
      mockTx.serviceBookingType.findMany.mockResolvedValue([mockBookingType]);

      await service.setBookingTypes(serviceId, {
        types: [{ bookingType: 'phone', price: 15000, duration: 20 }],
      });

      const createCall = mockTx.serviceBookingType.create.mock.calls[0][0];
      expect(createCall.data.durationOptions).toBeUndefined();
    });

    it('should create booking type with durationOptions when provided', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(mockService);
      mockTx.serviceBookingType.deleteMany.mockResolvedValue({ count: 0 });
      mockTx.serviceBookingType.create.mockResolvedValue(mockBookingType);
      mockTx.serviceBookingType.findMany.mockResolvedValue([mockBookingType]);

      await service.setBookingTypes(serviceId, {
        types: [
          {
            bookingType: 'clinic_visit',
            price: 20000,
            duration: 30,
            durationOptions: [
              { label: '30 min', labelAr: '٣٠ دقيقة', durationMinutes: 30, price: 10000 },
            ],
          },
        ],
      });

      const createCall = mockTx.serviceBookingType.create.mock.calls[0][0];
      expect(createCall.data.durationOptions).toBeDefined();
      expect(createCall.data.durationOptions.createMany.data).toHaveLength(1);
    });

    it('should throw NotFoundException if service not found', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(null);
      await expect(
        service.setBookingTypes(serviceId, { types: [] }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
