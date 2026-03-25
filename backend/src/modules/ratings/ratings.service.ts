import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { parsePaginationParams, buildPaginationMeta } from '../../common/helpers/pagination.helper.js';

interface CreateRatingDto {
  bookingId: string;
  patientId: string;
  stars: number;
  comment?: string;
}

interface RatingListQuery {
  page?: number;
  perPage?: number;
}

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRatingDto) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: dto.bookingId, patientId: dto.patientId, deletedAt: null },
      select: { id: true, status: true, practitionerId: true, rating: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status !== 'completed') {
      throw new BadRequestException(
        'Cannot rate a booking that is not completed',
      );
    }

    if (booking.rating) {
      throw new BadRequestException('This booking has already been rated');
    }

    if (dto.stars < 1 || dto.stars > 5) {
      throw new BadRequestException('Stars must be between 1 and 5');
    }

    const rating = await this.prisma.rating.create({
      data: {
        bookingId: dto.bookingId,
        patientId: dto.patientId,
        practitionerId: booking.practitionerId,
        stars: dto.stars,
        comment: dto.comment,
      },
    });

    await this.updatePractitionerRating(booking.practitionerId);

    return rating;
  }

  async findByPractitioner(practitionerId: string, query: RatingListQuery = {}) {
    const { page, perPage, skip } = parsePaginationParams(query.page, query.perPage);

    const [total, ratings] = await Promise.all([
      this.prisma.rating.count({ where: { practitionerId, deletedAt: null } }),
      this.prisma.rating.findMany({
        where: { practitionerId, deletedAt: null },
        include: {
          patient: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
    ]);

    return {
      items: ratings,
      meta: buildPaginationMeta(total, page, perPage),
    };
  }

  async findByBooking(bookingId: string) {
    return this.prisma.rating.findUnique({
      where: { bookingId },
      include: {
        patient: { select: { firstName: true, lastName: true } },
      },
    });
  }

  async updatePractitionerRating(practitionerId: string) {
    const stats = await this.prisma.rating.aggregate({
      where: { practitionerId, deletedAt: null },
      _avg: { stars: true },
      _count: { id: true },
    });

    await this.prisma.practitioner.update({
      where: { id: practitionerId },
      data: {
        rating: stats._avg.stars ?? 0,
        reviewCount: stats._count.id,
      },
    });
  }
}
