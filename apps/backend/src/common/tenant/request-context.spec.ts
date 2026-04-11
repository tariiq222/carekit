import { RequestContextStorage } from './request-context';

const ctx = { tenantId: 'clinic-x', requestId: 'req-1', ip: '127.0.0.1' };

describe('RequestContextStorage', () => {
  it('returns undefined outside of run()', () => {
    expect(RequestContextStorage.get()).toBeUndefined();
  });

  it('returns context inside run()', () => {
    RequestContextStorage.run(ctx, () => {
      expect(RequestContextStorage.get()).toEqual(ctx);
    });
  });

  it('getOrThrow throws outside of run()', () => {
    expect(() => RequestContextStorage.getOrThrow()).toThrow('RequestContext not initialized');
  });

  it('getOrThrow returns context inside run()', () => {
    RequestContextStorage.run(ctx, () => {
      expect(RequestContextStorage.getOrThrow()).toEqual(ctx);
    });
  });

  it('isolates context between concurrent runs', async () => {
    const results: string[] = [];
    await Promise.all([
      new Promise<void>((resolve) =>
        RequestContextStorage.run({ ...ctx, tenantId: 'tenant-A', requestId: 'r1' }, () => {
          setTimeout(() => {
            results.push(RequestContextStorage.get()!.tenantId);
            resolve();
          }, 10);
        }),
      ),
      new Promise<void>((resolve) =>
        RequestContextStorage.run({ ...ctx, tenantId: 'tenant-B', requestId: 'r2' }, () => {
          setTimeout(() => {
            results.push(RequestContextStorage.get()!.tenantId);
            resolve();
          }, 5);
        }),
      ),
    ]);
    expect(results).toContain('tenant-A');
    expect(results).toContain('tenant-B');
  });
});
