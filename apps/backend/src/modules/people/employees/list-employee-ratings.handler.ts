import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface ListEmployeeRatingsQuery { tenantId: string; employeeId: string; }

@Injectable()
export class ListEmployeeRatingsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListEmployeeRatingsQuery) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: query.employeeId, tenantId: query.tenantId },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return this.prisma.rating.findMany({
      where: { employeeId: query.employeeId, tenantId: query.tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
