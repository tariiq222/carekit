import { ConfigService } from '@nestjs/config';

const queueInstances: Array<{ name: string; close: jest.Mock }> = [];
const workerInstances: Array<{ name: string; close: jest.Mock }> = [];
const queueEventsInstances: Array<{ name: string; close: jest.Mock }> = [];

jest.mock('bullmq', () => {
  return {
    __esModule: true,
    Queue: jest.fn().mockImplementation((name: string) => {
      const inst = { name, close: jest.fn().mockResolvedValue(undefined) };
      queueInstances.push(inst);
      return inst;
    }),
    Worker: jest.fn().mockImplementation((name: string) => {
      const inst = { name, close: jest.fn().mockResolvedValue(undefined) };
      workerInstances.push(inst);
      return inst;
    }),
    QueueEvents: jest.fn().mockImplementation((name: string) => {
      const inst = { name, close: jest.fn().mockResolvedValue(undefined) };
      queueEventsInstances.push(inst);
      return inst;
    }),
  };
});

import { BullMqService } from './bull-mq.service';

describe('BullMqService', () => {
  const makeConfig = (overrides: Record<string, unknown> = {}): ConfigService => {
    const values: Record<string, unknown> = {
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      REDIS_DB: 0,
      ...overrides,
    };
    return {
      get: (key: string) => values[key],
      getOrThrow: (key: string) => values[key],
    } as unknown as ConfigService;
  };

  beforeEach(() => {
    queueInstances.length = 0;
    workerInstances.length = 0;
    queueEventsInstances.length = 0;
  });

  it('sets maxRetriesPerRequest to null on connection', () => {
    const service = new BullMqService(makeConfig({ REDIS_PASSWORD: 'pw' }));
    const conn = service.buildConnection();
    expect(conn.maxRetriesPerRequest).toBeNull();
    expect(conn.password).toBe('pw');
  });

  it('caches queues by name', () => {
    const service = new BullMqService(makeConfig());
    const q1 = service.getQueue('bookings');
    const q2 = service.getQueue('bookings');
    expect(q1).toBe(q2);
    expect(queueInstances.length).toBe(1);
  });

  it('creates distinct queues for different names', () => {
    const service = new BullMqService(makeConfig());
    service.getQueue('bookings');
    service.getQueue('finance');
    expect(queueInstances.map((q) => q.name)).toEqual(['bookings', 'finance']);
  });

  it('rejects duplicate worker registration for same queue', () => {
    const service = new BullMqService(makeConfig());
    service.createWorker('bookings', async () => undefined);
    expect(() =>
      service.createWorker('bookings', async () => undefined),
    ).toThrow(/already registered/);
  });

  it('closes workers, queue events, and queues on shutdown', async () => {
    const service = new BullMqService(makeConfig());
    service.getQueue('bookings');
    service.createWorker('bookings', async () => undefined);
    service.getQueueEvents('bookings');

    await service.onModuleDestroy();

    expect(workerInstances[0].close).toHaveBeenCalledTimes(1);
    expect(queueEventsInstances[0].close).toHaveBeenCalledTimes(1);
    expect(queueInstances[0].close).toHaveBeenCalledTimes(1);
  });
});
