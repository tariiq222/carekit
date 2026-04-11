jest.mock('../../../src/database/prisma.service.js', () => ({
  PrismaService: class PrismaService {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { DashboardStatsService } from '../../../src/modules/reports/dashboard-stats.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { CacheService } from '../../../src/common/services/cache.service.js';

const BRANCH_ID = 'branch-uuid-1';

const mockPrisma: any = {
  booking: { count: jest.fn() },
  payment: { aggregate: jest.fn() },
  practitioner: { count: jest.fn() },
  practitionerBranch: { count: jest.fn() },
  user: { count: jest.fn() },
};

const mockCacheService: any = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

describe('DashboardStatsService', () => {
  let service: DashboardStatsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardStatsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<DashboardStatsService>(DashboardStatsService);
    jest.clearAllMocks();

    mockCacheService.get.mockResolvedValue(null);
    mockCacheService.set.mockResolvedValue(undefined);
    mockPrisma.booking.count.mockResolvedValue(4);
    mockPrisma.payment.aggregate.mockResolvedValue({
      _sum: { totalAmount: 150000 },
    });
    mockPrisma.practitioner.count.mockResolvedValue(2);
    mockPrisma.practitionerBranch.count.mockResolvedValue(1);
    mockPrisma.user.count.mockResolvedValue(3);
  });

  it('should build branch-scoped stats from booking.branchId when branchId is provided', async () => {
    const result = await service.getStats(BRANCH_ID);

    expect(result.todayBookings).toBe(4);
    expect(mockPrisma.booking.count).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: BRANCH_ID,
          status: { notIn: [BookingStatus.cancelled, BookingStatus.expired] },
        }),
      }),
    );
    expect(mockPrisma.payment.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: PaymentStatus.paid,
          booking: { branchId: BRANCH_ID, deletedAt: null },
        }),
      }),
    );
    expect(mockPrisma.practitionerBranch.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          branchId: BRANCH_ID,
          practitioner: { isActive: true, deletedAt: null },
        },
      }),
    );
  });

  it('should keep global stats path unchanged when no branchId is provided', async () => {
    await service.getStats();

    expect(mockPrisma.practitioner.count).toHaveBeenCalledWith({
      where: { isActive: true, deletedAt: null },
    });
    expect(mockPrisma.practitionerBranch.count).not.toHaveBeenCalled();
  });
});
