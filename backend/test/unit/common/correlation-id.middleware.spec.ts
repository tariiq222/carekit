/**
 * CorrelationIdMiddleware Unit Tests
 */
import {
  CorrelationIdMiddleware,
  correlationStorage,
  CORRELATION_HEADER,
} from '../../../src/common/middleware/correlation-id.middleware.js';

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware();
  });

  it('should use incoming x-correlation-id header when present', (done) => {
    const req = { headers: { [CORRELATION_HEADER]: 'test-correlation-id' } } as never;
    const res = { setHeader: jest.fn() } as never;
    const next = jest.fn(() => done());

    middleware.use(req, res, next);

    expect((res as { setHeader: jest.Mock }).setHeader).toHaveBeenCalledWith(
      CORRELATION_HEADER,
      'test-correlation-id',
    );
  });

  it('should generate a UUID when no correlation header is provided', (done) => {
    const req = { headers: {} } as never;
    const setHeader = jest.fn();
    const res = { setHeader } as never;
    const next = jest.fn(() => {
      const [, value] = setHeader.mock.calls[0];
      expect(value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      done();
    });

    middleware.use(req, res, next);
  });

  it('should make correlationId available via correlationStorage inside next()', (done) => {
    const req = { headers: { [CORRELATION_HEADER]: 'store-check-id' } } as never;
    const res = { setHeader: jest.fn() } as never;
    const next = jest.fn(() => {
      const stored = correlationStorage.getStore();
      expect(stored).toBe('store-check-id');
      done();
    });

    middleware.use(req, res, next);
  });
});
