/**
 * DurationOptionsService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DurationOptionsService } from '../../../src/modules/services/duration-options.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

const serviceId = 'service-uuid-1';

const mockService = { id: serviceId, deletedAt: null };

const mockOptions = [
  { id: 'opt-1', serviceId, label: '30 min', labelAr: '٣٠ دقيقة', durationMinutes: 30, price: 10000, isDefault: true, sortOrder: 0 },
  { id: 'opt-2', serviceId, label: '60 min', labelAr: '٦٠ دقيقة', durationMinutes: 60, price: 18000, isDefault: false, sortOrder: 1 },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTx: any = {
  serviceDurationOption: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    createMany: jest.fn().mockResolvedValue({ count: 2 }),
    findMany: jest.fn().mockResolvedValue(mockOptions),
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  service: { findFirst: jest.fn() },
  serviceDurationOption: { findMany: jest.fn() },
  $transaction: jest.fn((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
};

describe('DurationOptionsService', () => {
  let service: DurationOptionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DurationOptionsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DurationOptionsService>(DurationOptionsService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
    );
  });

  describe('getDurationOptions', () => {
    it('should return options ordered by sortOrder asc', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(mockService);
      mockPrisma.serviceDurationOption.findMany.mockResolvedValue(mockOptions);

      const result = await service.getDurationOptions(serviceId);

      expect(result).toHaveLength(2);
      expect(mockPrisma.serviceDurationOption.findMany).toHaveBeenCalledWith({
        where: { serviceId },
        orderBy: { sortOrder: 'asc' },
      });
    });

    it('should throw NotFoundException if service not found', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(null);
      await expect(service.getDurationOptions(serviceId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('setDurationOptions', () => {
    it('should delete existing and create new options', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(mockService);
      mockTx.serviceDurationOption.deleteMany.mockResolvedValue({ count: 1 });
      mockTx.serviceDurationOption.createMany.mockResolvedValue({ count: 2 });
      mockTx.serviceDurationOption.findMany.mockResolvedValue(mockOptions);

      const dto = {
        options: [
          { label: '30 min', labelAr: '٣٠ دقيقة', durationMinutes: 30, price: 10000, isDefault: true },
          { label: '60 min', labelAr: '٦٠ دقيقة', durationMinutes: 60, price: 18000, isDefault: false },
        ],
      };

      const result = await service.setDurationOptions(serviceId, dto);

      expect(mockTx.serviceDurationOption.deleteMany).toHaveBeenCalledWith({ where: { serviceId } });
      expect(mockTx.serviceDurationOption.createMany).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('should return empty array when options list is empty', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(mockService);
      mockTx.serviceDurationOption.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.setDurationOptions(serviceId, { options: [] });

      expect(result).toEqual([]);
      expect(mockTx.serviceDurationOption.createMany).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if service not found', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(null);
      await expect(
        service.setDurationOptions(serviceId, { options: [] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use index as sortOrder when not provided', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(mockService);
      mockTx.serviceDurationOption.deleteMany.mockResolvedValue({ count: 0 });
      mockTx.serviceDurationOption.createMany.mockResolvedValue({ count: 1 });
      mockTx.serviceDurationOption.findMany.mockResolvedValue([mockOptions[0]]);

      await service.setDurationOptions(serviceId, {
        options: [{ label: '30 min', labelAr: '٣٠ دقيقة', durationMinutes: 30, price: 10000 }],
      });

      const createCall = mockTx.serviceDurationOption.createMany.mock.calls[0][0];
      expect(createCall.data[0].sortOrder).toBe(0);
      expect(createCall.data[0].isDefault).toBe(false);
    });
  });
});
