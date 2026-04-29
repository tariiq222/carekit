import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SuperAdminActionType } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';

export interface UpdateFeatureFlagAdminCommand {
  organizationId: string;
  key: string;
  enabled: boolean;
  superAdminUserId: string;
  reason: string;
  ipAddress: string;
  userAgent: string;
}

@Injectable()
export class UpdateFeatureFlagAdminHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpdateFeatureFlagAdminCommand) {
    return this.prisma.$allTenants.$transaction(async (tx) => {
      const organization = await tx.organization.findUnique({
        where: { id: cmd.organizationId },
        select: { id: true },
      });
      if (!organization) throw new NotFoundException('organization_not_found');

      const platformFlag = await tx.featureFlag.findFirst({
        where: { key: cmd.key, organizationId: null },
        select: {
          id: true,
          organizationId: true,
          key: true,
          enabled: true,
          allowedPlans: true,
          limitKind: true,
          nameAr: true,
          nameEn: true,
          descriptionAr: true,
          descriptionEn: true,
        },
      });
      if (!platformFlag) throw new NotFoundException('feature_flag_not_found');

      const override = await tx.featureFlag.upsert({
        where: { organizationId_key: { organizationId: cmd.organizationId, key: cmd.key } },
        create: {
          organizationId: cmd.organizationId,
          key: cmd.key,
          enabled: cmd.enabled,
          allowedPlans: platformFlag.allowedPlans,
          limitKind: platformFlag.limitKind,
          nameAr: platformFlag.nameAr,
          nameEn: platformFlag.nameEn,
          descriptionAr: platformFlag.descriptionAr,
          descriptionEn: platformFlag.descriptionEn,
        },
        update: { enabled: cmd.enabled },
      });

      await tx.superAdminActionLog.create({
        data: {
          superAdminUserId: cmd.superAdminUserId,
          actionType: SuperAdminActionType.FEATURE_FLAG_UPDATE,
          organizationId: cmd.organizationId,
          reason: cmd.reason,
          metadata: {
            key: cmd.key,
            enabled: cmd.enabled,
            platformFlagId: platformFlag.id,
            overrideId: override.id,
          } satisfies Prisma.InputJsonValue,
          ipAddress: cmd.ipAddress,
          userAgent: cmd.userAgent,
        },
      });

      return override;
    });
  }
}
