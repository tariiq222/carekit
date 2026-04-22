import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { Clock, SubscriptionCacheService } from './subscription-cache.service';

describe('SubscriptionCacheService', () => {
  const ORG_A = '00000000-0000-0000-0000-0000000000a1';
  const ORG_B = '00000000-0000-0000-0000-0000000000b2';

  function makeSub(overrides?: Partial<{ status: string; slug: string }>) {
    return {
      id: 'sub-1',
      organizationId: ORG_A,
      status: overrides?.status ?? 'ACTIVE',
      plan: {
        slug: overrides?.slug ?? 'BASIC',
        limits: {
          maxBranches: 1,
          maxEmployees: 5,
          maxBookingsPerMonth: 500,
          websiteEnabled: false,
          // non-primitive values should be dropped at the cache boundary
          metadata: { note: 'ignored' },
        },
      },
    };
  }

  function makePrismaMock(findFirst: jest.Mock) {
    return {
      subscription: { findFirst },
    } as unknown as PrismaService;
  }

  function makeClock(initial: number): Clock & { tick(ms: number): void } {
    let t = initial;
    return {
      now: () => t,
      tick(ms: number) {
        t += ms;
      },
    };
  }

  it('miss → fetches → subsequent calls hit cache', async () => {
    const findFirst = jest.fn().mockResolvedValue(makeSub());
    const clock = makeClock(1_000_000);
    const cache = new SubscriptionCacheService(makePrismaMock(findFirst), { clock });

    const first = await cache.get(ORG_A);
    const second = await cache.get(ORG_A);

    expect(first?.planSlug).toBe('BASIC');
    expect(first?.status).toBe('ACTIVE');
    expect(second).toEqual(first);
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it('returns null for org with no subscription and does NOT cache the miss', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const cache = new SubscriptionCacheService(makePrismaMock(findFirst));

    expect(await cache.get(ORG_A)).toBeNull();
    expect(await cache.get(ORG_A)).toBeNull();
    // Not caching negative lookups is intentional — a just-signed-up org
    // would otherwise see 60s of stale "no plan" after StartSubscription.
    expect(findFirst).toHaveBeenCalledTimes(2);
  });

  it('re-fetches after TTL expiry', async () => {
    const findFirst = jest.fn().mockResolvedValue(makeSub());
    const clock = makeClock(1_000_000);
    const cache = new SubscriptionCacheService(makePrismaMock(findFirst), {
      clock,
      ttlMs: 60_000,
    });

    await cache.get(ORG_A);
    clock.tick(59_999);
    await cache.get(ORG_A);
    expect(findFirst).toHaveBeenCalledTimes(1);

    clock.tick(2);
    await cache.get(ORG_A);
    expect(findFirst).toHaveBeenCalledTimes(2);
  });

  it('invalidate(orgId) forces next call to re-fetch', async () => {
    const findFirst = jest.fn().mockResolvedValue(makeSub());
    const cache = new SubscriptionCacheService(makePrismaMock(findFirst));

    await cache.get(ORG_A);
    cache.invalidate(ORG_A);
    await cache.get(ORG_A);

    expect(findFirst).toHaveBeenCalledTimes(2);
  });

  it('invalidate only clears the targeted org', async () => {
    const findFirst = jest.fn().mockImplementation((args: { where: { organizationId: string } }) =>
      Promise.resolve({ ...makeSub(), organizationId: args.where.organizationId }),
    );
    const cache = new SubscriptionCacheService(makePrismaMock(findFirst));

    await cache.get(ORG_A);
    await cache.get(ORG_B);
    expect(cache.size()).toBe(2);

    cache.invalidate(ORG_A);
    expect(cache.size()).toBe(1);

    // ORG_B still cached — no additional fetch.
    await cache.get(ORG_B);
    expect(findFirst).toHaveBeenCalledTimes(2);
  });

  it('drops non-primitive values from the limits JSON at the cache boundary', async () => {
    const findFirst = jest.fn().mockResolvedValue(makeSub());
    const cache = new SubscriptionCacheService(makePrismaMock(findFirst));

    const entry = await cache.get(ORG_A);
    expect(entry?.limits.maxBranches).toBe(1);
    expect(entry?.limits.websiteEnabled).toBe(false);
    expect(entry?.limits.metadata).toBeUndefined();
  });
});
