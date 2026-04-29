import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BillingCycle,
  Prisma,
  SubscriptionStatus,
  SuperAdminActionType,
} from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';

export interface CreateTenantCommand {
  slug: string;
  nameAr: string;
  nameEn?: string;
  ownerUserId: string;
  verticalSlug?: string;
  planId?: string;
  billingCycle?: 'MONTHLY' | 'ANNUAL';
  trialDays?: number;
  superAdminUserId: string;
  reason: string;
  ipAddress: string;
  userAgent: string;
}

const DAY_MS = 86_400_000;

@Injectable()
export class CreateTenantHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: CreateTenantCommand) {
    return this.prisma.$allTenants.$transaction(async (tx) => {
      const existing = await tx.organization.findUnique({
        where: { slug: cmd.slug },
        select: { id: true },
      });
      if (existing) throw new ConflictException('organization_slug_already_exists');

      const owner = await tx.user.findUnique({
        where: { id: cmd.ownerUserId },
        select: { id: true, isActive: true },
      });
      if (!owner || !owner.isActive) throw new NotFoundException('owner_user_not_found');

      const vertical = cmd.verticalSlug
        ? await tx.vertical.findFirst({
            where: { slug: cmd.verticalSlug, isActive: true },
            select: {
              id: true,
              slug: true,
              seedDepartments: {
                select: { nameAr: true, nameEn: true, sortOrder: true },
              },
              seedServiceCategories: {
                select: { nameAr: true, nameEn: true, sortOrder: true },
              },
            },
          })
        : null;
      if (cmd.verticalSlug && !vertical) throw new NotFoundException('vertical_not_found');

      const plan = cmd.planId
        ? await tx.plan.findUnique({
            where: { id: cmd.planId },
            select: { id: true, slug: true, isActive: true },
          })
        : null;
      if (cmd.planId && !plan) throw new NotFoundException('plan_not_found');
      if (plan && !plan.isActive) throw new ConflictException('plan_inactive');

      const now = new Date();
      const trialDays = cmd.trialDays ?? (plan ? 14 : 0);
      const trialEndsAt = trialDays > 0 ? new Date(now.getTime() + trialDays * DAY_MS) : null;
      const billingCycle = (cmd.billingCycle ?? 'MONTHLY') as BillingCycle;

      const organization = await tx.organization.create({
        data: {
          slug: cmd.slug,
          nameAr: cmd.nameAr,
          nameEn: cmd.nameEn,
          status: plan ? 'TRIALING' : 'ACTIVE',
          verticalId: vertical?.id,
          trialEndsAt,
          onboardingCompletedAt: now,
        },
        select: {
          id: true,
          slug: true,
          nameAr: true,
          nameEn: true,
          status: true,
          verticalId: true,
          trialEndsAt: true,
          onboardingCompletedAt: true,
        },
      });

      await tx.membership.create({
        data: {
          organizationId: organization.id,
          userId: owner.id,
          role: 'OWNER',
          isActive: true,
          acceptedAt: now,
        },
      });

      await tx.brandingConfig.create({
        data: {
          organizationId: organization.id,
          organizationNameAr: cmd.nameAr,
          organizationNameEn: cmd.nameEn,
        },
      });

      await tx.organizationSettings.create({
        data: {
          organizationId: organization.id,
          companyNameAr: cmd.nameAr,
          companyNameEn: cmd.nameEn,
        },
      });

      for (const seed of vertical?.seedDepartments ?? []) {
        await tx.department.create({
          data: {
            organizationId: organization.id,
            nameAr: seed.nameAr,
            nameEn: seed.nameEn ?? undefined,
            sortOrder: seed.sortOrder,
          },
        });
      }

      for (const seed of vertical?.seedServiceCategories ?? []) {
        await tx.serviceCategory.create({
          data: {
            organizationId: organization.id,
            nameAr: seed.nameAr,
            nameEn: seed.nameEn ?? undefined,
            sortOrder: seed.sortOrder,
          },
        });
      }

      let subscriptionId: string | null = null;
      if (plan) {
        const periodEnd =
          billingCycle === 'ANNUAL'
            ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
            : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
        const subscription = await tx.subscription.create({
          data: {
            organizationId: organization.id,
            planId: plan.id,
            status: SubscriptionStatus.TRIALING,
            billingCycle,
            trialEndsAt,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
          select: { id: true },
        });
        subscriptionId = subscription.id;
      }

      await tx.superAdminActionLog.create({
        data: {
          superAdminUserId: cmd.superAdminUserId,
          actionType: SuperAdminActionType.TENANT_CREATE,
          organizationId: organization.id,
          reason: cmd.reason,
          metadata: {
            slug: cmd.slug,
            ownerUserId: owner.id,
            verticalSlug: vertical?.slug ?? null,
            planId: plan?.id ?? null,
            planSlug: plan?.slug ?? null,
            subscriptionId,
          } satisfies Prisma.InputJsonValue,
          ipAddress: cmd.ipAddress,
          userAgent: cmd.userAgent,
        },
      });

      return organization;
    });
  }
}
