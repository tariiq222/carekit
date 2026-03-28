import { Injectable } from '@nestjs/common';
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

    const result = await this.prisma.$transaction(async (tx) => {
      // Delete old booking types (cascades to duration options via onDelete: Cascade)
      await tx.serviceBookingType.deleteMany({ where: { serviceId } });

      // Create new booking types with their duration options (sequential within transaction)
      for (const typeConfig of dto.types) {
        await tx.serviceBookingType.create({
          data: {
            serviceId,
            bookingType: typeConfig.bookingType as BookingType,
            price: typeConfig.price,
            duration: typeConfig.duration,
            isActive: typeConfig.isActive ?? true,
            durationOptions: typeConfig.durationOptions?.length
              ? {
                  createMany: {
                    data: typeConfig.durationOptions.map((o, i) => ({
                      serviceId,
                      label: o.label,
                      labelAr: o.labelAr,
                      durationMinutes: o.durationMinutes,
                      price: o.price,
                      isDefault: o.isDefault ?? false,
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
