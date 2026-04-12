import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface DeleteEmployeeExceptionCommand { tenantId: string; employeeId: string; exceptionId: string; }

@Injectable()
export class DeleteEmployeeExceptionHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: DeleteEmployeeExceptionCommand): Promise<void> {
    const record = await this.prisma.employeeAvailabilityException.findFirst({
      where: { id: cmd.exceptionId, employeeId: cmd.employeeId, tenantId: cmd.tenantId },
    });
    if (!record) throw new NotFoundException('Exception not found');
    await this.prisma.employeeAvailabilityException.delete({ where: { id: cmd.exceptionId } });
  }
}
