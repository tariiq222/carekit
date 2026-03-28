import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class ServicePractitionersService {
  constructor(private readonly prisma: PrismaService) {}

  async getPractitionersForService(serviceId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, deletedAt: null },
    });
    if (!service) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Service not found',
        error: 'NOT_FOUND',
      });
    }

    return this.prisma.practitionerService.findMany({
      where: { serviceId },
      include: {
        practitioner: {
          select: {
            id: true,
            nameAr: true,
            title: true,
            isActive: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        serviceTypes: {
          select: {
            id: true,
            bookingType: true,
            price: true,
            duration: true,
            isActive: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
