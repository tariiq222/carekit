import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { ServicesService } from './services.service.js';
import type { BookingType } from '@prisma/client';
import { SetServiceBookingTypesDto } from './dto/set-booking-types.dto.js';

@Injectable()
export class ServiceBookingTypeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly services: ServicesService,
  ) {}

  async getByService(serviceId: string) {
    await this.services.ensureExists(serviceId);

    return this.prisma.serviceBookingType.findMany({
      where: { serviceId },
      include: { durationOptions: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async setBookingTypes(serviceId: string, dto: SetServiceBookingTypesDto) {
    await this.services.ensureExists(serviceId);

    // Validate isDefault uniqueness per booking type (fix #8)
    for (const typeConfig of dto.types) {
      if (typeConfig.durationOptions?.length) {
        const defaultCount = typeConfig.durationOptions.filter((o) => o.isDefault).length;
        if (defaultCount > 1) {
          throw new BadRequestException({
            statusCode: 400,
            message: `Booking type '${typeConfig.bookingType}' has ${defaultCount} duration options marked as default — only one allowed`,
            error: 'MULTIPLE_DEFAULTS',
          });
        }
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Delete old booking types (cascades to duration options via onDelete: Cascade)
      await tx.serviceBookingType.deleteMany({ where: { serviceId } });

      // Create new booking types with their duration options (sequential within transaction)
      for (const typeConfig of dto.types) {
        const options = typeConfig.durationOptions ?? [];
        // If options exist but none is marked default, auto-assign the first
        const hasDefault = options.some((o) => o.isDefault);
        const normalizedOptions = options.map((o, i) => ({
          ...o,
          isDefault: options.length > 0 && !hasDefault && i === 0 ? true : (o.isDefault ?? false),
        }));

        await tx.serviceBookingType.create({
          data: {
            serviceId,
            bookingType: typeConfig.bookingType as BookingType,
            price: typeConfig.price,
            duration: typeConfig.duration,
            isActive: typeConfig.isActive ?? true,
            durationOptions: normalizedOptions.length
              ? {
                  createMany: {
                    data: normalizedOptions.map((o, i) => ({
                      serviceId,
                      label: o.label,
                      labelAr: o.labelAr,
                      durationMinutes: o.durationMinutes,
                      price: o.price,
                      isDefault: o.isDefault,
                      sortOrder: o.sortOrder ?? i,
                    })),
                  },
                }
              : undefined,
          },
        });
      }

      // Return the new state
      return tx.serviceBookingType.findMany({
        where: { serviceId },
        include: { durationOptions: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { createdAt: 'asc' },
      });
    });

    await this.services.invalidateServicesCache();
    return result;
  }
}
