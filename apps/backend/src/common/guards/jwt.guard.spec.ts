import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtGuard } from './jwt.guard';

const makeCtx = (handler: object, cls: object) =>
  ({
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({ getRequest: () => ({}) }),
  }) as unknown as ExecutionContext;

describe('JwtGuard', () => {
  let reflector: Reflector;
  let guard: JwtGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtGuard(reflector);
  });

  it('returns true for public routes', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(true);
    expect(guard.canActivate(makeCtx({}, {}))).toBe(true);
  });

  it('handleRequest returns user when valid', () => {
    const user = { id: '1' };
    expect(guard.handleRequest(null, user)).toBe(user);
  });

  it('handleRequest throws UnauthorizedException when no user', () => {
    expect(() => guard.handleRequest(null, null)).toThrow(UnauthorizedException);
  });

  it('handleRequest throws UnauthorizedException when error present', () => {
    expect(() => guard.handleRequest(new Error('fail'), null)).toThrow(UnauthorizedException);
  });
});
