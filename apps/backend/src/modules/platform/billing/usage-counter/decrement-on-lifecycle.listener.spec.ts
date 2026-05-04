import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { DecrementOnLifecycleListener } from './decrement-on-lifecycle.listener';
import { EPOCH } from './period.util';

const ORG_ID = 'org-lifecycle-test';

type Subscriber = (envelope: { payload: { organizationId: string } }) => Promise<void>;

function buildEventBus() {
  const handlers = new Map<string, Subscriber>();
  return {
    subscribe: jest.fn((eventName: string, handler: Subscriber) => {
      handlers.set(eventName, handler);
    }),
    emit: async (eventName: string, organizationId: string) => {
      const handler = handlers.get(eventName);
      if (handler) await handler({ payload: { organizationId } });
    },
  };
}

function buildCounters() {
  return {
    increment: jest.fn().mockResolvedValue(undefined),
  };
}

describe('DecrementOnLifecycleListener', () => {
  let eventBus: ReturnType<typeof buildEventBus>;
  let counters: ReturnType<typeof buildCounters>;
  let listener: DecrementOnLifecycleListener;

  beforeEach(() => {
    eventBus = buildEventBus();
    counters = buildCounters();
    listener = new DecrementOnLifecycleListener(
      counters as never,
      eventBus as never,
    );
    listener.onModuleInit();
  });

  // ── Decrement tests ───────────────────────────────────────────────────

  it('decrements BRANCHES when org-config.branch.deactivated fires', async () => {
    await eventBus.emit('org-config.branch.deactivated', ORG_ID);
    expect(counters.increment).toHaveBeenCalledWith(ORG_ID, FeatureKey.BRANCHES, EPOCH, -1);
  });

  it('decrements EMPLOYEES when people.employee.deactivated fires', async () => {
    await eventBus.emit('people.employee.deactivated', ORG_ID);
    expect(counters.increment).toHaveBeenCalledWith(ORG_ID, FeatureKey.EMPLOYEES, EPOCH, -1);
  });

  it('decrements SERVICES when org-experience.service.deactivated fires', async () => {
    await eventBus.emit('org-experience.service.deactivated', ORG_ID);
    expect(counters.increment).toHaveBeenCalledWith(ORG_ID, FeatureKey.SERVICES, EPOCH, -1);
  });

  // ── Increment (reactivation) tests ───────────────────────────────────

  it('increments BRANCHES when org-config.branch.reactivated fires', async () => {
    await eventBus.emit('org-config.branch.reactivated', ORG_ID);
    expect(counters.increment).toHaveBeenCalledWith(ORG_ID, FeatureKey.BRANCHES, EPOCH, 1);
  });

  it('increments EMPLOYEES when people.employee.reactivated fires', async () => {
    await eventBus.emit('people.employee.reactivated', ORG_ID);
    expect(counters.increment).toHaveBeenCalledWith(ORG_ID, FeatureKey.EMPLOYEES, EPOCH, 1);
  });

  it('increments SERVICES when org-experience.service.reactivated fires', async () => {
    await eventBus.emit('org-experience.service.reactivated', ORG_ID);
    expect(counters.increment).toHaveBeenCalledWith(ORG_ID, FeatureKey.SERVICES, EPOCH, 1);
  });

  it('logs error but does not throw when increment fails', async () => {
    counters.increment = jest.fn().mockRejectedValue(new Error('DB down'));
    // Should not throw — error is swallowed and logged
    await expect(eventBus.emit('org-config.branch.deactivated', ORG_ID)).resolves.toBeUndefined();
  });
});
