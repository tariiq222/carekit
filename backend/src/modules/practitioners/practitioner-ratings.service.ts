import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import {
  parsePaginationParams,
  buildPaginationMeta,
} from '../../common/helpers/pagination.helper.js';

@Injectable()
export class PractitionerRatingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRatings(practitionerId: string, params?: { page?: number; perPage?: number }) {
    const practitioner = await this.prisma.practitioner.findUnique({
      where: { id: practitionerId },
    });
    if (!practitioner || practitioner.deletedAt) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Practitioner not found',
        error: 'PRACTITIONER_NOT_FOUND',
      });
    }

    const { page, perPage, skip } = parsePaginationParams(params?.page, params?.perPage, 100);

    const [rawRatings, total] = await Promise.all([
      this.prisma.rating.findMany({
        where: { practitionerId },
        include: {
          patient: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.rating.count({ where: { practitionerId } }),
    ]);

    // Anonymize patient names in public endpoint: "أحمد م."
    const ratings = rawRatings.map(({ patient, ...rating }) => ({
      ...rating,
      patient: patient
        ? { firstName: patient.firstName, lastName: patient.lastName.charAt(0) + '.' }
        : null,
    }));

    return {
      items: ratings,
      meta: buildPaginationMeta(total, page, perPage),
    };
  }
}
