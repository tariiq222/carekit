/**
 * CacheService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from '../../../src/common/services/cache.service.js';
import { REDIS_CLIENT } from '../../../src/common/redis/redis.constants.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockRedis: any = {
  get: jest.fn(),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  scan: jest.fn(),
};

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    jest.clearAllMocks();
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
  });

  describe('get', () => {
    it('should return null when key not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.get('some-key');

      expect(result).toBeNull();
    });

    it('should return parsed value when found', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ data: 'value' }));

      const result = await service.get<{ data: string }>('some-key');

      expect(result).toEqual({ data: 'value' });
    });

    it('should return null on JSON parse error', async () => {
      mockRedis.get.mockResolvedValue('invalid json{{{');

      const result = await service.get('some-key');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should serialize value and set with TTL', async () => {
      await service.set('key', { value: 42 }, 300);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'key',
        JSON.stringify({ value: 42 }),
        'EX',
        300,
      );
    });
  });

  describe('del', () => {
    it('should delete the key', async () => {
      await service.del('some-key');

      expect(mockRedis.del).toHaveBeenCalledWith('some-key');
    });
  });

  describe('delPattern', () => {
    it('should scan and delete matching keys', async () => {
      // First scan returns keys, second scan returns 0 cursor (done)
      mockRedis.scan
        .mockResolvedValueOnce(['1', ['key:1', 'key:2']])
        .mockResolvedValueOnce(['0', []]);

      await service.delPattern('key:*');

      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
      expect(mockRedis.del).toHaveBeenCalledWith('key:1', 'key:2');
    });

    it('should handle empty scan results', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);

      await service.delPattern('no-matches:*');

      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });
});
