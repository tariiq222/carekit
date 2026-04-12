import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtGuard } from './jwt.guard';

const makeCtx = (handler: object, cls: object, headers: Record<string, string> = {}) =>
  ({
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  }) as unknown as ExecutionContext;

describe('JwtGuard', () => {
  let reflector: Reflector;
  let guard: JwtGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtGuard(reflector);
  });

  it('returns true for public routes', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    expect(guard.canActivate(makeCtx({}, {}))).toBe(true);
  });

  it('handleRequest returns user when JWT tenant matches header', () => {
    const user = { id: 'u-1', tenantId: 'tenant-a' };
    const ctx = makeCtx({}, {}, { 'x-tenant-id': 'tenant-a' });
    expect(guard.handleRequest(null, user, null, ctx)).toBe(user);
  });

  it('handleRequest trims whitespace on header before matching', () => {
    const user = { id: 'u-1', tenantId: 'tenant-a' };
    const ctx = makeCtx({}, {}, { 'x-tenant-id': '  tenant-a  ' });
    expect(guard.handleRequest(null, user, null, ctx)).toBe(user);
  });

  it('handleRequest throws ForbiddenException when header tenant differs from JWT', () => {
    const user = { id: 'u-1', tenantId: 'tenant-a' };
    const ctx = makeCtx({}, {}, { 'x-tenant-id': 'tenant-b' });
    expect(() => guard.handleRequest(null, user, null, ctx)).toThrow(ForbiddenException);
  });

  it('handleRequest throws ForbiddenException when header is missing', () => {
    const user = { id: 'u-1', tenantId: 'tenant-a' };
    const ctx = makeCtx({}, {}, {});
    expect(() => guard.handleRequest(null, user, null, ctx)).toThrow(ForbiddenException);
  });

  it('handleRequest throws UnauthorizedException when no user', () => {
    const ctx = makeCtx({}, {}, { 'x-tenant-id': 'tenant-a' });
    expect(() => guard.handleRequest(null, null as never, null, ctx)).toThrow(UnauthorizedException);
  });

  it('handleRequest throws UnauthorizedException when error present', () => {
    const ctx = makeCtx({}, {}, { 'x-tenant-id': 'tenant-a' });
    expect(() => guard.handleRequest(new Error('fail'), null as never, null, ctx)).toThrow(
      UnauthorizedException,
    );
  });
});
