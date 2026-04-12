import { BadRequestException } from '@nestjs/common';
import { TenantMiddleware } from './tenant.middleware';
import { RequestContextStorage } from './request-context';

const makeReq = (headers: Record<string, string | string[]> = {}) =>
  ({ headers, ip: '127.0.0.1' }) as any;

const makeRes = () => {
  const headers: Record<string, string> = {};
  return { setHeader: (k: string, v: string) => { headers[k] = v; }, _headers: headers } as any;
};

describe('TenantMiddleware', () => {
  let middleware: TenantMiddleware;

  beforeEach(() => {
    middleware = new TenantMiddleware();
  });

  it('throws BadRequestException when X-Tenant-ID is missing', () => {
    expect(() => middleware.use(makeReq(), makeRes(), jest.fn())).toThrow(BadRequestException);
  });

  it('throws BadRequestException when X-Tenant-ID is empty string', () => {
    expect(() =>
      middleware.use(makeReq({ 'x-tenant-id': '  ' }), makeRes(), jest.fn()),
    ).toThrow(BadRequestException);
  });

  it('calls next() and sets RequestContext when X-Tenant-ID is valid', (done) => {
    const res = makeRes();
    middleware.use(makeReq({ 'x-tenant-id': 'clinic-abc' }), res, () => {
      const ctx = RequestContextStorage.get();
      expect(ctx?.tenantId).toBe('clinic-abc');
      expect(ctx?.requestId).toBeDefined();
      done();
    });
  });

  it('uses X-Request-ID from header when provided', (done) => {
    const req = makeReq({ 'x-tenant-id': 'clinic-abc', 'x-request-id': 'req-123' });
    middleware.use(req, makeRes(), () => {
      expect(RequestContextStorage.get()?.requestId).toBe('req-123');
      done();
    });
  });

  it('sets x-request-id response header', (done) => {
    const res = makeRes();
    middleware.use(makeReq({ 'x-tenant-id': 'clinic-abc' }), res, () => {
      expect(res._headers['x-request-id']).toBeDefined();
      done();
    });
  });
});

describe('TenantMiddleware — edge cases', () => {
  let middleware: TenantMiddleware;

  beforeEach(() => {
    middleware = new TenantMiddleware();
  });

  it('rejects requests with whitespace-only X-Tenant-ID', () => {
    const req = makeReq({ 'x-tenant-id': '   ' });
    const res = makeRes();
    const next = jest.fn();
    expect(() => middleware.use(req, res, next)).toThrow('required');
  });

  it('rejects when X-Tenant-ID is an array (multi-value header)', () => {
    const req = makeReq({ 'x-tenant-id': ['t1', 't2'] });
    const res = makeRes();
    const next = jest.fn();
    expect(() => middleware.use(req, res, next)).toThrow('required');
  });

  it('passes through valid X-Tenant-ID and calls next()', () => {
    const req = makeReq({ 'x-tenant-id': 'tenant-1', 'x-request-id': 'req-123' });
    const res = makeRes();
    const next = jest.fn();
    middleware.use(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('generates requestId when x-request-id header not provided', () => {
    const req = makeReq({ 'x-tenant-id': 'tenant-1' });
    const setHeaderMock = jest.fn();
    const res = { setHeader: setHeaderMock };
    const next = jest.fn();
    middleware.use(req, res as never, next);
    expect(setHeaderMock).toHaveBeenCalledWith('x-request-id', expect.stringMatching(/^[0-9a-f-]{36}$/));
  });
});
