import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Sets the `app.current_org_id` GUC for the lifetime of the next handler call,
 * so Postgres RLS policies see the correct tenant on every query — not only on
 * those wrapped in $transaction + RlsHelper.applyInTransaction.
 *
 * Implementation: each authenticated request runs inside a single Prisma
 * `$transaction` whose first statement is `set_config('app.current_org_id', ...)`.
 * The handler's awaited promise becomes the transaction body via the rxjs
 * `from(...)` bridge.
 *
 * NB: This is intentionally a no-op when no tenant context is present. The
 * RLS policies fail-closed on missing GUC (post 2026-05-09 hardening), so
 * routes that legitimately need cross-tenant reach (super-admin, cron,
 * webhook) must explicitly use `RlsHelper.runWithoutTenant`.
 */
@Injectable()
export class TenantGucInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContextService,
  ) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const orgId = this.ctx.getOrganizationId();
    if (!orgId || !UUID_RE.test(orgId)) {
      // No tenant — let the handler run; scoped queries will throw via the
      // tenant-scoping extension (strict mode) or fall through (off mode).
      return next.handle();
    }
    return from(
      this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT set_config('app.current_org_id', ${orgId}, true)`,
        );
        return next.handle().toPromise();
      }),
    ).pipe(switchMap((value) => from(Promise.resolve(value))));
  }
}
