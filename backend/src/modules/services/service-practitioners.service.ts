import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { ServicesService } from './services.service.js';

@Injectable()
export class ServicePractitionersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly services: ServicesService,
  ) {}

  async getPractitionersForService(serviceId: string) {
    await this.services.ensureExists(serviceId);

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
