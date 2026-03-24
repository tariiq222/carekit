/**
 * CareKit — CleanupService Unit Tests
 *
 * Tests the CleanupService in isolation:
 *   - cleanExpiredOtps — calls deleteMany with correct where (expired OR used)
 *   - cleanExpiredOtps — logs count when > 0
 *   - cleanExpiredOtps — no log when count = 0
 *   - cleanExpiredRefreshTokens — calls deleteMany with correct where (expired)
 *   - cleanExpiredRefreshTokens — logs count when > 0
 *   - cleanExpiredRefreshTokens — no log when count = 0
 *
 * PrismaService is mocked so tests run without a database.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { CleanupService } from '../cleanup.service.js';
import { PrismaService } from '../../../database/prisma.service.js';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrismaService: any = {
  otpCode: {
    deleteMany: jest.fn(),
  },
  refreshToken: {
    deleteMany: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('CleanupService', () => {
  let service: CleanupService;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanupService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CleanupService>(CleanupService);

    // Spy on Logger.prototype.log to verify logging behavior
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    jest.clearAllMocks();
  });

  afterEach(() => {
    logSpy.mockRestore();
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

      expect(logSpy).toHaveBeenCalledWith(
        'Cleaned 5 expired/used OTP codes',
      );
    });

    it('should not log when no OTPs were deleted', async () => {
      mockPrismaService.otpCode.deleteMany.mockResolvedValue({ count: 0 });

      await service.cleanExpiredOtps();

      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should handle large batch deletions', async () => {
      mockPrismaService.otpCode.deleteMany.mockResolvedValue({ count: 1000 });

      await service.cleanExpiredOtps();

      expect(logSpy).toHaveBeenCalledWith(
        'Cleaned 1000 expired/used OTP codes',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // cleanExpiredRefreshTokens
  // ─────────────────────────────────────────────────────────────

  describe('cleanExpiredRefreshTokens', () => {
    it('should call deleteMany with correct where clause (expired)', async () => {
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({
        count: 0,
      });

      await service.cleanExpiredRefreshTokens();

      expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
    });

    it('should log count when deleted refresh tokens > 0', async () => {
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({
        count: 3,
      });

      await service.cleanExpiredRefreshTokens();

      expect(logSpy).toHaveBeenCalledWith(
        'Cleaned 3 expired refresh tokens',
      );
    });

    it('should not log when no refresh tokens were deleted', async () => {
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({
        count: 0,
      });

      await service.cleanExpiredRefreshTokens();

      expect(logSpy).not.toHaveBeenCalled();
    });
  });
});
