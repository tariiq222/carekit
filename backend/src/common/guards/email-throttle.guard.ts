import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

interface ThrottleEntry {
  count: number;
  resetAt: number;
}

const CLEANUP_INTERVAL_MS = 60_000;

/**
 * Rate limiter that throttles by email address from request body.
 * Uses a shared static Map with periodic cleanup to prevent memory leaks.
 */
@Injectable()
export class EmailThrottleGuard implements CanActivate {
  private static readonly store = new Map<string, ThrottleEntry>();
  private static lastCleanup = Date.now();
  private readonly limit: number;
  private readonly ttlMs: number;

  constructor(limit = 3, ttlMs = 60_000) {
    this.limit = limit;
    this.ttlMs = ttlMs;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const email = (request.body as Record<string, unknown>)?.email;

    if (!email || typeof email !== 'string') {
      return true;
    }

    // Periodic cleanup of expired entries
    this.cleanup();

    const key = `${request.path}:${email.toLowerCase()}`;
    const now = Date.now();
    const entry = EmailThrottleGuard.store.get(key);

    if (!entry || now >= entry.resetAt) {
      EmailThrottleGuard.store.set(key, { count: 1, resetAt: now + this.ttlMs });
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

  private cleanup(): void {
    const now = Date.now();
    if (now - EmailThrottleGuard.lastCleanup < CLEANUP_INTERVAL_MS) return;

    EmailThrottleGuard.lastCleanup = now;
    for (const [key, entry] of EmailThrottleGuard.store) {
      if (now >= entry.resetAt) {
        EmailThrottleGuard.store.delete(key);
      }
    }
  }
}
