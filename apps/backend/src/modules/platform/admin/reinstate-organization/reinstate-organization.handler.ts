import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationStatus, SuperAdminActionType } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';
import { RedisService } from '../../../../infrastructure/cache';

export interface ReinstateOrganizationCommand {
  organizationId: string;
  superAdminUserId: string;
  reason?: string;
  ipAddress: string;
  userAgent: string;
}

@Injectable()
export class ReinstateOrganizationHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async execute(cmd: ReinstateOrganizationCommand) {
    await this.prisma.$allTenants.$transaction(async (tx) => {
      const org = await tx.organization.findUnique({
        where: { id: cmd.organizationId },
        select: { id: true, status: true, suspendedAt: true },
      });
      if (!org) throw new NotFoundException('organization_not_found');
      if (org.status === OrganizationStatus.ARCHIVED) {
        throw new ConflictException('organization_archived');
      }
      if (!org.suspendedAt) throw new ConflictException('organization_not_suspended');

      await tx.organization.update({
        where: { id: cmd.organizationId },
        data: {
          suspendedAt: null,
          suspendedReason: null,
          status: 'ACTIVE',
        },
      });

      await tx.superAdminActionLog.create({
        data: {
          superAdminUserId: cmd.superAdminUserId,
          actionType: SuperAdminActionType.REINSTATE_ORG,
          organizationId: cmd.organizationId,
          reason: cmd.reason ?? 'Reinstated by super-admin',
          metadata: {},
          ipAddress: cmd.ipAddress,
          userAgent: cmd.userAgent,
        },
      });
    });

    await this.redis.getClient().del(`org-suspension:${cmd.organizationId}`);
  }
}
