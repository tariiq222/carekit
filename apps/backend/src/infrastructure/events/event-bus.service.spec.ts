import type { Queue, Worker } from 'bullmq';
import { BullMqService } from '../queue/bull-mq.service';
import { EventBusService, type DomainEventEnvelope } from './event-bus.service';

/**
 * Unit contract for the event bus. BullMQ is stubbed via a fake
 * {@link BullMqService} so we can assert publish/subscribe semantics
 * without opening a real queue.
 */
describe('EventBusService', () => {
  let fakeQueue: { add: jest.Mock };
  let fakeWorker: Pick<Worker, 'close'>;
  let workerProcessor: ((job: { name: string; data: unknown }) => Promise<void>) | undefined;
  let bullmq: jest.Mocked<Pick<BullMqService, 'getQueue' | 'createWorker'>>;
  let bus: EventBusService;

  beforeEach(() => {
    fakeQueue = { add: jest.fn().mockResolvedValue(undefined) };
    fakeWorker = { close: jest.fn().mockResolvedValue(undefined) } as Pick<Worker, 'close'>;
    workerProcessor = undefined;

    bullmq = {
      getQueue: jest.fn().mockReturnValue(fakeQueue as unknown as Queue),
      createWorker: jest.fn().mockImplementation((_name, processor) => {
        workerProcessor = processor;
        return fakeWorker as Worker;
      }),
    };
    bus = new EventBusService(bullmq as unknown as BullMqService);
  });

  const makeEvent = (name: string): DomainEventEnvelope<{ bookingId: string }> => ({
    eventId: 'evt-1',
    source: 'bookings',
    version: 1,
    occurredAt: new Date('2026-04-11T10:00:00Z'),
    payload: { bookingId: 'bk-1' },
  });

  it('publishes to the domain-events queue with the event name as job name', async () => {
    await bus.publish('booking.confirmed', makeEvent('booking.confirmed'));
    expect(bullmq.getQueue).toHaveBeenCalledWith('domain-events');
    expect(fakeQueue.add).toHaveBeenCalledWith(
      'booking.confirmed',
      expect.objectContaining({ source: 'bookings' }),
      expect.objectContaining({ removeOnComplete: expect.any(Object) }),
    );
  });

  it('boots the worker lazily on first subscribe', () => {
    expect(bullmq.createWorker).not.toHaveBeenCalled();
    bus.subscribe('booking.confirmed', async () => undefined);
    expect(bullmq.createWorker).toHaveBeenCalledTimes(1);
    bus.subscribe('booking.cancelled', async () => undefined);
    expect(bullmq.createWorker).toHaveBeenCalledTimes(1);
  });

  it('dispatches matching event to all registered handlers sequentially', async () => {
    const calls: string[] = [];
    bus.subscribe('booking.confirmed', async () => {
      calls.push('h1');
    });
    bus.subscribe('booking.confirmed', async () => {
      calls.push('h2');
    });
    bus.subscribe('booking.cancelled', async () => {
      calls.push('other');
    });

    expect(workerProcessor).toBeDefined();
    await workerProcessor!({
      name: 'booking.confirmed',
      data: makeEvent('booking.confirmed'),
    });

    expect(calls).toEqual(['h1', 'h2']);
  });

  it('no-ops when dispatching an event with no handlers', async () => {
    bus.subscribe('other', async () => undefined);
    expect(workerProcessor).toBeDefined();
    await expect(
      workerProcessor!({ name: 'unknown', data: makeEvent('unknown') }),
    ).resolves.toBeUndefined();
  });

  it('propagates handler errors so BullMQ can retry', async () => {
    bus.subscribe('booking.confirmed', async () => {
      throw new Error('boom');
    });
    await expect(
      workerProcessor!({
        name: 'booking.confirmed',
        data: makeEvent('booking.confirmed'),
      }),
    ).rejects.toThrow('boom');
  });
});
