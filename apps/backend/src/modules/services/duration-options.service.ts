import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { ServicesService } from './services.service.js';
import { SetDurationOptionsDto } from './dto/set-duration-options.dto.js';

@Injectable()
export class DurationOptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly services: ServicesService,
  ) {}

  async getDurationOptions(serviceId: string) {
    await this.services.ensureExists(serviceId);
    return this.prisma.serviceDurationOption.findMany({
      where: { serviceId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async setDurationOptions(serviceId: string, dto: SetDurationOptionsDto) {
    await this.services.ensureExists(serviceId);

    // Validate isDefault uniqueness (fix #8)
    if (dto.options.length > 0) {
      const defaultCount = dto.options.filter((o) => o.isDefault).length;
      if (defaultCount > 1) {
        throw new BadRequestException({
          statusCode: 400,
          message: `${defaultCount} options marked as default — only one allowed per service`,
          error: 'MULTIPLE_DEFAULTS',
        });
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.serviceDurationOption.deleteMany({ where: { serviceId } });

      if (dto.options.length === 0) return [];

      // Auto-assign first option as default when none is explicitly marked
      const hasDefault = dto.options.some((o) => o.isDefault);

      await tx.serviceDurationOption.createMany({
        data: dto.options.map((o, i) => ({
          serviceId,
          serviceBookingTypeId: o.serviceBookingTypeId,
          label: o.label,
          labelAr: o.labelAr,
          durationMinutes: o.durationMinutes,
          price: o.price,
          isDefault: !hasDefault && i === 0 ? true : (o.isDefault ?? false),
          sortOrder: o.sortOrder ?? i,
        })),
      });

      return tx.serviceDurationOption.findMany({
        where: { serviceId },
        orderBy: { sortOrder: 'asc' },
      });
    });

    await this.services.invalidateServicesCache();
    return result;
  }
}
