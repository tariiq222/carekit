import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';

interface ThrottleEntry {
  count: number;
  resetAt: number;
}

/**
 * Custom rate limiter that throttles by email address from request body.
 * Used on OTP and forgot-password endpoints where rate limiting should
 * be per-email rather than per-IP.
 */
@Injectable()
export class EmailThrottleGuard implements CanActivate {
  private readonly store = new Map<string, ThrottleEntry>();
  private readonly limit: number;
  private readonly ttlMs: number;

  constructor(limit = 3, ttlMs = 60000) {
    this.limit = limit;
    this.ttlMs = ttlMs;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const email = (request.body as Record<string, unknown>)?.email;

    // If no email in body, let the request through (validation will catch it)
    if (!email || typeof email !== 'string') {
      return true;
    }

    const key = `${request.path}:${email.toLowerCase()}`;
    const now = Date.now();

    const entry = this.store.get(key);

    if (!entry || now >= entry.resetAt) {
      // First request or window expired
      this.store.set(key, { count: 1, resetAt: now + this.ttlMs });
      return true;
    }

    if (entry.count >= this.limit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please try again later.',
          error: 'RATE_LIMIT_EXCEEDED',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    entry.count++;
    return true;
  }
}
