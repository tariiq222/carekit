import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { GetBusinessHoursDto } from './hours.dto';

@Injectable()
export class GetBusinessHoursHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: GetBusinessHoursDto) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, tenantId: dto.tenantId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    return this.prisma.businessHour.findMany({
      where: { branchId: dto.branchId, tenantId: dto.tenantId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }
}
