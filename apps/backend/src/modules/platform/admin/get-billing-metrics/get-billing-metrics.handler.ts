import { Injectable } from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';

export interface BillingMetrics {
  mrr: string;
  arr: string;
  currency: string;
  counts: Record<SubscriptionStatus, number>;
  churn30d: number;
  byPlan: Array<{ planId: string; planSlug: string; activeCount: number; mrr: string }>;
}

@Injectable()
export class GetBillingMetricsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<BillingMetrics> {
    const subs = await this.prisma.$allTenants.subscription.findMany({
      where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] } },
      select: {
        planId: true,
        plan: { select: { slug: true, priceMonthly: true } },
      },
    });

    let mrr = new Prisma.Decimal(0);
    const planAgg = new Map<
      string,
      { planSlug: string; activeCount: number; mrr: Prisma.Decimal }
    >();
    for (const s of subs) {
      const price = new Prisma.Decimal(s.plan.priceMonthly);
      mrr = mrr.add(price);
      const existing = planAgg.get(s.planId);
      if (existing) {
        existing.activeCount += 1;
        existing.mrr = existing.mrr.add(price);
      } else {
        planAgg.set(s.planId, { planSlug: s.plan.slug, activeCount: 1, mrr: price });
      }
    }

    const counts = await this.prisma.$allTenants.subscription.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const countsByStatus = Object.fromEntries(
      Object.values(SubscriptionStatus).map((s) => [s, 0]),
    ) as Record<SubscriptionStatus, number>;
    for (const row of counts) countsByStatus[row.status] = row._count._all;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const churn30d = await this.prisma.$allTenants.subscription.count({
      where: { status: SubscriptionStatus.CANCELED, canceledAt: { gte: thirtyDaysAgo } },
    });

    return {
      mrr: mrr.toFixed(2),
      arr: mrr.mul(12).toFixed(2),
      currency: 'SAR',
      counts: countsByStatus,
      churn30d,
      byPlan: Array.from(planAgg.entries()).map(([planId, v]) => ({
        planId,
        planSlug: v.planSlug,
        activeCount: v.activeCount,
        mrr: v.mrr.toFixed(2),
      })),
    };
  }
}
