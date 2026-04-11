/**
 * AuthCacheService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { AuthCacheService } from '../../../src/modules/auth/auth-cache.service.js';
import { REDIS_CLIENT } from '../../../src/common/redis/redis.constants.js';

const userId = 'user-uuid-1';

const mockPayload: any = {
  sub: userId,
  email: 'test@example.com',
  roles: ['patient'],
};

const mockRedis: any = {
  get: jest.fn(),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
};

describe('AuthCacheService', () => {
  let service: AuthCacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthCacheService,
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AuthCacheService>(AuthCacheService);
    jest.clearAllMocks();
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
  });

  describe('get', () => {
    it('should return null when no cached value', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.get(userId);

      expect(result).toBeNull();
    });

    it('should return parsed payload when cached', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockPayload));

      const result = await service.get(userId);

      expect(result).toEqual(mockPayload);
    });

    it('should return null on JSON parse error', async () => {
      mockRedis.get.mockResolvedValue('invalid json {{{');

      const result = await service.get(userId);

      expect(result).toBeNull();
    });

    it('should use correct cache key prefix', async () => {
      mockRedis.get.mockResolvedValue(null);

      await service.get(userId);

      expect(mockRedis.get).toHaveBeenCalledWith(`auth:user:${userId}`);
    });
  });

  describe('set', () => {
    it('should store serialized payload with TTL', async () => {
      await service.set(userId, mockPayload);

      expect(mockRedis.set).toHaveBeenCalledWith(
        `auth:user:${userId}`,
        JSON.stringify(mockPayload),
        'EX',
        900,
      );
    });
  });

  describe('invalidate', () => {
    it('should delete cache key', async () => {
      await service.invalidate(userId);

      expect(mockRedis.del).toHaveBeenCalledWith(`auth:user:${userId}`);
    });
  });

  describe('acquirePopulateLock', () => {
    it('should return true when lock acquired', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.acquirePopulateLock(userId);

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        `auth:user:lock:${userId}`,
        '1',
        'EX',
        5,
        'NX',
      );
    });

    it('should return false when lock already held', async () => {
      mockRedis.set.mockResolvedValue(null);

      const result = await service.acquirePopulateLock(userId);

      expect(result).toBe(false);
    });
  });

  describe('releasePopulateLock', () => {
    it('should delete lock key', async () => {
      await service.releasePopulateLock(userId);

      expect(mockRedis.del).toHaveBeenCalledWith(`auth:user:lock:${userId}`);
    });
  });
});
