import { Injectable, Logger } from '@nestjs/common';
import { SuperAdminActionType } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';
import { RedisService } from '../../../../infrastructure/cache/redis.service';

const REVOKED_TTL_SECONDS = 16 * 60;

// Sweeper — auto-ends impersonation sessions whose expiresAt has passed
// without a manual end. Runs every minute via the ops cron queue.
// Even if this never fires, JwtGuard's per-request check still rejects
// expired sessions; the sweeper just keeps the DB tidy and the audit
// trail honest.
@Injectable()
export class ExpireImpersonationSessionsCron {
  private readonly logger = new Logger(ExpireImpersonationSessionsCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async execute(): Promise<{ ended: number }> {
    const now = new Date();
    const stale = await this.prisma.impersonationSession.findMany({
      where: { endedAt: null, expiresAt: { lte: now } },
      select: { id: true, organizationId: true, superAdminUserId: true },
    });

    if (stale.length === 0) return { ended: 0 };

    for (const session of stale) {
      await this.prisma.impersonationSession.update({
        where: { id: session.id },
        data: { endedAt: now, endedReason: 'expired' },
      });
      await this.prisma.superAdminActionLog.create({
        data: {
          superAdminUserId: session.superAdminUserId,
          actionType: SuperAdminActionType.IMPERSONATE_END,
          organizationId: session.organizationId,
          impersonationSessionId: session.id,
          reason: 'Impersonation auto-expired by sweeper',
          metadata: { endedReason: 'expired' },
          ipAddress: '',
          userAgent: 'sweeper',
        },
      });
      await this.redis
        .getClient()
        .set(`impersonation-revoked:${session.id}`, '1', 'EX', REVOKED_TTL_SECONDS);
    }

    this.logger.log(`Expired ${stale.length} impersonation session(s)`);
    return { ended: stale.length };
  }
}
