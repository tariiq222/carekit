import { BaseEvent } from './base-event';
import { RequestContextStorage } from '../tenant/request-context';

class TestEvent extends BaseEvent<{ value: number }> {
  readonly eventName = 'test.happened';

  constructor(tenantId: string, value: number, correlationId?: string) {
    super({ source: 'test-bc', version: 1, tenantId, payload: { value }, correlationId });
  }
}

describe('BaseEvent', () => {
  it('auto-generates eventId as UUID', () => {
    const e = new TestEvent('clinic-1', 42);
    expect(e.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('sets occurredAt to current date', () => {
    const before = new Date();
    const e = new TestEvent('clinic-1', 1);
    expect(e.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('carries tenantId, source, version, payload', () => {
    const e = new TestEvent('clinic-abc', 7);
    expect(e.tenantId).toBe('clinic-abc');
    expect(e.source).toBe('test-bc');
    expect(e.version).toBe(1);
    expect(e.payload).toEqual({ value: 7 });
  });

  it('uses explicit correlationId when provided', () => {
    const e = new TestEvent('clinic-1', 0, 'corr-xyz');
    expect(e.correlationId).toBe('corr-xyz');
  });

  it('pulls correlationId from RequestContext when available', () => {
    RequestContextStorage.run(
      { tenantId: 'clinic-1', requestId: 'req-from-ctx', ip: '127.0.0.1' },
      () => {
        const e = new TestEvent('clinic-1', 0);
        expect(e.correlationId).toBe('req-from-ctx');
      },
    );
  });

  it('generates random correlationId when no context and none provided', () => {
    const e = new TestEvent('clinic-1', 0);
    expect(e.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('toEnvelope() returns all required fields', () => {
    const e = new TestEvent('clinic-1', 99);
    const env = e.toEnvelope();
    expect(env).toMatchObject({
      eventId: e.eventId,
      correlationId: e.correlationId,
      tenantId: 'clinic-1',
      source: 'test-bc',
      version: 1,
      payload: { value: 99 },
    });
    expect(env.occurredAt).toBeInstanceOf(Date);
  });

  it('each instance gets a unique eventId', () => {
    const ids = new Set(Array.from({ length: 10 }, () => new TestEvent('c', 0).eventId));
    expect(ids.size).toBe(10);
  });
});
