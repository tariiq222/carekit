/**
 * Interceptors — Unit Tests
 * Covers: LoggingInterceptor, ResponseTransformInterceptor, MetricsInterceptor
 */
import { of, throwError } from 'rxjs';
import { ExecutionContext } from '@nestjs/common';
import { LoggingInterceptor } from '../../../src/common/interceptors/logging.interceptor.js';
import { ResponseTransformInterceptor } from '../../../src/common/interceptors/response-transform.interceptor.js';
import { MetricsInterceptor } from '../../../src/common/metrics/metrics.interceptor.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeContext(overrides: Record<string, unknown> = {}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method: 'GET', url: '/test', ip: '127.0.0.1', route: { path: '/test' }, ...overrides }),
      getResponse: () => ({ statusCode: 200 }),
    }),
    getClass: () => ({}),
    getHandler: () => ({}),
  } as unknown as ExecutionContext;
}

function makeHandler(data: unknown = { id: 1 }) {
  return { handle: jest.fn().mockReturnValue(of(data)) };
}

function makeErrorHandler(err: Error) {
  return { handle: jest.fn().mockReturnValue(throwError(() => err)) };
}

// ── LoggingInterceptor ────────────────────────────────────────────────────────

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
  });

  it('should pass through the response data unchanged', (done) => {
    const ctx = makeContext();
    const handler = makeHandler({ id: 42 });

    interceptor.intercept(ctx, handler).subscribe({
      next: (val) => {
        expect(val).toEqual({ id: 42 });
        done();
      },
    });
  });

  it('should call next.handle()', () => {
    const ctx = makeContext();
    const handler = makeHandler();
    interceptor.intercept(ctx, handler).subscribe();
    expect(handler.handle).toHaveBeenCalled();
  });

  it('should re-throw errors from the handler', (done) => {
    const ctx = makeContext();
    const err = new Error('handler error');
    const handler = makeErrorHandler(err);

    interceptor.intercept(ctx, handler).subscribe({
      error: (e) => {
        expect(e).toBe(err);
        done();
      },
    });
  });

  it('should handle requests with no route', (done) => {
    const ctx = makeContext({ route: undefined });
    const handler = makeHandler('ok');
    interceptor.intercept(ctx, handler).subscribe({ next: () => done() });
  });
});

// ── ResponseTransformInterceptor ─────────────────────────────────────────────

describe('ResponseTransformInterceptor', () => {
  let interceptor: ResponseTransformInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new ResponseTransformInterceptor();
  });

  it('should wrap plain object in ApiResponse', (done) => {
    const ctx = makeContext();
    const handler = makeHandler({ id: 1 });

    interceptor.intercept(ctx, handler).subscribe({
      next: (val) => {
        expect(val).toMatchObject({ success: true, data: { id: 1 } });
        done();
      },
    });
  });

  it('should pass through already-wrapped ApiResponse', (done) => {
    const ctx = makeContext();
    const wrapped = { success: true, data: { id: 2 } };
    const handler = makeHandler(wrapped);

    interceptor.intercept(ctx, handler).subscribe({
      next: (val) => {
        expect(val).toBe(wrapped);
        done();
      },
    });
  });

  it('should pass through string responses unchanged', (done) => {
    const ctx = makeContext();
    const handler = makeHandler('plain string');

    interceptor.intercept(ctx, handler).subscribe({
      next: (val) => {
        expect(val).toBe('plain string');
        done();
      },
    });
  });

  it('should wrap null data', (done) => {
    const ctx = makeContext();
    const handler = makeHandler(null);

    interceptor.intercept(ctx, handler).subscribe({
      next: (val) => {
        expect(val).toMatchObject({ success: true });
        done();
      },
    });
  });

  it('should wrap array data', (done) => {
    const ctx = makeContext();
    const handler = makeHandler([1, 2, 3]);

    interceptor.intercept(ctx, handler).subscribe({
      next: (val) => {
        expect(val).toMatchObject({ success: true, data: [1, 2, 3] });
        done();
      },
    });
  });
});

// ── MetricsInterceptor ────────────────────────────────────────────────────────

describe('MetricsInterceptor', () => {
  let interceptor: MetricsInterceptor;
  const mockMetrics = {
    httpRequestDuration: { startTimer: jest.fn().mockReturnValue(jest.fn()) },
    httpRequestsTotal: { inc: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockMetrics.httpRequestDuration.startTimer.mockReturnValue(jest.fn());
    interceptor = new MetricsInterceptor(mockMetrics as any);
  });

  it('should start a timer on intercept', (done) => {
    const ctx = makeContext();
    const handler = makeHandler({ ok: true });

    interceptor.intercept(ctx, handler).subscribe({
      next: () => {
        expect(mockMetrics.httpRequestDuration.startTimer).toHaveBeenCalledWith({
          method: 'GET',
          route: '/test',
        });
        done();
      },
    });
  });

  it('should increment httpRequestsTotal on success', (done) => {
    const ctx = makeContext();
    const handler = makeHandler({ ok: true });

    interceptor.intercept(ctx, handler).subscribe({
      next: () => {
        expect(mockMetrics.httpRequestsTotal.inc).toHaveBeenCalledWith(
          expect.objectContaining({ method: 'GET', route: '/test' }),
        );
        done();
      },
    });
  });

  it('should increment httpRequestsTotal with error status on failure', (done) => {
    const ctx = makeContext();
    const handler = makeErrorHandler(new Error('fail'));

    interceptor.intercept(ctx, handler).subscribe({
      error: () => {
        expect(mockMetrics.httpRequestsTotal.inc).toHaveBeenCalledWith(
          expect.objectContaining({ status_code: 'error' }),
        );
        done();
      },
    });
  });

  it('should use /unmatched for routes without a path', (done) => {
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', url: '/unknown', ip: '127.0.0.1' }),
        getResponse: () => ({ statusCode: 404 }),
      }),
      getClass: () => ({}),
      getHandler: () => ({}),
    } as unknown as ExecutionContext;
    const handler = makeHandler({});

    interceptor.intercept(ctx, handler).subscribe({
      next: () => {
        expect(mockMetrics.httpRequestDuration.startTimer).toHaveBeenCalledWith(
          expect.objectContaining({ route: '/unmatched' }),
        );
        done();
      },
    });
  });
});
