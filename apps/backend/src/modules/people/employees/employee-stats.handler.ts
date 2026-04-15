import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export type EmployeeStatsQuery = { tenantId: string };

export interface EmployeeStatsResult {
  total: number;
  active: number;
  inactive: number;
  avgRating: number | null;
}

@Injectable()
export class EmployeeStatsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: EmployeeStatsQuery): Promise<EmployeeStatsResult> {
    const [total, active, ratingAgg] = await Promise.all([
      this.prisma.employee.count({ where: { tenantId: query.tenantId } }),
      this.prisma.employee.count({
        where: { tenantId: query.tenantId, isActive: true },
      }),
      this.prisma.rating.aggregate({
        where: { tenantId: query.tenantId },
        _avg: { score: true },
      }),
    ]);

    return {
      total,
      active,
      inactive: total - active,
      avgRating: ratingAgg._avg.score,
    };
  }
}
