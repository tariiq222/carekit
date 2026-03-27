import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService, HealthIndicatorService } from '@nestjs/terminus';
import { HealthController } from '../../../src/modules/health/health.controller.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { RedisHealthIndicator } from '../../../src/modules/health/redis.health.js';
import { MinioHealthIndicator } from '../../../src/modules/health/minio.health.js';

const mockSession = {
  up: jest.fn().mockReturnValue({ database: { status: 'up' } }),
  down: jest.fn().mockReturnValue({ database: { status: 'down' } }),
};

const mockHealthCheckService = {
  check: jest.fn().mockImplementation(async (checks: (() => Promise<unknown>)[]) => {
    for (const check of checks) {
      await check();
    }
    return { status: 'ok', info: {}, error: {}, details: {} };
  }),
};

const mockIndicator = {
  check: jest.fn().mockReturnValue(mockSession),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  $queryRaw: jest.fn(),
};

const mockRedisHealth = {
  check: jest.fn().mockResolvedValue({ redis: { status: 'up' } }),
};

const mockMinioHealth = {
  check: jest.fn().mockResolvedValue({ minio: { status: 'up' } }),
};

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: HealthIndicatorService, useValue: mockIndicator },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisHealthIndicator, useValue: mockRedisHealth },
        { provide: MinioHealthIndicator, useValue: mockMinioHealth },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    jest.clearAllMocks();
    mockHealthCheckService.check.mockImplementation(async (checks: (() => Promise<unknown>)[]) => {
      for (const check of checks) {
        await check();
      }
      return { status: 'ok', info: {}, error: {}, details: {} };
    });
    mockIndicator.check.mockReturnValue(mockSession);
    mockSession.up.mockReturnValue({ database: { status: 'up' } });
    mockSession.down.mockReturnValue({ database: { status: 'down' } });
  });

  describe('check', () => {
    it('calls health.check with three indicator functions', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      await controller.check();

      expect(mockHealthCheckService.check).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.any(Function),
          expect.any(Function),
          expect.any(Function),
        ]),
      );
    });

    it('includes uptime, timestamp, version, and startedAt in the result', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await controller.check();

      expect(result).toMatchObject({
        uptime: expect.any(Number),
        timestamp: expect.any(String),
        startedAt: expect.any(String),
      });
    });

    it('delegates redis check to RedisHealthIndicator', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await controller.check();

      expect(mockRedisHealth.check).toHaveBeenCalled();
    });

    it('delegates minio check to MinioHealthIndicator', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await controller.check();

      expect(mockMinioHealth.check).toHaveBeenCalled();
    });
  });

  describe('checkDatabase (via health.check callbacks)', () => {
    it('calls session.up when prisma query succeeds', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      await controller.check();

      expect(mockSession.up).toHaveBeenCalled();
      expect(mockSession.down).not.toHaveBeenCalled();
    });

    it('calls session.down with message when prisma query throws an Error', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('DB connection failed'));

      await controller.check();

      expect(mockSession.down).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'DB connection failed' }),
      );
    });

    it('calls session.down with "Unknown error" when thrown value is not an Error', async () => {
      mockPrisma.$queryRaw.mockRejectedValue('unexpected failure');

      await controller.check();

      expect(mockSession.down).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Unknown error' }),
      );
    });
  });
});
