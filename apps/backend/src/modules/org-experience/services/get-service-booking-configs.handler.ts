import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';

export interface GetServiceBookingConfigsCommand {
  serviceId: string;
}

@Injectable()
export class GetServiceBookingConfigsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: GetServiceBookingConfigsCommand) {
    const organizationId = this.tenant.requireOrganizationId();
    const service = await this.prisma.service.findFirst({
      where: { id: cmd.serviceId, organizationId },
    });
    if (!service) throw new NotFoundException('Service not found');

    return this.prisma.serviceBookingConfig.findMany({
      where: { serviceId: cmd.serviceId },
      orderBy: { bookingType: 'asc' },
    });
  }
}
