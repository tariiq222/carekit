import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';

interface ListFeatureFlagsAdminQuery {
  organizationId: string;
}

type EntitlementSource = 'PLAN' | 'ORG_OVERRIDE';

@Injectable()
export class ListFeatureFlagsAdminHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(q: ListFeatureFlagsAdminQuery) {
    const organization = await this.prisma.$allTenants.organization.findUnique({
      where: { id: q.organizationId },
      select: {
        id: true,
        subscription: {
          select: { planId: true, plan: { select: { slug: true } } },
        },
      },
    });
    if (!organization) throw new NotFoundException('organization_not_found');

    const flags = await this.prisma.$allTenants.featureFlag.findMany({
      where: { OR: [{ organizationId: null }, { organizationId: q.organizationId }] },
      orderBy: [{ key: 'asc' }, { organizationId: 'asc' }],
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
        updatedAt: true,
      },
    });

    const platformByKey = new Map(flags.filter((f) => f.organizationId === null).map((f) => [f.key, f]));
    const overrideByKey = new Map(
      flags.filter((f) => f.organizationId === q.organizationId).map((f) => [f.key, f]),
    );
    const keys = [...new Set([...platformByKey.keys(), ...overrideByKey.keys()])].sort();

    return keys.map((key) => {
      const platformFlag = platformByKey.get(key);
      const override = overrideByKey.get(key);
      const displayFlag = platformFlag ?? override;
      const planDerivedEnabled = platformFlag
        ? isAllowedByPlan(platformFlag.enabled, platformFlag.allowedPlans, organization.subscription)
        : false;
      const source: EntitlementSource = override ? 'ORG_OVERRIDE' : 'PLAN';

      return {
        id: displayFlag?.id ?? key,
        key,
        nameAr: displayFlag?.nameAr ?? key,
        nameEn: displayFlag?.nameEn ?? key,
        descriptionAr: displayFlag?.descriptionAr ?? null,
        descriptionEn: displayFlag?.descriptionEn ?? null,
        allowedPlans: displayFlag?.allowedPlans ?? [],
        limitKind: displayFlag?.limitKind ?? null,
        planDerivedEnabled,
        overrideEnabled: override?.enabled ?? null,
        enabled: override?.enabled ?? planDerivedEnabled,
        source,
        overrideUpdatedAt: override?.updatedAt ?? null,
      };
    });
  }
}

function isAllowedByPlan(
  platformEnabled: boolean,
  allowedPlans: string[],
  subscription: { planId: string; plan: { slug: string } } | null,
) {
  if (!platformEnabled) return false;
  if (allowedPlans.length === 0) return true;
  if (!subscription) return false;
  return allowedPlans.includes(subscription.planId) || allowedPlans.includes(subscription.plan.slug);
}
