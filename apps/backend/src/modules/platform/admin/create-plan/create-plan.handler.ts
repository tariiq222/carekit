import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, SuperAdminActionType } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';

export interface CreatePlanCommand {
  superAdminUserId: string;
  reason: string;
  ipAddress: string;
  userAgent: string;
  data: {
    slug: string;
    nameAr: string;
    nameEn: string;
    priceMonthly: number;
    priceAnnual: number;
    currency?: string;
    limits: Record<string, unknown>;
    isActive?: boolean;
    sortOrder?: number;
  };
}

@Injectable()
export class CreatePlanHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: CreatePlanCommand) {
    return this.prisma.$allTenants.$transaction(async (tx) => {
      const existing = await tx.plan.findUnique({ where: { slug: cmd.data.slug } });
      if (existing) throw new ConflictException('plan_slug_already_exists');

      const plan = await tx.plan.create({
        data: {
          slug: cmd.data.slug,
          nameAr: cmd.data.nameAr,
          nameEn: cmd.data.nameEn,
          priceMonthly: new Prisma.Decimal(cmd.data.priceMonthly),
          priceAnnual: new Prisma.Decimal(cmd.data.priceAnnual),
          currency: cmd.data.currency ?? 'SAR',
          limits: cmd.data.limits as Prisma.InputJsonValue,
          isActive: cmd.data.isActive ?? true,
          sortOrder: cmd.data.sortOrder ?? 0,
        },
      });

      await tx.superAdminActionLog.create({
        data: {
          superAdminUserId: cmd.superAdminUserId,
          actionType: SuperAdminActionType.PLAN_CREATE,
          organizationId: null,
          reason: cmd.reason,
          metadata: { planId: plan.id, slug: plan.slug },
          ipAddress: cmd.ipAddress,
          userAgent: cmd.userAgent,
        },
      });

      return plan;
    });
  }
}
