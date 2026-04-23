import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap, catchError } from 'rxjs';
import { Request } from 'express';
import { ActivityAction } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RequestContextStorage } from '../http/request-context';
import { TenantContextService } from '../tenant/tenant-context.service';

/** HTTP methods considered write operations and subject to audit logging. */
const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Derives the entity name from a handler class name.
 *
 * @example
 *   CreateBookingHandler  -> 'Booking'
 *   UpdateUserHandler    -> 'User'
 *   DeleteCouponHandler  -> 'Coupon'
 *   PatchEmployeeHandler  -> 'Employee'
 */
export function deriveEntityFromHandler(handlerClassName: string): string {
  const match = handlerClassName.match(/^(Create|Update|Delete|Patch)(\w+)/);
  if (!match) return 'Unknown';
  // Strip trailing 'Handler' suffix (e.g. 'BookingHandler' -> 'Booking')
  return match[2].replace(/Handler$/, '');
}

/**
 * Maps HTTP method to ActivityAction.
 *
 * @example
 *   POST  -> CREATE
 *   PATCH -> UPDATE
 *   PUT   -> UPDATE
 *   DELETE -> DELETE
 */
export function mapMethodToAction(method: string): ActivityAction {
  switch (method) {
    case 'POST':
      return ActivityAction.CREATE;
    case 'PATCH':
    case 'PUT':
      return ActivityAction.UPDATE;
    case 'DELETE':
      return ActivityAction.DELETE;
    default:
      return ActivityAction.SYSTEM;
  }
}

interface AuditUserInfo {
  userId?: string;
  userEmail?: string;
}

/**
 * Extracts user info from RequestContextStorage first, then falls back to
 * parsing the JWT payload directly from the Authorization header.
 */
function extractUserFromContext(req: Request): AuditUserInfo {
  const ctx = RequestContextStorage.get();
  if (ctx?.userId) {
    return { userId: ctx.userId };
  }

  // Fallback: parse JWT from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return {};

  try {
    const token = authHeader.slice(7);
    const payload = parseJwtPayload(token);
    return {
      userId: payload.sub ?? payload.userId,
      userEmail: payload.email,
    };
  } catch {
    return {};
  }
}

/** Minimal JWT payload parser - avoids adding a jwt decode dependency. */
function parseJwtPayload(token: string): Record<string, string> {
  const parts = token.split('.');
  if (parts.length !== 3) return {};
  try {
    const raw = Buffer.from(parts[1], 'base64url').toString('utf-8');
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * AuditInterceptor - automatically records every write operation (POST, PATCH,
 * PUT, DELETE) to the ActivityLog table.
 *
 * Design decisions:
 * - Only intercepts write methods; GET/OPTIONS/HEAD pass through untouched.
 * - Entity name is derived from the handler class name (e.g. CreateBookingHandler
 *   -> entity="Booking", action=CREATE).
 * - User context is pulled first from RequestContextStorage, then from the JWT.
 * - Silently fails: logging errors are caught and logged but do NOT propagate,
 *   ensuring audit failures never break the request.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const method = req.method.toUpperCase();

    // Skip non-write methods
    if (!WRITE_METHODS.has(method)) {
      return next.handle();
    }

    const handlerName = ctx.getHandler().name;
    const controllerName = ctx.getClass().name;
    const entity = deriveEntityFromHandler(controllerName);
    const action = mapMethodToAction(method);
    const { userId, userEmail } = extractUserFromContext(req);
    const path = req.originalUrl ?? req.url;
    const ipAddress = req.ip ?? req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const metadata: Record<string, string> = {
      httpMethod: method,
      path,
      handlerName,
    };

    return next.handle().pipe(
      tap(async (response) => {
        try {
          const organizationId = this.tenant.requireOrganizationIdOrDefault();
          const entityId = extractEntityId(response);
          await this.prisma.activityLog.create({
            data: {
              organizationId,
              userId,
              userEmail,
              action,
              entity,
              entityId,
              description: buildDescription(method, entity, entityId),
              metadata: metadata as never,
              ipAddress,
              userAgent,
            },
          });
        } catch (err) {
          this.logger.error(
            'AuditInterceptor: failed to log activity',
            err instanceof Error ? err.message : String(err),
          );
        }
      }),
      catchError((err) => {
        // Still log failures so audit trail captures attempted mutations
        this.logAsync(method, entity, userId, userEmail, metadata, ipAddress, userAgent).catch(
          (logErr) => {
            this.logger.error(
              'AuditInterceptor: failed to log error activity',
              logErr instanceof Error ? logErr.message : String(logErr),
            );
          },
        );
        throw err;
      }),
    );
  }

  private async logAsync(
    method: string,
    entity: string,
    userId?: string,
    userEmail?: string,
    metadata?: Record<string, string>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      const organizationId = this.tenant.requireOrganizationIdOrDefault();
      await this.prisma.activityLog.create({
        data: {
          organizationId,
          userId,
          userEmail,
          action: mapMethodToAction(method),
          entity,
          description: buildDescription(method, entity),
          metadata: metadata as never,
          ipAddress,
          userAgent,
        },
      });
    } catch {
      // Silent - already logged in caller
    }
  }
}

/** Attempts to pull entityId from a known response shape. */
function extractEntityId(response: unknown): string | undefined {
  if (!response || typeof response !== 'object') return undefined;
  const obj = response as Record<string, unknown>;
  if (typeof obj.id === 'string') return obj.id;
  if (obj.data && typeof obj.data === 'object') {
    const data = obj.data as Record<string, unknown>;
    if (typeof data.id === 'string') return data.id;
  }
  return undefined;
}

/** Human-readable description for the activity log. */
function buildDescription(method: string, entity: string, entityId?: string): string {
  const id = entityId ? ` (${entityId})` : '';
  return `${method} ${entity}${id}`;
}
