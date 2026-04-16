import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface GetEmployeeQuery {
  employeeId: string;
}

@Injectable()
export class GetEmployeeHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetEmployeeQuery) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: query.employeeId },
      include: {
        specialties: true,
        branches: true,
        services: true,
        availability: { where: { isActive: true }, orderBy: { dayOfWeek: 'asc' } },
        exceptions: { orderBy: { startDate: 'asc' } },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return employee;
  }
}
