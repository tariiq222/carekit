import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SuperAdminActionType } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';

export interface UpdatePlanCommand {
  planId: string;
  superAdminUserId: string;
  reason: string;
  ipAddress: string;
  userAgent: string;
  data: {
    nameAr?: string;
    nameEn?: string;
    priceMonthly?: number;
    priceAnnual?: number;
    currency?: string;
    limits?: Record<string, unknown>;
    isActive?: boolean;
    sortOrder?: number;
  };
}

@Injectable()
export class UpdatePlanHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpdatePlanCommand) {
    return this.prisma.$allTenants.$transaction(async (tx) => {
      const existing = await tx.plan.findUnique({ where: { id: cmd.planId } });
      if (!existing) throw new NotFoundException('plan_not_found');

      const updateData: Prisma.PlanUpdateInput = {};
      if (cmd.data.nameAr !== undefined) updateData.nameAr = cmd.data.nameAr;
      if (cmd.data.nameEn !== undefined) updateData.nameEn = cmd.data.nameEn;
      if (cmd.data.priceMonthly !== undefined) updateData.priceMonthly = new Prisma.Decimal(cmd.data.priceMonthly);
      if (cmd.data.priceAnnual !== undefined) updateData.priceAnnual = new Prisma.Decimal(cmd.data.priceAnnual);
      if (cmd.data.currency !== undefined) updateData.currency = cmd.data.currency;
      if (cmd.data.limits !== undefined) updateData.limits = cmd.data.limits as Prisma.InputJsonValue;
      if (cmd.data.isActive !== undefined) updateData.isActive = cmd.data.isActive;
      if (cmd.data.sortOrder !== undefined) updateData.sortOrder = cmd.data.sortOrder;

      const updated = await tx.plan.update({ where: { id: cmd.planId }, data: updateData });

      await tx.superAdminActionLog.create({
        data: {
          superAdminUserId: cmd.superAdminUserId,
          actionType: SuperAdminActionType.PLAN_UPDATE,
          organizationId: null,
          reason: cmd.reason,
          metadata: { planId: cmd.planId, changedFields: Object.keys(updateData) },
          ipAddress: cmd.ipAddress,
          userAgent: cmd.userAgent,
        },
      });

      return updated;
    });
  }
}
