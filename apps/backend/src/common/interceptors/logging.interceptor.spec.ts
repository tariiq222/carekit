import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

const makeCtx = (method = 'GET', url = '/test') =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ method, url }),
      getResponse: () => ({ statusCode: 200 }),
    }),
  }) as unknown as ExecutionContext;

const makeHandler = (value: unknown = {}, fail = false): CallHandler => ({
  handle: () => (fail ? throwError(() => new Error('boom')) : of(value)),
});

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
  });

  it('passes the response through on success', (done) => {
    interceptor.intercept(makeCtx(), makeHandler({ ok: true })).subscribe({
      next: (v) => {
        expect(v).toEqual({ ok: true });
        done();
      },
    });
  });

  it('re-emits the error on failure', (done) => {
    interceptor.intercept(makeCtx(), makeHandler(null, true)).subscribe({
      error: (err: Error) => {
        expect(err.message).toBe('boom');
        done();
      },
    });
  });

  it('does not swallow errors', (done) => {
    let errored = false;
    interceptor.intercept(makeCtx('POST', '/bookings'), makeHandler(null, true)).subscribe({
      error: () => {
        errored = true;
        done();
      },
      complete: () => {
        expect(errored).toBe(true);
      },
    });
  });
});
