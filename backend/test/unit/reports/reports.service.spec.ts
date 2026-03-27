/**
 * CareKit — ReportsService Unit Tests
 *
 * Tests: getRevenueReport, getBookingReport, getPractitionerReport
 * PrismaService and RevenueQueriesService are mocked.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from '../../../src/modules/reports/reports.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { RevenueQueriesService } from '../../../src/modules/reports/revenue-queries.service.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  booking: { count: jest.fn() },
  practitioner: { findFirst: jest.fn() },
  payment: { aggregate: jest.fn() },
  rating: { findMany: jest.fn() },
  $queryRaw: jest.fn(),
};

const mockRevenueQueries = {
  getByMonth: jest.fn(),
  getByPractitioner: jest.fn(),
  getByService: jest.fn(),
  getTotals: jest.fn(),
};

const DATE_FROM = '2026-01-01';
const DATE_TO = '2026-06-30';
const PRAC_ID = 'practitioner-uuid-1';
const BRANCH_ID = 'branch-uuid-1';

const mockTotals = { totalRevenue: 450000, totalBookings: 30, paidBookings: 25, averagePerBooking: 18000 };
const mockByMonth = [{ month: '2026-01', bookings: 10, revenue: 150000 }];
const mockByPractitioner = [{ practitionerId: PRAC_ID, name: 'Dr. Khalid', bookings: 15, revenue: 225000 }];
const mockByService = [{ serviceId: 'svc-1', name: 'Consultation', bookings: 20, revenue: 300000 }];

const mockPractitionerRecord = {
  id: PRAC_ID, rating: 4.5, reviewCount: 12, deletedAt: null,
  user: { firstName: 'Khalid', lastName: 'Al-Fahd' },
  specialty: 'Cardiology',
  specialtyAr: 'أمراض القلب',
};

const mockRatings = [
  { id: 'r1', stars: 5, comment: 'Excellent', createdAt: new Date('2026-03-15'), patient: { firstName: 'Ahmed', lastName: 'Al-Rashid' } },
  { id: 'r2', stars: 4, comment: null, createdAt: new Date('2026-03-10'), patient: null },
];

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RevenueQueriesService, useValue: mockRevenueQueries },
      ],
    }).compile();
    service = module.get<ReportsService>(ReportsService);
    jest.clearAllMocks();
  });

  // ── getRevenueReport ─────────────────────────────────────────

  describe('getRevenueReport', () => {
    beforeEach(() => {
      mockRevenueQueries.getTotals.mockResolvedValue(mockTotals);
      mockRevenueQueries.getByMonth.mockResolvedValue(mockByMonth);
      mockRevenueQueries.getByPractitioner.mockResolvedValue(mockByPractitioner);
      mockRevenueQueries.getByService.mockResolvedValue(mockByService);
    });

    it('should return combined revenue report with totals and breakdowns', async () => {
      const r = await service.getRevenueReport(DATE_FROM, DATE_TO);
      expect(r.totalRevenue).toBe(450000);
      expect(r.totalBookings).toBe(30);
      expect(r.paidBookings).toBe(25);
      expect(r.averagePerBooking).toBe(18000);
      expect(r.byMonth).toEqual(mockByMonth);
      expect(r.byPractitioner).toEqual(mockByPractitioner);
      expect(r.byService).toEqual(mockByService);
    });

    it('should delegate to revenueQueriesService with parsed dates', async () => {
      await service.getRevenueReport(DATE_FROM, DATE_TO);
      const from = new Date(DATE_FROM);
      const to = new Date(DATE_TO);
      to.setHours(23, 59, 59, 999);
      expect(mockRevenueQueries.getByMonth).toHaveBeenCalledWith(from, to, undefined, undefined);
      expect(mockRevenueQueries.getTotals).toHaveBeenCalledWith(from, to, undefined, undefined);
    });

    it('should pass practitionerId filter when provided', async () => {
      await service.getRevenueReport(DATE_FROM, DATE_TO, PRAC_ID, BRANCH_ID);
      expect(mockRevenueQueries.getByMonth).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), PRAC_ID, BRANCH_ID);
      expect(mockRevenueQueries.getByPractitioner).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), PRAC_ID, BRANCH_ID);
      expect(mockRevenueQueries.getByService).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), PRAC_ID, BRANCH_ID);
      expect(mockRevenueQueries.getTotals).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), PRAC_ID, BRANCH_ID);
    });

    it('should call all four revenue queries exactly once', async () => {
      await service.getRevenueReport(DATE_FROM, DATE_TO);
      expect(mockRevenueQueries.getByMonth).toHaveBeenCalledTimes(1);
      expect(mockRevenueQueries.getByPractitioner).toHaveBeenCalledTimes(1);
      expect(mockRevenueQueries.getByService).toHaveBeenCalledTimes(1);
      expect(mockRevenueQueries.getTotals).toHaveBeenCalledTimes(1);
    });
  });

  // ── getBookingReport ─────────────────────────────────────────

  describe('getBookingReport', () => {
    beforeEach(() => { mockPrisma.booking.count.mockResolvedValue(50); });

    it('should return total from prisma count', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ status: 'confirmed', count: BigInt(20) }])
        .mockResolvedValueOnce([{ type: 'clinic_visit', count: BigInt(30) }])
        .mockResolvedValueOnce([{ date: new Date('2026-03-01'), count: BigInt(5) }]);
      const r = await service.getBookingReport(DATE_FROM, DATE_TO);
      expect(r.total).toBe(50);
    });

    it('should map status rows with defaults for missing statuses', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          { status: 'confirmed', count: BigInt(20) },
          { status: 'completed', count: BigInt(15) },
          { status: 'cancelled', count: BigInt(5) },
        ])
        .mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      const r = await service.getBookingReport(DATE_FROM, DATE_TO);
      expect(r.byStatus).toEqual({ pending: 0, confirmed: 20, completed: 15, cancelled: 5, pending_cancellation: 0 });
    });

    it('should map type rows with defaults for missing types', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { type: 'clinic_visit', count: BigInt(25) },
          { type: 'video_consultation', count: BigInt(10) },
        ])
        .mockResolvedValueOnce([]);
      const r = await service.getBookingReport(DATE_FROM, DATE_TO);
      expect(r.byType).toEqual({ clinic_visit: 25, phone_consultation: 0, video_consultation: 10 });
    });

    it('should format byDay date strings from raw query', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([]).mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { date: new Date('2026-03-01'), count: BigInt(5) },
          { date: new Date('2026-03-02'), count: BigInt(8) },
        ]);
      const r = await service.getBookingReport(DATE_FROM, DATE_TO);
      expect(r.byDay).toEqual([{ date: '2026-03-01', count: 5 }, { date: '2026-03-02', count: 8 }]);
    });

    it('should handle empty results gracefully', async () => {
      mockPrisma.booking.count.mockResolvedValue(0);
      mockPrisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      const r = await service.getBookingReport(DATE_FROM, DATE_TO);
      expect(r.total).toBe(0);
      expect(r.byDay).toEqual([]);
      expect(r.byStatus.pending).toBe(0);
    });

    it('should apply branchId filter to booking totals when provided', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await service.getBookingReport(DATE_FROM, DATE_TO, BRANCH_ID);

      expect(mockPrisma.booking.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ branchId: BRANCH_ID }),
      });
    });
  });

  // ── getPractitionerReport ────────────────────────────────────

  describe('getPractitionerReport', () => {
    beforeEach(() => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitionerRecord);
      mockPrisma.booking.count.mockResolvedValueOnce(20).mockResolvedValueOnce(15);
      mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { totalAmount: 300000 } });
      mockPrisma.rating.findMany.mockResolvedValue(mockRatings);
    });

    it('should return practitioner info with stats and revenue', async () => {
      const r = await service.getPractitionerReport(PRAC_ID, DATE_FROM, DATE_TO);
      expect(r.id).toBe(PRAC_ID);
      expect(r.name).toBe('Khalid Al-Fahd');
      expect(r.specialty).toBe('أمراض القلب');
      expect(r.rating).toBe(4.5);
      expect(r.totalBookings).toBe(20);
      expect(r.completedBookings).toBe(15);
      expect(r.totalRevenue).toBe(300000);
    });

    it('should return empty report when practitioner not found', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(null);
      const r = await service.getPractitionerReport('nonexistent', DATE_FROM, DATE_TO);
      expect(r.name).toBe('Unknown');
      expect(r.totalBookings).toBe(0);
      expect(r.totalRevenue).toBe(0);
      expect(r.ratings).toEqual([]);
    });

    it('should include ratings with patient names', async () => {
      const r = await service.getPractitionerReport(PRAC_ID, DATE_FROM, DATE_TO);
      expect(r.ratings).toHaveLength(2);
      expect(r.ratings[0]).toEqual(
        expect.objectContaining({ id: 'r1', stars: 5, patientName: 'Ahmed Al-Rashid' }),
      );
    });

    it('should use fallback name for null patient', async () => {
      const r = await service.getPractitionerReport(PRAC_ID, DATE_FROM, DATE_TO);
      expect(r.ratings[1].patientName).toBe('مريض');
    });

    it('should default totalRevenue to 0 when no payments', async () => {
      mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { totalAmount: null } });
      const r = await service.getPractitionerReport(PRAC_ID, DATE_FROM, DATE_TO);
      expect(r.totalRevenue).toBe(0);
    });
  });
});
