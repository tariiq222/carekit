/**
 * ServiceBookingTypeService Unit Tests
 * Covers: getByService, setBookingTypes
 * Regression: #18 (active bookings block), #20 (parallel creates), #8 (isDefault uniqueness)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { BookingType } from '@prisma/client';
import { ServiceBookingTypeService } from '../../../src/modules/services/service-booking-type.service.js';
import { ServicesService } from '../../../src/modules/services/services.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

const serviceId = 'service-uuid-1';

const mockBookingType = {
  id: 'bt-uuid-1',
  serviceId,
  bookingType: 'in_person',
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
  serviceBookingType: { findMany: jest.fn() },
  booking: { count: jest.fn().mockResolvedValue(0) },
  $transaction: jest.fn((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockServicesService: any = {
  ensureExists: jest.fn(),
  invalidateServicesCache: jest.fn(),
};

describe('ServiceBookingTypeService', () => {
  let service: ServiceBookingTypeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceBookingTypeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ServicesService, useValue: mockServicesService },
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
      mockServicesService.ensureExists.mockResolvedValue({ id: serviceId, deletedAt: null });
      mockPrisma.serviceBookingType.findMany.mockResolvedValue([mockBookingType]);

      const result = await service.getByService(serviceId);

      expect(result).toHaveLength(1);
      expect(mockServicesService.ensureExists).toHaveBeenCalledWith(serviceId);
      expect(mockPrisma.serviceBookingType.findMany).toHaveBeenCalledWith({
        where: { serviceId },
        include: { durationOptions: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should throw NotFoundException if service not found', async () => {
      mockServicesService.ensureExists.mockRejectedValue(
        new NotFoundException({ statusCode: 404, message: 'Service not found', error: 'NOT_FOUND' }),
      );
      await expect(service.getByService(serviceId)).rejects.toThrow(NotFoundException);
    });

    it('should return empty array when no booking types exist', async () => {
      mockServicesService.ensureExists.mockResolvedValue({ id: serviceId, deletedAt: null });
      mockPrisma.serviceBookingType.findMany.mockResolvedValue([]);

      const result = await service.getByService(serviceId);
      expect(result).toEqual([]);
    });
  });

  describe('setBookingTypes', () => {
    it('should delete old and create new booking types', async () => {
      mockServicesService.ensureExists.mockResolvedValue({ id: serviceId, deletedAt: null });
      mockTx.serviceBookingType.deleteMany.mockResolvedValue({ count: 1 });
      mockTx.serviceBookingType.create.mockResolvedValue(mockBookingType);
      mockTx.serviceBookingType.findMany.mockResolvedValue([mockBookingType]);

      const dto = {
        types: [
          { bookingType: BookingType.in_person, price: 20000, duration: 30 },
        ],
      };

      const result = await service.setBookingTypes(serviceId, dto);

      expect(mockTx.serviceBookingType.deleteMany).toHaveBeenCalledWith({ where: { serviceId } });
      expect(mockTx.serviceBookingType.create).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(mockServicesService.invalidateServicesCache).toHaveBeenCalled();
    });

    it('should set isActive to true by default when not provided', async () => {
      mockServicesService.ensureExists.mockResolvedValue({ id: serviceId, deletedAt: null });
      mockTx.serviceBookingType.deleteMany.mockResolvedValue({ count: 0 });
      mockTx.serviceBookingType.create.mockResolvedValue(mockBookingType);
      mockTx.serviceBookingType.findMany.mockResolvedValue([mockBookingType]);

      await service.setBookingTypes(serviceId, {
        types: [{ bookingType: BookingType.in_person, price: 20000, duration: 30 }],
      });

      const createCall = mockTx.serviceBookingType.create.mock.calls[0][0];
      expect(createCall.data.isActive).toBe(true);
      expect(mockServicesService.invalidateServicesCache).toHaveBeenCalled();
    });

    it('should create booking type without durationOptions when none provided', async () => {
      mockServicesService.ensureExists.mockResolvedValue({ id: serviceId, deletedAt: null });
      mockTx.serviceBookingType.deleteMany.mockResolvedValue({ count: 0 });
      mockTx.serviceBookingType.create.mockResolvedValue(mockBookingType);
      mockTx.serviceBookingType.findMany.mockResolvedValue([mockBookingType]);

      await service.setBookingTypes(serviceId, {
        types: [{ bookingType: BookingType.online, price: 15000, duration: 20 }],
      });

      const createCall = mockTx.serviceBookingType.create.mock.calls[0][0];
      expect(createCall.data.durationOptions).toBeUndefined();
      expect(mockServicesService.invalidateServicesCache).toHaveBeenCalled();
    });

    it('should create booking type with durationOptions when provided', async () => {
      mockServicesService.ensureExists.mockResolvedValue({ id: serviceId, deletedAt: null });
      mockTx.serviceBookingType.deleteMany.mockResolvedValue({ count: 0 });
      mockTx.serviceBookingType.create.mockResolvedValue(mockBookingType);
      mockTx.serviceBookingType.findMany.mockResolvedValue([mockBookingType]);

      await service.setBookingTypes(serviceId, {
        types: [
          {
            bookingType: 'in_person',
            price: 20000,
            duration: 30,
            durationOptions: [
              { label: '30 min', labelAr: '٣٠ دقيقة', durationMinutes: 30, price: 10000, serviceBookingTypeId: 'sbt-placeholder' },
            ],
          },
        ],
      });

      const createCall = mockTx.serviceBookingType.create.mock.calls[0][0];
      expect(createCall.data.durationOptions).toBeDefined();
      expect(createCall.data.durationOptions.createMany.data).toHaveLength(1);
      expect(mockServicesService.invalidateServicesCache).toHaveBeenCalled();
    });

    it('should throw NotFoundException if service not found', async () => {
      mockServicesService.ensureExists.mockRejectedValue(
        new NotFoundException({ statusCode: 404, message: 'Service not found', error: 'NOT_FOUND' }),
      );
      await expect(
        service.setBookingTypes(serviceId, { types: [] }),
      ).rejects.toThrow(NotFoundException);
    });

    // Regression #18 — active bookings must block setBookingTypes
    it('should throw ConflictException (409) when active bookings exist [regression #18]', async () => {
      mockServicesService.ensureExists.mockResolvedValue({ id: serviceId, deletedAt: null });
      mockPrisma.booking.count.mockResolvedValue(3);

      await expect(
        service.setBookingTypes(serviceId, {
          types: [{ bookingType: BookingType.in_person, price: 20000, duration: 30 }],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should include active booking count in ConflictException message [regression #18]', async () => {
      mockServicesService.ensureExists.mockResolvedValue({ id: serviceId, deletedAt: null });
      mockPrisma.booking.count.mockResolvedValue(5);

      try {
        await service.setBookingTypes(serviceId, { types: [] });
        fail('Expected ConflictException to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictException);
        const response = (err as ConflictException).getResponse() as Record<string, unknown>;
        expect(response['error']).toBe('ACTIVE_BOOKINGS_EXIST');
        expect(String(response['message'])).toContain('5');
      }
    });

    it('should NOT throw ConflictException when no active bookings exist [regression #18]', async () => {
      mockServicesService.ensureExists.mockResolvedValue({ id: serviceId, deletedAt: null });
      mockPrisma.booking.count.mockResolvedValue(0);
      mockTx.serviceBookingType.deleteMany.mockResolvedValue({ count: 1 });
      mockTx.serviceBookingType.create.mockResolvedValue(mockBookingType);
      mockTx.serviceBookingType.findMany.mockResolvedValue([mockBookingType]);

      await expect(
        service.setBookingTypes(serviceId, {
          types: [{ bookingType: BookingType.in_person, price: 20000, duration: 30 }],
        }),
      ).resolves.toBeDefined();
    });

    // Regression #8 — multiple isDefault on same booking type must throw
    it('should throw BadRequestException when multiple durationOptions marked isDefault [regression #8]', async () => {
      mockServicesService.ensureExists.mockResolvedValue({ id: serviceId, deletedAt: null });
      mockPrisma.booking.count.mockResolvedValue(0);

      await expect(
        service.setBookingTypes(serviceId, {
          types: [
            {
              bookingType: BookingType.in_person,
              price: 20000,
              duration: 30,
              durationOptions: [
                { label: '30 min', labelAr: '٣٠ دقيقة', durationMinutes: 30, price: 10000, isDefault: true, serviceBookingTypeId: 'sbt-1' },
                { label: '60 min', labelAr: '٦٠ دقيقة', durationMinutes: 60, price: 20000, isDefault: true, serviceBookingTypeId: 'sbt-1' },
              ],
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    // Regression #8 — auto-assign isDefault to first option when none provided
    it('should auto-assign isDefault to first durationOption when none marked [regression #8]', async () => {
      mockServicesService.ensureExists.mockResolvedValue({ id: serviceId, deletedAt: null });
      mockPrisma.booking.count.mockResolvedValue(0);
      mockTx.serviceBookingType.deleteMany.mockResolvedValue({ count: 0 });
      mockTx.serviceBookingType.create.mockResolvedValue(mockBookingType);
      mockTx.serviceBookingType.findMany.mockResolvedValue([mockBookingType]);

      await service.setBookingTypes(serviceId, {
        types: [
          {
            bookingType: BookingType.in_person,
            price: 20000,
            duration: 30,
            durationOptions: [
              { label: '30 min', labelAr: '٣٠ دقيقة', durationMinutes: 30, price: 10000, serviceBookingTypeId: 'sbt-1' },
              { label: '60 min', labelAr: '٦٠ دقيقة', durationMinutes: 60, price: 20000, serviceBookingTypeId: 'sbt-1' },
            ],
          },
        ],
      });

      const createCall = mockTx.serviceBookingType.create.mock.calls[0][0];
      const options = createCall.data.durationOptions.createMany.data;
      expect(options[0].isDefault).toBe(true);
      expect(options[1].isDefault).toBe(false);
    });

    // Regression #20 — Promise.all: all creates are invoked (not sequential)
    it('should create all booking types concurrently via Promise.all [regression #20]', async () => {
      mockServicesService.ensureExists.mockResolvedValue({ id: serviceId, deletedAt: null });
      mockPrisma.booking.count.mockResolvedValue(0);
      mockTx.serviceBookingType.deleteMany.mockResolvedValue({ count: 0 });
      mockTx.serviceBookingType.create.mockResolvedValue(mockBookingType);
      mockTx.serviceBookingType.findMany.mockResolvedValue([mockBookingType, mockBookingType, mockBookingType]);

      await service.setBookingTypes(serviceId, {
        types: [
          { bookingType: BookingType.in_person, price: 20000, duration: 30 },
          { bookingType: BookingType.online, price: 15000, duration: 20 },
          { bookingType: BookingType.home_visit, price: 25000, duration: 45 },
        ],
      });

      // All 3 types created
      expect(mockTx.serviceBookingType.create).toHaveBeenCalledTimes(3);
    });
  });
});
