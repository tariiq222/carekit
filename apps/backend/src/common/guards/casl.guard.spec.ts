import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslGuard, RequiredPermission } from './casl.guard';

const makeCtx = (user: object | undefined, required: RequiredPermission[]) => {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(required);

  return {
    reflector,
    ctx: {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext,
  };
};

describe('CaslGuard (role-aware)', () => {
  it('returns true when no permissions required', () => {
    const { reflector, ctx } = makeCtx({ role: 'EMPLOYEE', customRole: null }, []);
    expect(new CaslGuard(reflector).canActivate(ctx)).toBe(true);
  });

  it('grants SUPER_ADMIN access to anything', () => {
    const { reflector, ctx } = makeCtx(
      { role: 'SUPER_ADMIN', customRole: null },
      [{ action: 'delete', subject: 'Department' }],
    );
    expect(new CaslGuard(reflector).canActivate(ctx)).toBe(true);
  });

  it('grants ADMIN access to Department (built-in)', () => {
    const { reflector, ctx } = makeCtx(
      { role: 'ADMIN', customRole: null },
      [{ action: 'read', subject: 'Department' }],
    );
    expect(new CaslGuard(reflector).canActivate(ctx)).toBe(true);
  });

  it('grants ADMIN access to Category (built-in)', () => {
    const { reflector, ctx } = makeCtx(
      { role: 'ADMIN', customRole: null },
      [{ action: 'manage', subject: 'Category' }],
    );
    expect(new CaslGuard(reflector).canActivate(ctx)).toBe(true);
  });

  it('rejects EMPLOYEE from managing Category', () => {
    const { reflector, ctx } = makeCtx(
      { role: 'EMPLOYEE', customRole: null },
      [{ action: 'delete', subject: 'Category' }],
    );
    expect(() => new CaslGuard(reflector).canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('uses customRole permissions when present', () => {
    const { reflector, ctx } = makeCtx(
      {
        role: 'CUSTOM',
        customRole: { permissions: [{ action: 'read', subject: 'Booking' }] },
      },
      [{ action: 'read', subject: 'Booking' }],
    );
    expect(new CaslGuard(reflector).canActivate(ctx)).toBe(true);
  });

  it('throws when no user', () => {
    const { reflector, ctx } = makeCtx(undefined, [{ action: 'read', subject: 'X' }]);
    expect(() => new CaslGuard(reflector).canActivate(ctx)).toThrow(ForbiddenException);
  });
});
