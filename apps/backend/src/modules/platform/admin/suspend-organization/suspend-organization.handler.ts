import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SuperAdminActionType } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';
import { RedisService } from '../../../../infrastructure/cache';

export interface SuspendOrganizationCommand {
  organizationId: string;
  superAdminUserId: string;
  reason: string;
  ipAddress: string;
  userAgent: string;
}

@Injectable()
export class SuspendOrganizationHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async execute(cmd: SuspendOrganizationCommand) {
    await this.prisma.$allTenants.$transaction(async (tx) => {
      const org = await tx.organization.findUnique({
        where: { id: cmd.organizationId },
        select: { id: true, suspendedAt: true },
      });
      if (!org) throw new NotFoundException('organization_not_found');
      if (org.suspendedAt) throw new ConflictException('organization_already_suspended');

      const now = new Date();
      await tx.organization.update({
        where: { id: cmd.organizationId },
        data: {
          suspendedAt: now,
          suspendedReason: cmd.reason,
          status: 'SUSPENDED',
        },
      });

      const refreshTokens = await tx.refreshToken.updateMany({
        where: { organizationId: cmd.organizationId, revokedAt: null },
        data: { revokedAt: now },
      });
      const impersonationSessions = await tx.impersonationSession.updateMany({
        where: { organizationId: cmd.organizationId, endedAt: null },
        data: { endedAt: now, endedReason: 'organization_suspended' },
      });

      await tx.superAdminActionLog.create({
        data: {
          superAdminUserId: cmd.superAdminUserId,
          actionType: SuperAdminActionType.SUSPEND_ORG,
          organizationId: cmd.organizationId,
          reason: cmd.reason,
          metadata: {
            refreshTokensRevoked: refreshTokens.count,
            impersonationSessionsEnded: impersonationSessions.count,
          } satisfies Prisma.InputJsonValue,
          ipAddress: cmd.ipAddress,
          userAgent: cmd.userAgent,
        },
      });
    });

    // Invalidate JwtGuard's suspension cache so the 30s staleness window
    // closes immediately for already-issued JWTs bound to this org.
    await this.redis.getClient().del(`org-suspension:${cmd.organizationId}`);
  }
}
