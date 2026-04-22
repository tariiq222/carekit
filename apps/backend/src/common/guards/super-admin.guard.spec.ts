import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SuperAdminGuard } from './super-admin.guard';

const makeCtx = (user: object | undefined) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

describe('SuperAdminGuard', () => {
  it('returns true when req.user.isSuperAdmin is true', () => {
    const ctx = makeCtx({ isSuperAdmin: true });
    expect(new SuperAdminGuard().canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when isSuperAdmin is false', () => {
    const ctx = makeCtx({ isSuperAdmin: false });
    expect(() => new SuperAdminGuard().canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when isSuperAdmin is absent', () => {
    const ctx = makeCtx({ id: 'u-1' });
    expect(() => new SuperAdminGuard().canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when there is no user object', () => {
    const ctx = makeCtx(undefined);
    expect(() => new SuperAdminGuard().canActivate(ctx)).toThrow(ForbiddenException);
  });
});
