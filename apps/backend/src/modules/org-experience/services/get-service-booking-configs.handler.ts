import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface GetServiceBookingConfigsCommand {
  tenantId: string;
  serviceId: string;
}

@Injectable()
export class GetServiceBookingConfigsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: GetServiceBookingConfigsCommand) {
    const service = await this.prisma.service.findFirst({
      where: { id: cmd.serviceId, tenantId: cmd.tenantId },
    });
    if (!service) throw new NotFoundException('Service not found');

    return this.prisma.serviceBookingConfig.findMany({
      where: { serviceId: cmd.serviceId, tenantId: cmd.tenantId },
      orderBy: { bookingType: 'asc' },
    });
  }
}
