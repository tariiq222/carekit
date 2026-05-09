import { EventBusService } from '../../src/infrastructure/events';

export function createEventBusMock(): EventBusService {
  return {
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn(),
  } as unknown as EventBusService;
}

export function createMockedEventBus(overrides: Partial<EventBusService> = {}): EventBusService {
  return {
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn(),
    ...overrides,
  } as unknown as EventBusService;
}
