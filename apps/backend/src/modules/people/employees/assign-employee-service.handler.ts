import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface AssignEmployeeServiceCommand { tenantId: string; employeeId: string; serviceId: string; }

@Injectable()
export class AssignEmployeeServiceHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: AssignEmployeeServiceCommand) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: cmd.employeeId, tenantId: cmd.tenantId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const existing = await this.prisma.employeeService.findUnique({
      where: { employeeId_serviceId: { employeeId: cmd.employeeId, serviceId: cmd.serviceId } },
    });
    if (existing) throw new ConflictException('Service already assigned to employee');

    return this.prisma.employeeService.create({
      data: { tenantId: cmd.tenantId, employeeId: cmd.employeeId, serviceId: cmd.serviceId },
    });
  }
}
