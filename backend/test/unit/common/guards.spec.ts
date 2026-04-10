/**
 * Unit tests for Guards in the Common Layer.
 *
 * Covers:
 * - PermissionsGuard (src/common/guards/permissions.guard.ts)
 * - EmailThrottleGuard (src/common/guards/email-throttle.guard.ts)
 * - MetricsAuthGuard (src/common/metrics/metrics-auth.guard.ts)
 */

import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../../../src/common/decorators/check-permissions.decorator.js';
import { OTP_THROTTLE_META } from '../../../src/common/decorators/otp-throttle.decorator.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';
import { EmailThrottleGuard } from '../../../src/common/guards/email-throttle.guard.js';
import { MetricsAuthGuard } from '../../../src/common/metrics/metrics-auth.guard.js';
import { ConfigService } from '@nestjs/config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildContext(
  overrides: {
    user?: Record<string, unknown> | null;
    email?: string;
    authorization?: string;
    handler?: () => void;
    otpThrottleMeta?: unknown;
    permissionsMeta?: unknown;
  } = {},
): ExecutionContext {
  return {
    getHandler: () => overrides.handler ?? (() => {}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        user: overrides.user ?? undefined,
        body: { email: overrides.email },
        headers: {
          'user-agent': 'test-agent',
          authorization: overrides.authorization,
        },
        ip: '127.0.0.1',
      }),
      getResponse: () => ({ statusCode: 200 }),
    }),
  } as ExecutionContext;
}

// ---------------------------------------------------------------------------
// PermissionsGuard
// ---------------------------------------------------------------------------

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  it('should allow access when no permissions are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = buildContext();

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when permissions array is empty', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    const context = buildContext();

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException if user is not logged in', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([{ module: 'bookings', action: 'create' }]);
    const context = buildContext({ user: null });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if request has no user', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([{ module: 'bookings', action: 'create' }]);
    const context = buildContext();

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    try {
      guard.canActivate(context);
    } catch (err) {
      expect((err as ForbiddenException).message).toBe('Access denied');
    }
  });

  it('should throw ForbiddenException if user lacks the required permission', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([{ module: 'bookings', action: 'create' }]);
    const context = buildContext({
      user: {
        id: 'user-1',
        email: 'test@test.com',
        permissions: ['bookings:view'],
      },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    try {
      guard.canActivate(context);
    } catch (err) {
      expect((err as ForbiddenException).message).toBe(
        'You do not have permission to perform this action',
      );
    }
  });

  it('should allow access if user has the required permission', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([{ module: 'bookings', action: 'create' }]);
    const context = buildContext({
      user: {
        id: 'user-1',
        email: 'test@test.com',
        permissions: ['bookings:create'],
      },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should require ALL permissions (AND logic)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      { module: 'bookings', action: 'create' },
      { module: 'payments', action: 'view' },
    ]);
    const context = buildContext({
      user: {
        id: 'user-1',
        email: 'test@test.com',
        permissions: ['bookings:create'], // missing payments:view
      },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow access if user has ALL required permissions', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      { module: 'bookings', action: 'create' },
      { module: 'payments', action: 'view' },
    ]);
    const context = buildContext({
      user: {
        id: 'user-1',
        email: 'test@test.com',
        permissions: ['bookings:create', 'payments:view'],
      },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should handle user with undefined permissions array', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([{ module: 'bookings', action: 'create' }]);
    const context = buildContext({
      user: { id: 'user-1', email: 'test@test.com', permissions: undefined },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});

// ---------------------------------------------------------------------------
// EmailThrottleGuard
// ---------------------------------------------------------------------------

describe('EmailThrottleGuard', () => {
  let guard: EmailThrottleGuard;
  let reflector: Reflector;
  let otpThrottleService: { check: jest.Mock };
  let activityLogService: { log: jest.Mock };

  beforeEach(() => {
    reflector = new Reflector();
    otpThrottleService = { check: jest.fn() };
    activityLogService = { log: jest.fn().mockResolvedValue(undefined) };
    guard = new EmailThrottleGuard(
      reflector,
      otpThrottleService as never,
      activityLogService as never,
    );
  });

  it('should allow through when no @OtpThrottle metadata is present', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);
    const context = buildContext();

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(otpThrottleService.check).not.toHaveBeenCalled();
  });

  it('should allow within rate limit', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      routeKey: 'login',
      limit: 5,
      ttlMs: 60_000,
    });
    otpThrottleService.check.mockResolvedValue({
      allowed: true,
      remaining: 4,
    });
    const context = buildContext({ email: 'user@test.com' });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(otpThrottleService.check).toHaveBeenCalledWith(
      'user@test.com',
      'login',
      5,
      60_000,
    );
  });

  it('should block when rate limit exceeded', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      routeKey: 'otp_send',
      limit: 3,
      ttlMs: 60_000,
    });
    otpThrottleService.check.mockResolvedValue({
      allowed: false,
      remaining: 0,
    });
    const context = buildContext({ email: 'user@test.com' });

    await expect(guard.canActivate(context)).rejects.toThrow();
    expect(activityLogService.log).toHaveBeenCalled();
  });

  it('should block with lock message when locked', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      routeKey: 'otp_send',
      limit: 3,
      ttlMs: 60_000,
    });
    otpThrottleService.check.mockResolvedValue({
      allowed: false,
      remaining: 0,
      lockedUntilMs: Date.now() + 30_000,
    });
    const context = buildContext({ email: 'user@test.com' });

    await expect(guard.canActivate(context)).rejects.toThrow();
  });

  it('should allow when email is not present in body or user', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      routeKey: 'login',
      limit: 5,
      ttlMs: 60_000,
    });
    const context = buildContext({ email: undefined });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(otpThrottleService.check).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// MetricsAuthGuard
// ---------------------------------------------------------------------------

describe('MetricsAuthGuard', () => {
  let guard: MetricsAuthGuard;
  let configService: { get: jest.Mock };

  beforeEach(() => {
    configService = { get: jest.fn() };
    guard = new MetricsAuthGuard(configService as unknown as ConfigService);
  });

  it('should throw UnauthorizedException when METRICS_TOKEN is not configured', () => {
    configService.get.mockReturnValue(undefined);
    const context = buildContext();

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    try {
      guard.canActivate(context);
    } catch (err) {
      expect((err as UnauthorizedException).message).toContain(
        'not configured',
      );
    }
  });

  it('should throw UnauthorizedException when token is empty string', () => {
    configService.get.mockReturnValue('');
    const context = buildContext();

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException with wrong token', () => {
    configService.get.mockReturnValue('valid-token');
    const context = buildContext({ authorization: 'Bearer wrong-token' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    try {
      guard.canActivate(context);
    } catch (err) {
      expect((err as UnauthorizedException).message).toContain('Invalid');
    }
  });

  it('should throw UnauthorizedException without Bearer prefix', () => {
    configService.get.mockReturnValue('valid-token');
    const context = buildContext({ authorization: 'valid-token' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when no authorization header', () => {
    configService.get.mockReturnValue('valid-token');
    const context = buildContext({ authorization: undefined });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should allow access with valid metrics token', () => {
    configService.get.mockReturnValue('valid-token');
    const context = buildContext({ authorization: 'Bearer valid-token' });

    expect(guard.canActivate(context)).toBe(true);
  });
});
