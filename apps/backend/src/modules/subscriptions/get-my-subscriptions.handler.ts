import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database';

@Injectable()
export class GetMySubscriptionsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(clientId: string) {
    const subscriptions = await this.prisma.clientSubscription.findMany({
      where: { clientId },
      include: {
        plan: {
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
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return subscriptions.map((sub) => ({
      id: sub.id,
      status: sub.status,
      benefitsUsed: sub.benefitsUsed,
      maxBenefits: sub.maxBenefits,
      startDate: sub.startDate,
      endDate: sub.endDate,
      totalPaid: Number(sub.totalPaid),
      createdAt: sub.createdAt,
      plan: {
        ...sub.plan,
        price: Number(sub.plan.price),
        benefits: sub.plan.benefits as Array<{
          type: string;
          value: number;
          serviceIds?: string[];
        }>,
      },
    }));
  }
}