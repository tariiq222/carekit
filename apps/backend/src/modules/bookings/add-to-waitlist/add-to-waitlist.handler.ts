import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { AddToWaitlistDto } from './add-to-waitlist.dto';

export type AddToWaitlistCommand = Omit<AddToWaitlistDto, 'preferredDate'> & {
  preferredDate?: Date;
};

@Injectable()
export class AddToWaitlistHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: AddToWaitlistCommand) {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    const existing = await this.prisma.waitlistEntry.findFirst({
      where: {
        clientId: cmd.clientId,
        employeeId: cmd.employeeId,
        serviceId: cmd.serviceId,
        status: 'WAITING',
      },
    });
    if (existing) throw new ConflictException('Client is already on the waitlist for this employee and service');

    return this.prisma.waitlistEntry.create({
      data: {
        organizationId,
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
