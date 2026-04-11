import { BadRequestException } from '@nestjs/common';
import { TenantMiddleware } from './tenant.middleware';
import { RequestContextStorage } from './request-context';

const makeReq = (headers: Record<string, string> = {}) =>
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
