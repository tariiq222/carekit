/**
 * Unit tests for PermissionCacheService.
 *
 * Covers:
 * - get: cache miss (null key), cache hit (deserializes Set correctly), JSON parse error
 * - set: serializes Set to JSON array with correct key and TTL
 * - invalidate: deletes the correct key
 */

import { PermissionCacheService } from '../../../src/modules/auth/permission-cache.service.js';
import { REDIS_CLIENT } from '../../../src/common/redis/redis.constants.js';
import { Test } from '@nestjs/testing';

function buildRedisMock() {
  return {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  };
}

async function createService(redisMock: ReturnType<typeof buildRedisMock>) {
  const module = await Test.createTestingModule({
    providers: [
      PermissionCacheService,
      { provide: REDIS_CLIENT, useValue: redisMock },
    ],
  }).compile();

  return module.get<PermissionCacheService>(PermissionCacheService);
}

describe('PermissionCacheService', () => {
  let service: PermissionCacheService;
  let redis: ReturnType<typeof buildRedisMock>;

  const USER_ID = 'user-abc-123';
  const CACHE_KEY = `perm:user:${USER_ID}`;

  beforeEach(async () => {
    redis = buildRedisMock();
    service = await createService(redis);
  });

  // ── get ───────────────────────────────────────────────────────────────────

  describe('get()', () => {
    it('returns null when key does not exist in Redis', async () => {
      redis.get.mockResolvedValue(null);

      const result = await service.get(USER_ID);

      expect(result).toBeNull();
      expect(redis.get).toHaveBeenCalledWith(CACHE_KEY);
    });

    it('returns a Set of strings when key exists and JSON is valid', async () => {
      redis.get.mockResolvedValue(
        JSON.stringify(['users:view', 'reports:view']),
      );

      const result = await service.get(USER_ID);

      expect(result).toBeInstanceOf(Set);
      expect(result).toEqual(new Set(['users:view', 'reports:view']));
    });

    it('returns null when cached value is malformed JSON', async () => {
      redis.get.mockResolvedValue('not-valid-json{');

      const result = await service.get(USER_ID);

      expect(result).toBeNull();
    });

    it('returns an empty Set when cached value is an empty array', async () => {
      redis.get.mockResolvedValue(JSON.stringify([]));

      const result = await service.get(USER_ID);

      expect(result).toBeInstanceOf(Set);
      expect(result!.size).toBe(0);
    });
  });

  // ── set ───────────────────────────────────────────────────────────────────

  describe('set()', () => {
    it('serializes the Set to a JSON array and stores with EX TTL', async () => {
      const permissions = new Set(['users:view', 'patients:create']);

      await service.set(USER_ID, permissions);

      expect(redis.set).toHaveBeenCalledWith(
        CACHE_KEY,
        expect.any(String),
        'EX',
        900,
      );

      const [, serialized] = redis.set.mock.calls[0] as [
        string,
        string,
        ...unknown[],
      ];
      const parsed: unknown = JSON.parse(serialized);
      expect(new Set(parsed as string[])).toEqual(permissions);
    });

    it('stores an empty JSON array for an empty Set', async () => {
      await service.set(USER_ID, new Set());

      const [, serialized] = redis.set.mock.calls[0] as [
        string,
        string,
        ...unknown[],
      ];
      expect(JSON.parse(serialized)).toEqual([]);
    });
  });

  // ── invalidate ────────────────────────────────────────────────────────────

  describe('invalidate()', () => {
    it('deletes the correct cache key', async () => {
      await service.invalidate(USER_ID);

      expect(redis.del).toHaveBeenCalledWith(CACHE_KEY);
      expect(redis.del).toHaveBeenCalledTimes(1);
    });

    it('does not throw when key does not exist (del returns 0)', async () => {
      redis.del.mockResolvedValue(0);

      await expect(service.invalidate(USER_ID)).resolves.toBeUndefined();
    });
  });
});
