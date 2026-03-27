import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
      throw new NotFoundException({ statusCode: 404, message: 'Booking not found', error: 'NOT_FOUND' });
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

    let rating;
    try {
      rating = await this.prisma.rating.create({
        data: {
          bookingId: dto.bookingId,
          patientId: dto.patientId,
          practitionerId: booking.practitionerId,
          stars: dto.stars,
          comment: dto.comment,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('This booking has already been rated');
      }
      throw err;
    }

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
