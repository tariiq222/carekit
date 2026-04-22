import { CallHandler, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { of } from 'rxjs';
import { SuperAdminContextInterceptor } from './super-admin-context.interceptor';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../tenant/tenant.constants';

const makeContext = (user?: { scope?: string }) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  }) as unknown as ExecutionContext;

describe('SuperAdminContextInterceptor', () => {
  const cls = {
    set: jest.fn(),
  };

  const next: CallHandler = {
    handle: jest.fn(() => of({ ok: true })),
  };

  beforeEach(() => {
    cls.set.mockReset();
    (next.handle as jest.Mock).mockClear();
  });

  it('sets the super-admin CLS flag for allowed requests', () => {
    const interceptor = new SuperAdminContextInterceptor(cls as never);
    const result = interceptor.intercept(makeContext({}), next);

    expect(cls.set).toHaveBeenCalledWith(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
    expect(next.handle).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('rejects impersonation-scoped JWTs', () => {
    const interceptor = new SuperAdminContextInterceptor(cls as never);

    expect(() =>
      interceptor.intercept(makeContext({ scope: 'impersonation' }), next),
    ).toThrow(ForbiddenException);
    expect(cls.set).not.toHaveBeenCalled();
    expect(next.handle).not.toHaveBeenCalled();
  });
});
