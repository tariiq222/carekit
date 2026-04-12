import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface DeleteEmployeeCommand { tenantId: string; employeeId: string; }

@Injectable()
export class DeleteEmployeeHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: DeleteEmployeeCommand): Promise<void> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: cmd.employeeId, tenantId: cmd.tenantId },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    await this.prisma.employee.delete({ where: { id: cmd.employeeId } });
  }
}
