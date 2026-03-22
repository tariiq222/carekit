import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { checkOwnership } from '../../common/helpers/ownership.helper.js';
import type { BookingType } from '@prisma/client';
import { AssignPractitionerServiceDto } from './dto/assign-practitioner-service.dto.js';
import { UpdatePractitionerServiceDto } from './dto/update-practitioner-service.dto.js';

const serviceInclude = {
  service: {
    select: { id: true, nameAr: true, nameEn: true, price: true, duration: true },
  },
};

@Injectable()
export class PractitionerServiceService {
  constructor(private readonly prisma: PrismaService) {}

  async assignService(practitionerId: string, dto: AssignPractitionerServiceDto, currentUserId?: string) {
    const practitioner = await this.ensurePractitionerExists(practitionerId);
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

    return this.prisma.practitionerService.create({
      data: {
        practitionerId,
        serviceId: dto.serviceId,
        priceClinic: dto.priceClinic,
        pricePhone: dto.pricePhone,
        priceVideo: dto.priceVideo,
        customDuration: dto.customDuration,
        bufferBefore: dto.bufferBefore ?? 0,
        bufferAfter: dto.bufferAfter ?? 0,
        availableTypes: dto.availableTypes as BookingType[],
        isActive: dto.isActive ?? true,
      },
      include: serviceInclude,
    });
  }

  async listServices(practitionerId: string) {
    await this.ensurePractitionerExists(practitionerId);

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
    const practitioner = await this.ensurePractitionerExists(practitionerId);
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

    return this.prisma.practitionerService.update({
      where: { id: ps.id },
      data: {
        priceClinic: dto.priceClinic,
        pricePhone: dto.pricePhone,
        priceVideo: dto.priceVideo,
        customDuration: dto.customDuration,
        bufferBefore: dto.bufferBefore,
        bufferAfter: dto.bufferAfter,
        availableTypes: dto.availableTypes as BookingType[] | undefined,
        isActive: dto.isActive,
      },
      include: serviceInclude,
    });
  }

  async removeService(practitionerId: string, serviceId: string, currentUserId?: string) {
    const practitioner = await this.ensurePractitionerExists(practitionerId);
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

  private async ensurePractitionerExists(practitionerId: string) {
    const practitioner = await this.prisma.practitioner.findFirst({
      where: { id: practitionerId },
    });
    if (!practitioner || practitioner.deletedAt) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Practitioner not found',
        error: 'PRACTITIONER_NOT_FOUND',
      });
    }
    return practitioner;
  }
}
