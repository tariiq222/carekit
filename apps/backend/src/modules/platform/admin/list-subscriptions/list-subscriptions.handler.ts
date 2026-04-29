import { Injectable } from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';

export interface ListSubscriptionsQuery {
  page: number;
  perPage: number;
  status?: SubscriptionStatus;
  planId?: string;
}

@Injectable()
export class ListSubscriptionsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(q: ListSubscriptionsQuery) {
    const where: Prisma.SubscriptionWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.planId) where.planId = q.planId;

    const [items, total] = await Promise.all([
      this.prisma.$allTenants.subscription.findMany({
        where,
        orderBy: { currentPeriodEnd: 'desc' },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        select: {
          id: true,
          organizationId: true,
          planId: true,
          status: true,
          billingCycle: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          trialEndsAt: true,
          canceledAt: true,
          pastDueSince: true,
          lastPaymentAt: true,
          lastFailureReason: true,
          createdAt: true,
          plan: { select: { slug: true, nameEn: true, priceMonthly: true } },
          organization: {
            select: {
              id: true,
              slug: true,
              nameAr: true,
              nameEn: true,
              status: true,
              suspendedAt: true,
            },
          },
        },
      }),
      this.prisma.$allTenants.subscription.count({ where }),
    ]);

    return {
      items,
      meta: {
        page: q.page,
        perPage: q.perPage,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / q.perPage),
      },
    };
  }
}
