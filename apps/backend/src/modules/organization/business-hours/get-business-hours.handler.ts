import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface GetBusinessHoursQuery {
  tenantId: string;
  branchId: string;
}

@Injectable()
export class GetBusinessHoursHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetBusinessHoursQuery) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: query.branchId, tenantId: query.tenantId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    return this.prisma.businessHour.findMany({
      where: { branchId: query.branchId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }
}
