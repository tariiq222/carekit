import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { checkOwnership } from '../../common/helpers/ownership.helper.js';
import { ensurePractitionerExists } from '../../common/helpers/practitioner.helper.js';
import type { BookingType } from '@prisma/client';
import { AssignPractitionerServiceDto } from './dto/assign-practitioner-service.dto.js';
import { UpdatePractitionerServiceDto } from './dto/update-practitioner-service.dto.js';
import type { PractitionerTypeConfigDto } from './dto/practitioner-type-config.dto.js';

const serviceInclude = {
  service: {
    select: { id: true, nameAr: true, nameEn: true, price: true, duration: true },
  },
  serviceTypes: {
    include: { durationOptions: { orderBy: { sortOrder: 'asc' as const } } },
    orderBy: { createdAt: 'asc' as const },
  },
};

@Injectable()
export class PractitionerServiceService {
  constructor(private readonly prisma: PrismaService) {}

  async assignService(practitionerId: string, dto: AssignPractitionerServiceDto, currentUserId?: string) {
    const practitioner = await ensurePractitionerExists(this.prisma, practitionerId);
    if (currentUserId) await checkOwnership(this.prisma, practitioner.userId, currentUserId);

    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, deletedAt: null },
    });
    if (!service) {
      throw new NotFoundException({ statusCode: 404, message: 'Service not found', error: 'NOT_FOUND' });
    }

    const existing = await this.prisma.practitionerService.findUnique({
      where: { practitionerId_serviceId: { practitionerId, serviceId: dto.serviceId } },
    });
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Service already assigned to this practitioner',
        error: 'ALREADY_ASSIGNED',
      });
    }

    const created = await this.prisma.practitionerService.create({
      data: {
        practitionerId,
        serviceId: dto.serviceId,
        priceClinic: dto.priceClinic,
        pricePhone: dto.pricePhone,
        priceVideo: dto.priceVideo,
        customDuration: dto.customDuration,
        bufferMinutes: dto.bufferMinutes ?? 0,
        availableTypes: dto.availableTypes as BookingType[],
        isActive: dto.isActive ?? true,
      },
    });

    if (dto.types?.length) {
      await this.createServiceTypes(created.id, dto.types);
    }

    return this.prisma.practitionerService.findUnique({
      where: { id: created.id },
      include: serviceInclude,
    });
  }

  async listServices(practitionerId: string) {
    await ensurePractitionerExists(this.prisma, practitionerId);

    return this.prisma.practitionerService.findMany({
      where: { practitionerId },
      include: serviceInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateService(
    practitionerId: string,
    serviceId: string,
    dto: UpdatePractitionerServiceDto,
    currentUserId?: string,
  ) {
    const practitioner = await ensurePractitionerExists(this.prisma, practitionerId);
    if (currentUserId) await checkOwnership(this.prisma, practitioner.userId, currentUserId);

    const ps = await this.prisma.practitionerService.findUnique({
      where: { practitionerId_serviceId: { practitionerId, serviceId } },
    });
    if (!ps) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Practitioner service assignment not found',
        error: 'NOT_FOUND',
      });
    }

    await this.prisma.practitionerService.update({
      where: { id: ps.id },
      data: {
        priceClinic: dto.priceClinic,
        pricePhone: dto.pricePhone,
        priceVideo: dto.priceVideo,
        customDuration: dto.customDuration,
        bufferMinutes: dto.bufferMinutes,
        availableTypes: dto.availableTypes as BookingType[] | undefined,
        isActive: dto.isActive,
      },
    });

    if (dto.types) {
      await this.replaceServiceTypes(ps.id, dto.types);
    }

    return this.prisma.practitionerService.findUnique({
      where: { id: ps.id },
      include: serviceInclude,
    });
  }

  async removeService(practitionerId: string, serviceId: string, currentUserId?: string) {
    const practitioner = await ensurePractitionerExists(this.prisma, practitionerId);
    if (currentUserId) await checkOwnership(this.prisma, practitioner.userId, currentUserId);

    const ps = await this.prisma.practitionerService.findUnique({
      where: { practitionerId_serviceId: { practitionerId, serviceId } },
    });
    if (!ps) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Practitioner service assignment not found',
        error: 'NOT_FOUND',
      });
    }

    // Protect against deleting if active bookings exist
    const activeBookings = await this.prisma.booking.count({
      where: {
        practitionerServiceId: ps.id,
        status: { in: ['pending', 'confirmed'] },
        deletedAt: null,
      },
    });
    if (activeBookings > 0) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Cannot remove service with active bookings',
        error: 'ACTIVE_BOOKINGS_EXIST',
      });
    }

    await this.prisma.practitionerService.delete({ where: { id: ps.id } });
    return { deleted: true };
  }

  async findByPractitionerAndService(practitionerId: string, serviceId: string) {
    return this.prisma.practitionerService.findUnique({
      where: { practitionerId_serviceId: { practitionerId, serviceId } },
      include: serviceInclude,
    });
  }

  async getServiceTypes(practitionerId: string, serviceId: string) {
    const ps = await this.prisma.practitionerService.findFirst({
      where: { practitionerId, serviceId },
    });
    if (!ps) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Service not assigned to practitioner',
        error: 'NOT_FOUND',
      });
    }

    return this.prisma.practitionerServiceType.findMany({
      where: { practitionerServiceId: ps.id },
      include: { durationOptions: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  // ─── Private helpers ────────────────────────────────────────

  private async createServiceTypes(
    practitionerServiceId: string,
    types: PractitionerTypeConfigDto[],
  ) {
    for (const typeConfig of types) {
      await this.prisma.practitionerServiceType.create({
        data: {
          practitionerServiceId,
          bookingType: typeConfig.bookingType as BookingType,
          price: typeConfig.price ?? null,
          duration: typeConfig.duration ?? null,
          useCustomOptions: typeConfig.useCustomOptions ?? false,
          isActive: typeConfig.isActive ?? true,
          durationOptions: typeConfig.durationOptions?.length
            ? {
                createMany: {
                  data: typeConfig.durationOptions.map((o, i) => ({
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
  }

  private async replaceServiceTypes(
    practitionerServiceId: string,
    types: PractitionerTypeConfigDto[],
  ) {
    // Delete existing types (cascade deletes duration options)
    await this.prisma.practitionerServiceType.deleteMany({
      where: { practitionerServiceId },
    });

    if (types.length > 0) {
      await this.createServiceTypes(practitionerServiceId, types);
    }
  }
}
