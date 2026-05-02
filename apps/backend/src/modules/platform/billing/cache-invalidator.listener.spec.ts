import { CacheInvalidatorListener } from './cache-invalidator.listener';
import { FeatureGuard } from './feature.guard';
import {
  SUBSCRIPTION_UPDATED_EVENT,
} from './events/subscription-updated.event';
import {
  PLAN_UPDATED_EVENT,
} from './events/plan-updated.event';

// Spy on FeatureGuard static methods before tests run
const invalidateSpy = jest.spyOn(FeatureGuard, 'invalidate').mockImplementation(() => undefined);
const invalidateAllSpy = jest.spyOn(FeatureGuard, 'invalidateAll').mockImplementation(() => undefined);

const buildSubCache = () => ({
  invalidate: jest.fn(),
});

const buildEventBus = () => {
  const handlers: Record<string, (e: unknown) => Promise<void>> = {};
  return {
    subscribe: jest.fn((event: string, handler: (e: unknown) => Promise<void>) => {
      handlers[event] = handler;
    }),
    _trigger: async (event: string, payload: unknown) => {
      if (handlers[event]) await handlers[event](payload);
    },
  };
};

describe('CacheInvalidatorListener', () => {
  beforeEach(() => {
    invalidateSpy.mockClear();
    invalidateAllSpy.mockClear();
  });

  it('invalidates both caches when subscription.updated is received', async () => {
    const subCache = buildSubCache();
    const eventBus = buildEventBus();

    const listener = new CacheInvalidatorListener(subCache as never, eventBus as never);
    listener.onModuleInit();

    await eventBus._trigger(SUBSCRIPTION_UPDATED_EVENT, {
      payload: { organizationId: 'org-1', subscriptionId: 'sub-1', reason: 'UPGRADE' },
    });

    expect(invalidateSpy).toHaveBeenCalledWith('org-1');
    expect(subCache.invalidate).toHaveBeenCalledWith('org-1');
  });

  it('invalidates both caches for each org when plan.updated is received', async () => {
    const subCache = buildSubCache();
    const eventBus = buildEventBus();

    const listener = new CacheInvalidatorListener(subCache as never, eventBus as never);
    listener.onModuleInit();

    await eventBus._trigger(PLAN_UPDATED_EVENT, {
      payload: { planId: 'plan-1', affectedOrganizationIds: ['org-A', 'org-B'] },
    });

    expect(invalidateSpy).toHaveBeenCalledWith('org-A');
    expect(invalidateSpy).toHaveBeenCalledWith('org-B');
    expect(subCache.invalidate).toHaveBeenCalledWith('org-A');
    expect(subCache.invalidate).toHaveBeenCalledWith('org-B');
    expect(invalidateAllSpy).not.toHaveBeenCalled();
  });

  it('calls invalidateAll when plan.updated has no affected orgs', async () => {
    const subCache = buildSubCache();
    const eventBus = buildEventBus();

    const listener = new CacheInvalidatorListener(subCache as never, eventBus as never);
    listener.onModuleInit();

    await eventBus._trigger(PLAN_UPDATED_EVENT, {
      payload: { planId: 'plan-1', affectedOrganizationIds: [] },
    });

    expect(invalidateAllSpy).toHaveBeenCalled();
    expect(subCache.invalidate).not.toHaveBeenCalled();
  });
});
