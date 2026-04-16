import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtGuard } from './jwt.guard';

const makeCtx = (handler: object, cls: object) =>
  ({
    getHandler: () => handler,
    getClass: () => cls,
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

  it('handleRequest returns user when token is valid', () => {
    const user = { id: 'u-1' };
    expect(guard.handleRequest(null, user, null, {} as ExecutionContext)).toBe(user);
  });

  it('handleRequest throws UnauthorizedException when no user', () => {
    expect(() =>
      guard.handleRequest(null, null as never, null, {} as ExecutionContext),
    ).toThrow(UnauthorizedException);
  });

  it('handleRequest throws UnauthorizedException when error present', () => {
    expect(() =>
      guard.handleRequest(new Error('fail'), null as never, null, {} as ExecutionContext),
    ).toThrow(UnauthorizedException);
  });
});
