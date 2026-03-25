import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { SetDurationOptionsDto } from './dto/set-duration-options.dto.js';

@Injectable()
export class DurationOptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDurationOptions(serviceId: string) {
    await this.ensureServiceExists(serviceId);
    return this.prisma.serviceDurationOption.findMany({
      where: { serviceId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async setDurationOptions(serviceId: string, dto: SetDurationOptionsDto) {
    await this.ensureServiceExists(serviceId);

    return this.prisma.$transaction(async (tx) => {
      await tx.serviceDurationOption.deleteMany({ where: { serviceId } });

      if (dto.options.length === 0) return [];

      await tx.serviceDurationOption.createMany({
        data: dto.options.map((o, i) => ({
          serviceId,
          label: o.label,
          labelAr: o.labelAr,
          durationMinutes: o.durationMinutes,
          price: o.price,
          isDefault: o.isDefault ?? false,
          sortOrder: o.sortOrder ?? i,
        })),
      });

      return tx.serviceDurationOption.findMany({
        where: { serviceId },
        orderBy: { sortOrder: 'asc' },
      });
    });
  }

  private async ensureServiceExists(id: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, deletedAt: null },
    });
    if (!service) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Service not found',
        error: 'NOT_FOUND',
      });
    }
    return service;
  }
}
