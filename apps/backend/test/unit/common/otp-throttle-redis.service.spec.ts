/**
 * OtpThrottleRedisService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { OtpThrottleRedisService } from '../../../src/common/services/otp-throttle-redis.service.js';
import { REDIS_CLIENT } from '../../../src/common/redis/redis.constants.js';

const mockRedis: any = {
  pttl: jest.fn(),
  call: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn().mockResolvedValue(1),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
};

const email = 'TEST@example.com';
const routeKey = 'otp:verify';
const limit = 5;
const ttlMs = 60000;

describe('OtpThrottleRedisService', () => {
  let service: OtpThrottleRedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpThrottleRedisService,
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<OtpThrottleRedisService>(OtpThrottleRedisService);
    jest.clearAllMocks();
    mockRedis.expire.mockResolvedValue(1);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
  });

  describe('check', () => {
    it('should return allowed=false when lockout is active', async () => {
      mockRedis.pttl.mockResolvedValue(60000); // locked for 60s

      const result = await service.check(email, routeKey, limit, ttlMs);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.lockedUntilMs).toBeDefined();
      expect(mockRedis.call).not.toHaveBeenCalled();
    });

    it('should return allowed=true when count is within limit', async () => {
      mockRedis.pttl.mockResolvedValue(-1); // no lockout
      mockRedis.call.mockResolvedValue(1); // first request

      const result = await service.check(email, routeKey, limit, ttlMs);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(limit - 1);
    });

    it('should normalize email to lowercase for key generation', async () => {
      mockRedis.pttl.mockResolvedValue(-1);
      mockRedis.call.mockResolvedValue(1);

      await service.check('UPPER@EXAMPLE.COM', routeKey, limit, ttlMs);

      expect(mockRedis.pttl).toHaveBeenCalledWith(
        expect.stringContaining('upper@example.com'),
      );
    });

    it('should return allowed=false when count exceeds limit', async () => {
      mockRedis.pttl.mockResolvedValue(-1);
      mockRedis.call.mockResolvedValue(limit + 1); // over limit
      mockRedis.incr.mockResolvedValue(1); // first fail window

      const result = await service.check(email, routeKey, limit, ttlMs);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should set lockout when fail windows threshold is reached', async () => {
      mockRedis.pttl.mockResolvedValue(-1);
      mockRedis.call.mockResolvedValue(limit + 1);
      mockRedis.incr.mockResolvedValue(3); // OTP_LOCKOUT_THRESHOLD = 3

      const result = await service.check(email, routeKey, limit, ttlMs);

      expect(result.allowed).toBe(false);
      expect(result.lockedUntilMs).toBeDefined();
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('otp:lockout:'),
        '1',
        'EX',
        expect.any(Number),
      );
    });
  });

  describe('markSuccess', () => {
    it('should delete fail windows key on success', async () => {
      await service.markSuccess(email, routeKey);

      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining('otp:fail_windows:'),
      );
    });

    it('should handle redis del error gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      await expect(service.markSuccess(email, routeKey)).resolves.not.toThrow();
    });
  });
});
