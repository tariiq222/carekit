import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslGuard, buildAbilityFor, RequiredPermission } from './casl.guard';

const makeCtx = (user: object | undefined, permissions: RequiredPermission[]) => {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(permissions);

  return {
    reflector,
    ctx: {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext,
  };
};

describe('buildAbilityFor', () => {
  it('grants declared permissions', () => {
    const ability = buildAbilityFor({ permissions: [{ action: 'read', subject: 'Patient' }] });
    expect(ability.can('read', 'Patient')).toBe(true);
    expect(ability.can('delete', 'Patient')).toBe(false);
  });

  it('grants manage as wildcard', () => {
    const ability = buildAbilityFor({ permissions: [{ action: 'manage', subject: 'all' }] });
    expect(ability.can('delete', 'Booking')).toBe(true);
  });
});

describe('CaslGuard', () => {
  it('returns true when no permissions required', () => {
    const { reflector, ctx } = makeCtx({ permissions: [] }, []);
    const guard = new CaslGuard(reflector);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('returns true when user has required permission', () => {
    const { reflector, ctx } = makeCtx(
      { permissions: [{ action: 'read', subject: 'Booking' }] },
      [{ action: 'read', subject: 'Booking' }],
    );
    const guard = new CaslGuard(reflector);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when permission missing', () => {
    const { reflector, ctx } = makeCtx(
      { permissions: [] },
      [{ action: 'delete', subject: 'Booking' }],
    );
    const guard = new CaslGuard(reflector);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when no user', () => {
    const { reflector, ctx } = makeCtx(undefined, [{ action: 'read', subject: 'X' }]);
    const guard = new CaslGuard(reflector);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
