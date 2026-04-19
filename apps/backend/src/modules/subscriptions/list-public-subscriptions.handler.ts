import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database';

@Injectable()
export class ListPublicSubscriptionsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(branchId?: string) {
    const where: Record<string, unknown> = {
      isPublic: true,
      isActive: true,
    };

    if (branchId) {
      where.branchId = branchId;
    }

    const plans = await this.prisma.subscriptionPlan.findMany({
      where,
      orderBy: { price: 'asc' },
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
        descriptionAr: true,
        descriptionEn: true,
        price: true,
        currency: true,
        durationDays: true,
        benefits: true,
      },
    });

    return plans.map((plan) => ({
      ...plan,
      price: Number(plan.price),
      benefits: plan.benefits as Array<{
        type: string;
        value: number;
        serviceIds?: string[];
      }>,
    }));
  }
}