import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { ArchiveServiceDto } from './service.dto';

@Injectable()
export class ArchiveServiceHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: ArchiveServiceDto) {
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, tenantId: dto.tenantId, archivedAt: null },
    });
    if (!service) throw new NotFoundException('Service not found');

    return this.prisma.service.update({
      where: { id: dto.serviceId },
      data: { archivedAt: new Date(), isActive: false },
    });
  }
}
