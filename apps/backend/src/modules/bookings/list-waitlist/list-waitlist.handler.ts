import { Injectable } from '@nestjs/common';
import { WaitlistStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { ListWaitlistDto } from './list-waitlist.dto';

export type ListWaitlistQuery = ListWaitlistDto;

@Injectable()
export class ListWaitlistHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(query: ListWaitlistQuery) {
    const organizationId = this.tenant.requireOrganizationId();
    return this.prisma.waitlistEntry.findMany({
      where: {
        organizationId,
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        ...(query.status ? { status: query.status as WaitlistStatus } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
