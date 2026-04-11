/**
 * RevenueQueriesService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { RevenueQueriesService } from '../../../src/modules/reports/revenue-queries.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

const from = new Date('2026-01-01');
const to = new Date('2026-03-31');

const mockPrisma: any = {
  $queryRaw: jest.fn(),
  booking: {
    count: jest.fn().mockResolvedValue(0),
  },
  payment: {
    aggregate: jest
      .fn()
      .mockResolvedValue({ _sum: { totalAmount: 0 }, _count: 0 }),
  },
};

describe('RevenueQueriesService', () => {
  let service: RevenueQueriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RevenueQueriesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RevenueQueriesService>(RevenueQueriesService);
    jest.clearAllMocks();
    mockPrisma.booking.count.mockResolvedValue(0);
    mockPrisma.payment.aggregate.mockResolvedValue({
      _sum: { totalAmount: 0 },
      _count: 0,
    });
  });

  describe('getByMonth', () => {
    it('should return empty array when no data', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await service.getByMonth(from, to);

      expect(result).toEqual([]);
    });

    it('should map raw rows to RevenueByMonth format', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          month: new Date('2026-01-01'),
          bookings: 10,
          revenue: BigInt(100000),
        },
      ]);

      const result = await service.getByMonth(from, to);

      expect(result[0].month).toBe('2026-01');
      expect(result[0].bookings).toBe(10);
      expect(result[0].revenue).toBe(100000);
    });
  });

  describe('getByPractitioner', () => {
    it('should return empty array when no data', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await service.getByPractitioner(from, to);

      expect(result).toEqual([]);
    });

    it('should map raw rows to RevenueByPractitioner format', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          practitioner_id: 'pract-1',
          first_name: 'Ahmad',
          last_name: 'Al-Rashid',
          bookings: 5,
          revenue: BigInt(50000),
        },
      ]);

      const result = await service.getByPractitioner(from, to);

      expect(result[0].practitionerId).toBe('pract-1');
      expect(result[0].name).toBe('Ahmad Al-Rashid');
      expect(result[0].revenue).toBe(50000);
    });
  });

  describe('getByService', () => {
    it('should return empty array when no data', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await service.getByService(from, to);

      expect(result).toEqual([]);
    });

    it('should prefer Arabic service name over English', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          service_id: 'svc-1',
          name_ar: 'استشارة',
          name_en: 'Consultation',
          bookings: 3,
          revenue: BigInt(30000),
        },
      ]);

      const result = await service.getByService(from, to);

      expect(result[0].name).toBe('استشارة');
    });

    it('should fall back to English name when Arabic is empty', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          service_id: 'svc-2',
          name_ar: '',
          name_en: 'Consultation',
          bookings: 3,
          revenue: BigInt(30000),
        },
      ]);

      const result = await service.getByService(from, to);

      expect(result[0].name).toBe('Consultation');
    });
  });

  describe('getTotals', () => {
    it('should return zeros when no bookings', async () => {
      mockPrisma.booking.count.mockResolvedValue(0);
      mockPrisma.payment.aggregate.mockResolvedValue({
        _sum: { totalAmount: null },
        _count: 0,
      });

      const result = await service.getTotals(from, to);

      expect(result.totalRevenue).toBe(0);
      expect(result.totalBookings).toBe(0);
      expect(result.paidBookings).toBe(0);
      expect(result.averagePerBooking).toBe(0);
    });

    it('should calculate averagePerBooking correctly', async () => {
      mockPrisma.booking.count.mockResolvedValue(10);
      mockPrisma.payment.aggregate.mockResolvedValue({
        _sum: { totalAmount: 100000 },
        _count: 5,
      });

      const result = await service.getTotals(from, to);

      expect(result.totalRevenue).toBe(100000);
      expect(result.totalBookings).toBe(10);
      expect(result.paidBookings).toBe(5);
      expect(result.averagePerBooking).toBe(20000); // 100000 / 5
    });
  });
});
