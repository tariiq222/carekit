/**
 * CareKit — CleanupService Unit Tests
 *
 * Tests the CleanupService in isolation:
 *   - cleanExpiredOtps
 *   - cleanExpiredRefreshTokens
 *   - cleanOldProcessedWebhooks
 *   - archiveOldActivityLogs
 *   - repairPractitionerRatingCache
 *   - logTableGrowthSnapshot
 *
 * PrismaService and MetricsService are mocked so tests run without a database.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { CleanupService } from '../cleanup.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { MetricsService } from '../../../common/metrics/metrics.service.js';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrismaService: any = {
  otpCode: { deleteMany: jest.fn(), count: jest.fn() },
  refreshToken: { deleteMany: jest.fn() },
  processedWebhook: { deleteMany: jest.fn() },
  practitioner: { findMany: jest.fn(), update: jest.fn() },
  rating: { aggregate: jest.fn() },
  booking: { count: jest.fn() },
  payment: { count: jest.fn() },
  activityLog: { count: jest.fn() },
  notification: { count: jest.fn() },
  chatMessage: { count: jest.fn() },
  $executeRaw: jest.fn(),
};

const mockDbTableRowsGauge = { set: jest.fn() };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockMetricsService: any = {
  dbTableRows: mockDbTableRowsGauge,
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('CleanupService', () => {
  let service: CleanupService;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanupService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: MetricsService, useValue: mockMetricsService },
      ],
    }).compile();

    service = module.get<CleanupService>(CleanupService);

    logSpy  = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    jest.clearAllMocks();
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  // ─────────────────────────────────────────────────────────────
  // cleanExpiredOtps
  // ─────────────────────────────────────────────────────────────

  describe('cleanExpiredOtps', () => {
    it('should call deleteMany with correct where clause (expired OR used)', async () => {
      mockPrismaService.otpCode.deleteMany.mockResolvedValue({ count: 0 });

      await service.cleanExpiredOtps();

      expect(mockPrismaService.otpCode.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { expiresAt: { lt: expect.any(Date) } },
            { usedAt: { not: null } },
          ],
        },
      });
    });

    it('should log count when deleted OTPs > 0', async () => {
      mockPrismaService.otpCode.deleteMany.mockResolvedValue({ count: 5 });
      await service.cleanExpiredOtps();
      expect(logSpy).toHaveBeenCalledWith('Cleaned 5 expired/used OTP codes');
    });

    it('should not log when no OTPs were deleted', async () => {
      mockPrismaService.otpCode.deleteMany.mockResolvedValue({ count: 0 });
      await service.cleanExpiredOtps();
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // cleanExpiredRefreshTokens
  // ─────────────────────────────────────────────────────────────

  describe('cleanExpiredRefreshTokens', () => {
    it('should call deleteMany with correct where clause (expired)', async () => {
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

      await service.cleanExpiredRefreshTokens();

      expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
    });

    it('should log count when deleted refresh tokens > 0', async () => {
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 3 });
      await service.cleanExpiredRefreshTokens();
      expect(logSpy).toHaveBeenCalledWith('Cleaned 3 expired refresh tokens');
    });

    it('should not log when no refresh tokens were deleted', async () => {
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
      await service.cleanExpiredRefreshTokens();
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // cleanOldProcessedWebhooks
  // ─────────────────────────────────────────────────────────────

  describe('cleanOldProcessedWebhooks', () => {
    it('should delete webhooks older than 30 days', async () => {
      mockPrismaService.processedWebhook.deleteMany.mockResolvedValue({ count: 10 });

      await service.cleanOldProcessedWebhooks();

      expect(mockPrismaService.processedWebhook.deleteMany).toHaveBeenCalledWith({
        where: { processedAt: { lt: expect.any(Date) } },
      });
    });

    it('should log count when webhooks were deleted', async () => {
      mockPrismaService.processedWebhook.deleteMany.mockResolvedValue({ count: 7 });
      await service.cleanOldProcessedWebhooks();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cleaned 7 processed webhooks'),
      );
    });

    it('should not log when no webhooks were deleted', async () => {
      mockPrismaService.processedWebhook.deleteMany.mockResolvedValue({ count: 0 });
      await service.cleanOldProcessedWebhooks();
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // archiveOldActivityLogs
  // ─────────────────────────────────────────────────────────────

  describe('archiveOldActivityLogs', () => {
    it('should execute raw SQL archive query', async () => {
      mockPrismaService.$executeRaw.mockResolvedValue(5);

      await service.archiveOldActivityLogs();

      expect(mockPrismaService.$executeRaw).toHaveBeenCalled();
    });

    it('should log when rows were archived', async () => {
      mockPrismaService.$executeRaw.mockResolvedValue(20);
      await service.archiveOldActivityLogs();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Archived 20 activity logs'),
      );
    });

    it('should not log when no rows were archived', async () => {
      mockPrismaService.$executeRaw.mockResolvedValue(0);
      await service.archiveOldActivityLogs();
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should warn gracefully when archive table does not exist', async () => {
      const err = new Error('relation "activity_logs_archive" does not exist');
      mockPrismaService.$executeRaw.mockRejectedValue(err);

      await expect(service.archiveOldActivityLogs()).resolves.not.toThrow();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('activity_logs_archive table not found'),
      );
    });

    it('should rethrow unexpected errors', async () => {
      const err = new Error('connection timeout');
      mockPrismaService.$executeRaw.mockRejectedValue(err);

      await expect(service.archiveOldActivityLogs()).rejects.toThrow('connection timeout');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // repairPractitionerRatingCache
  // ─────────────────────────────────────────────────────────────

  describe('repairPractitionerRatingCache', () => {
    it('should repair drifted practitioners and warn', async () => {
      mockPrismaService.practitioner.findMany.mockResolvedValue([
        { id: 'p1', rating: 4.0, reviewCount: 10 },
      ]);
      mockPrismaService.rating.aggregate.mockResolvedValue({
        _avg: { stars: 4.5 },
        _count: { id: 12 },
      });
      mockPrismaService.practitioner.update.mockResolvedValue({});

      await service.repairPractitionerRatingCache();

      expect(mockPrismaService.practitioner.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { rating: 4.5, reviewCount: 12 },
      });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rating cache repaired for 1 practitioners'),
      );
    });

    it('should not update practitioners with accurate cache', async () => {
      mockPrismaService.practitioner.findMany.mockResolvedValue([
        { id: 'p1', rating: 4.5, reviewCount: 10 },
      ]);
      mockPrismaService.rating.aggregate.mockResolvedValue({
        _avg: { stars: 4.5 },
        _count: { id: 10 },
      });

      await service.repairPractitionerRatingCache();

      expect(mockPrismaService.practitioner.update).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should handle practitioners with no ratings (avg null)', async () => {
      mockPrismaService.practitioner.findMany.mockResolvedValue([
        { id: 'p1', rating: 0, reviewCount: 0 },
      ]);
      mockPrismaService.rating.aggregate.mockResolvedValue({
        _avg: { stars: null },
        _count: { id: 0 },
      });

      await service.repairPractitionerRatingCache();

      expect(mockPrismaService.practitioner.update).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // logTableGrowthSnapshot
  // ─────────────────────────────────────────────────────────────

  describe('logTableGrowthSnapshot', () => {
    beforeEach(() => {
      mockPrismaService.booking.count.mockResolvedValue(100);
      mockPrismaService.payment.count.mockResolvedValue(200);
      mockPrismaService.activityLog.count.mockResolvedValue(5000);
      mockPrismaService.notification.count.mockResolvedValue(300);
      mockPrismaService.chatMessage.count.mockResolvedValue(400);
      mockPrismaService.otpCode.count.mockResolvedValue(50);
    });

    it('should log structured JSON snapshot', async () => {
      await service.logTableGrowthSnapshot();

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('"event":"table_growth_snapshot"'),
      );
    });

    it('should update Prometheus Gauge for each table', async () => {
      await service.logTableGrowthSnapshot();

      expect(mockDbTableRowsGauge.set).toHaveBeenCalledWith({ table: 'bookings' }, 100);
      expect(mockDbTableRowsGauge.set).toHaveBeenCalledWith({ table: 'payments' }, 200);
      expect(mockDbTableRowsGauge.set).toHaveBeenCalledWith({ table: 'activity_logs' }, 5000);
      expect(mockDbTableRowsGauge.set).toHaveBeenCalledWith({ table: 'notifications' }, 300);
      expect(mockDbTableRowsGauge.set).toHaveBeenCalledWith({ table: 'chat_messages' }, 400);
      expect(mockDbTableRowsGauge.set).toHaveBeenCalledWith({ table: 'otp_codes' }, 50);
    });
  });
});
