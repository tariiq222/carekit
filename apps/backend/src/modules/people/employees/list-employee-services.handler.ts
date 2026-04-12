import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface ListEmployeeServicesQuery { tenantId: string; employeeId: string; }

@Injectable()
export class ListEmployeeServicesHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListEmployeeServicesQuery) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: query.employeeId, tenantId: query.tenantId },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return this.prisma.employeeService.findMany({
      where: { employeeId: query.employeeId },
    });
  }
}
