import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export type GetAvailabilityCommand = { tenantId: string; employeeId: string };

@Injectable()
export class GetAvailabilityHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: GetAvailabilityCommand) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: cmd.employeeId, tenantId: cmd.tenantId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const schedule = await this.prisma.employeeAvailability.findMany({
      where: { employeeId: cmd.employeeId, tenantId: cmd.tenantId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    return { schedule };
  }
}
