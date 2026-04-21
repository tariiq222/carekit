import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TenantContextService } from './tenant-context.service';

/**
 * Sets `app.current_org_id` on the current transaction so RLS policies see
 * the right tenant. Call this at the start of any transaction that touches
 * tenant-scoped tables once Plan 02 enables policies.
 *
 * Usage:
 *   await prisma.$transaction(async (tx) => {
 *     await rls.applyInTransaction(tx);
 *     // ... tenant-scoped queries
 *   });
 */
@Injectable()
export class RlsHelper {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContextService,
  ) {}

  async applyInTransaction(tx: {
    $executeRawUnsafe: (sql: string) => Promise<unknown>;
  }): Promise<void> {
    const orgId = this.ctx.getOrganizationId();
    if (!orgId) return; // no tenant set — leave GUC empty; Plan 02 policies allow this for system jobs.
    // SET LOCAL applies only to the current transaction. Quote the literal
    // to prevent injection — orgId is trusted (from JWT) but we defend anyway.
    const safe = orgId.replace(/'/g, "''");
    await tx.$executeRawUnsafe(`SET LOCAL app.current_org_id = '${safe}'`);
  }
}
