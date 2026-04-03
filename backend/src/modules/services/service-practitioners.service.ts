import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { ServicesService } from './services.service.js';

@Injectable()
export class ServicePractitionersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly services: ServicesService,
  ) {}

  async getPractitionersForService(serviceId: string, branchId?: string) {
    await this.services.ensureExists(serviceId);

    const rows = await this.prisma.practitionerService.findMany({
      where: {
        serviceId,
        ...(branchId && {
          practitioner: {
            branches: { some: { branchId } },
          },
        }),
      },
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
                avatarUrl: true,
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

    // Map user.avatarUrl → practitioner.avatarUrl for frontend compatibility
    return rows.map((row) => ({
      ...row,
      practitioner: {
        ...row.practitioner,
        avatarUrl: row.practitioner.user.avatarUrl ?? null,
      },
    }));
  }
}
