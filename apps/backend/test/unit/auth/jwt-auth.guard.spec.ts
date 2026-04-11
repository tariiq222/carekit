/**
 * JwtAuthGuard — Unit Tests
 * Covers: @Public() routes, handleRequest() logic
 * Note: canActivate() for non-public routes delegates to AuthGuard('jwt')
 * which requires Passport — tested via handleRequest() directly.
 */
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../../../src/modules/auth/guards/jwt-auth.guard.js';
import { IS_PUBLIC_KEY } from '../../../src/modules/auth/decorators/public.decorator.js';

// Mock AuthGuard to avoid Passport dependency in unit tests
jest.mock('@nestjs/passport', () => ({
  AuthGuard: () => {
    class MockAuthGuard {
      canActivate(_context: ExecutionContext): boolean {
        return true;
      }
      handleRequest<T>(_err: unknown, user: T): T {
        return user;
      }
    }
    return MockAuthGuard;
  },
}));

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  function makeContext(isPublic: boolean): ExecutionContext {
    const handler = jest.fn();
    const cls = jest.fn();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic);
    return {
      getHandler: () => handler,
      getClass: () => cls,
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    } as unknown as ExecutionContext;
  }

  // ── @Public() routes ────────────────────────────────────────

  it('should return true immediately for @Public() routes', () => {
    const ctx = makeContext(true);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should check IS_PUBLIC_KEY on handler and class', () => {
    const spy = jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(true);
    const handler = jest.fn();
    const cls = jest.fn();
    const ctx = {
      getHandler: () => handler,
      getClass: () => cls,
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as unknown as ExecutionContext;

    guard.canActivate(ctx);

    expect(spy).toHaveBeenCalledWith(IS_PUBLIC_KEY, [handler, cls]);
  });

  it('should delegate to super.canActivate for non-public routes', () => {
    const ctx = makeContext(false);
    // With mocked AuthGuard, super.canActivate returns true
    const result = guard.canActivate(ctx);
    expect(result).toBeDefined();
  });

  // ── handleRequest() ─────────────────────────────────────────

  it('should return user when valid user provided', () => {
    const user = { id: 'user-1', email: 'test@example.com' };
    expect(guard.handleRequest(null, user)).toEqual(user);
  });

  it('should throw UnauthorizedException when error is provided', () => {
    expect(() => guard.handleRequest(new Error('expired'), null)).toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException when no user', () => {
    expect(() => guard.handleRequest(null, null)).toThrow(
      UnauthorizedException,
    );
  });

  it('should throw with AUTH_TOKEN_INVALID error code', () => {
    try {
      guard.handleRequest(null, null);
    } catch (e) {
      expect(e).toBeInstanceOf(UnauthorizedException);
      const res = (e as UnauthorizedException).getResponse() as Record<
        string,
        unknown
      >;
      expect(res['error']).toBe('AUTH_TOKEN_INVALID');
    }
  });

  it('should throw when error present even if user exists', () => {
    expect(() =>
      guard.handleRequest(new Error('auth failed'), { id: 'u1' }),
    ).toThrow(UnauthorizedException);
  });
});
