import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface AddToWaitlistCommand {
  tenantId: string;
  clientId: string;
  employeeId: string;
  serviceId: string;
  branchId: string;
  preferredDate?: Date;
  notes?: string;
}

@Injectable()
export class AddToWaitlistHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: AddToWaitlistCommand) {
    const existing = await this.prisma.waitlistEntry.findFirst({
      where: {
        tenantId: cmd.tenantId,
        clientId: cmd.clientId,
        employeeId: cmd.employeeId,
        serviceId: cmd.serviceId,
        status: 'WAITING',
      },
    });
    if (existing) throw new ConflictException('Client is already on the waitlist for this employee and service');

    return this.prisma.waitlistEntry.create({
      data: {
        tenantId: cmd.tenantId,
        clientId: cmd.clientId,
        employeeId: cmd.employeeId,
        serviceId: cmd.serviceId,
        branchId: cmd.branchId,
        preferredDate: cmd.preferredDate,
        notes: cmd.notes,
        status: 'WAITING',
      },
    });
  }
}
