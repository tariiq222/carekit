// Usage: add to PrismaService.$use(slowQueryMiddleware)
//
// In PrismaService (backend/src/database/prisma.service.ts):
//   import { slowQueryMiddleware } from '../../performance/db/prisma-query-logger.js';
//   this.$use(slowQueryMiddleware);

import { Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

const logger = new Logger('SlowQuery');

/** Threshold in ms: queries above this are logged as WARN */
const WARN_THRESHOLD_MS = 100;

/** Threshold in ms: queries above this are logged as ERROR with full query detail */
const ERROR_THRESHOLD_MS = 500;

/** Truncate query strings in logs to avoid flooding log pipelines */
const MAX_QUERY_LENGTH = 300;

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function formatArgs(args: Prisma.MiddlewareParams['args']): string {
  try {
    return truncate(JSON.stringify(args), MAX_QUERY_LENGTH);
  } catch {
    return '[unserializable]';
  }
}

/**
 * Prisma middleware that measures query execution time and logs slow queries.
 *
 * Slow = > 100 ms  → WARN  (model + action + duration)
 * Very slow = > 500 ms → ERROR (adds full args for investigation)
 *
 * Attach once in PrismaService.onModuleInit():
 *   this.$use(slowQueryMiddleware);
 */
export const slowQueryMiddleware: Prisma.Middleware = async (
  params: Prisma.MiddlewareParams,
  next: (params: Prisma.MiddlewareParams) => Promise<unknown>,
): Promise<unknown> => {
  const start = Date.now();

  try {
    const result = await next(params);
    const durationMs = Date.now() - start;

    if (durationMs >= ERROR_THRESHOLD_MS) {
      logger.error(
        `VERY SLOW QUERY [${durationMs}ms] ${params.model}.${params.action} | args: ${formatArgs(params.args)}`,
      );
    } else if (durationMs >= WARN_THRESHOLD_MS) {
      logger.warn(
        `Slow query [${durationMs}ms] ${params.model}.${params.action}`,
      );
    }

    return result;
  } catch (err: unknown) {
    // Re-throw so Prisma error handling stays intact; log duration on failure too
    const durationMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      `Query FAILED [${durationMs}ms] ${params.model}.${params.action} — ${message}`,
    );
    throw err;
  }
};

/**
 * Factory variant: create middleware with custom thresholds (useful in tests).
 *
 * @example
 *   this.$use(createSlowQueryMiddleware({ warnMs: 50, errorMs: 200 }));
 */
export function createSlowQueryMiddleware(opts: {
  warnMs?: number;
  errorMs?: number;
}): Prisma.Middleware {
  const warnMs  = opts.warnMs  ?? WARN_THRESHOLD_MS;
  const errorMs = opts.errorMs ?? ERROR_THRESHOLD_MS;

  return async (
    params: Prisma.MiddlewareParams,
    next: (params: Prisma.MiddlewareParams) => Promise<unknown>,
  ): Promise<unknown> => {
    const start = Date.now();

    try {
      const result = await next(params);
      const ms = Date.now() - start;

      if (ms >= errorMs) {
        logger.error(`VERY SLOW [${ms}ms] ${params.model}.${params.action} | args: ${formatArgs(params.args)}`);
      } else if (ms >= warnMs) {
        logger.warn(`Slow [${ms}ms] ${params.model}.${params.action}`);
      }

      return result;
    } catch (err: unknown) {
      const ms = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`FAILED [${ms}ms] ${params.model}.${params.action} — ${message}`);
      throw err;
    }
  };
}
