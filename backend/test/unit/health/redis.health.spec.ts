import { Test, TestingModule } from '@nestjs/testing';
import { HealthIndicatorService } from '@nestjs/terminus';
import { RedisHealthIndicator } from '../../../src/modules/health/redis.health.js';
import { REDIS_CLIENT } from '../../../src/common/redis/redis.constants.js';

const mockSession = {
  up: jest.fn().mockReturnValue({ redis: { status: 'up' } }),
  down: jest.fn().mockReturnValue({ redis: { status: 'down' } }),
};

const mockRedis: any = {
  ping: jest.fn(),
};

const mockIndicator = {
  check: jest.fn().mockReturnValue(mockSession),
};

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisHealthIndicator,
        { provide: HealthIndicatorService, useValue: mockIndicator },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    indicator = module.get<RedisHealthIndicator>(RedisHealthIndicator);
    jest.clearAllMocks();
    mockIndicator.check.mockReturnValue(mockSession);
  });

  describe('check', () => {
    it('returns up when redis responds with PONG', async () => {
      mockRedis.ping.mockResolvedValue('PONG');

      await indicator.check();

      expect(mockSession.up).toHaveBeenCalled();
      expect(mockSession.down).not.toHaveBeenCalled();
    });

    it('returns down when redis responds with unexpected value', async () => {
      mockRedis.ping.mockResolvedValue('OK');

      await indicator.check();

      expect(mockSession.down).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('OK') }),
      );
    });

    it('returns down when redis ping throws an Error', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection refused'));

      await indicator.check();

      expect(mockSession.down).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Connection refused' }),
      );
    });

    it('returns down with "Unknown error" when thrown value is not an Error', async () => {
      mockRedis.ping.mockRejectedValue('timeout');

      await indicator.check();

      expect(mockSession.down).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Unknown error' }),
      );
    });
  });
});
