import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';

export interface BookingsStatsResult {
  todayCount: number;
  pendingCount: number;
  completedToday: number;
  revenueToday: number;
}

@Injectable()
export class BookingsStatsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(): Promise<BookingsStatsResult> {
    const organizationId = this.tenant.requireOrganizationId();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const todayRange = { gte: startOfDay, lt: endOfDay };

    const [todayCount, pendingCount, completedToday, revenueAgg] = await Promise.all([
      this.prisma.booking.count({ where: { organizationId, scheduledAt: todayRange } }),
      this.prisma.booking.count({ where: { organizationId, status: { in: ['PENDING', 'AWAITING_PAYMENT', 'CONFIRMED'] } } }),
      this.prisma.booking.count({ where: { organizationId, status: 'COMPLETED', scheduledAt: todayRange } }),
      this.prisma.booking.aggregate({
        where: { organizationId, status: 'COMPLETED', scheduledAt: todayRange },
        _sum: { price: true },
      }),
    ]);

    // price is Decimal — convert to number. Runtime convention is halalas-as-
    // Decimal (see docs/superpowers/tech-debt/price-units-*), so divide by 100
    // before returning SAR. TODO(price-units): remove /100 after unification.
    const rawRevenue = revenueAgg._sum.price;
    const revenueSarMajor = rawRevenue instanceof Prisma.Decimal
      ? rawRevenue.toNumber() / 100
      : Number(rawRevenue ?? 0) / 100;

    return {
      todayCount,
      pendingCount,
      completedToday,
      revenueToday: Math.round(revenueSarMajor * 100) / 100,
    };
  }
}
