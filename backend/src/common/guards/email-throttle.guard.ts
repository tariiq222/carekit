import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { OtpThrottleRedisService } from '../services/otp-throttle-redis.service.js';
import { ActivityLogService } from '../../modules/activity-log/activity-log.service.js';
import {
  OTP_THROTTLE_META,
  type OtpThrottleMeta,
} from '../decorators/otp-throttle.decorator.js';

interface RequestUser {
  email?: string;
  id?: string;
}

/**
 * Guard that enforces per-email OTP rate limiting using Redis.
 * Reads configuration from @OtpThrottle() decorator metadata.
 * If no metadata is present, the guard allows the request through.
 */
@Injectable()
export class EmailThrottleGuard implements CanActivate {
  private readonly logger = new Logger(EmailThrottleGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly otpThrottle: OtpThrottleRedisService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.get<OtpThrottleMeta | undefined>(
      OTP_THROTTLE_META,
      context.getHandler(),
    );

    // No @OtpThrottle metadata — allow through
    if (!meta) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const body = request.body as Record<string, unknown>;
    const user = (request as Request & { user?: RequestUser }).user;

    const email = (body?.email as string) ?? user?.email;
    if (!email || typeof email !== 'string') return true;

    const { routeKey, limit, ttlMs } = meta;
    const result = await this.otpThrottle.check(email, routeKey, limit, ttlMs);

    if (!result.allowed) {
      const isLocked = result.lockedUntilMs !== undefined;

      // Fire-and-forget activity log
      this.activityLog
        .log({
          userId: user?.id,
          action: isLocked ? 'OTP_EMAIL_LOCKED' : 'OTP_RATE_LIMIT_EXCEEDED',
          module: 'auth',
          description: `Rate limit hit for ${routeKey} by ${email}`,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        })
        .catch((err) =>
          this.logger.warn('Failed to log rate limit event', err),
        );

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: isLocked
            ? 'Account temporarily locked due to repeated violations. Try again later.'
            : 'Too many requests. Please try again later.',
          error: isLocked ? 'OTP_EMAIL_LOCKED' : 'OTP_RATE_LIMIT_EXCEEDED',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
