import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { SubmitRatingDto } from './submit-rating.dto';

export type SubmitRatingCommand = SubmitRatingDto;

@Injectable()
export class SubmitRatingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: SubmitRatingCommand) {
    const organizationId = this.tenant.requireOrganizationId();
    if (dto.score < 1 || dto.score > 5) {
      throw new BadRequestException('Score must be between 1 and 5');
    }

    // Resolve ownership from the booking record itself — never trust the
    // client-provided clientId/employeeId. The tenant scoping extension
    // injects organizationId, so a cross-tenant bookingId returns null.
    const booking = await this.prisma.booking.findFirst({
      where: { id: dto.bookingId },
      select: { id: true, status: true, clientId: true, employeeId: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('Cannot rate a booking that is not completed');
    }
    if (booking.clientId !== dto.clientId) {
      throw new ForbiddenException('Client does not own this booking');
    }
    if (booking.employeeId !== dto.employeeId) {
      throw new BadRequestException('Employee does not match the booking');
    }

    const existing = await this.prisma.rating.findUnique({
      where: { bookingId: dto.bookingId },
    });
    if (existing) throw new ConflictException('Rating already submitted for this booking');

    return this.prisma.rating.create({
      data: {
        organizationId,
        bookingId: booking.id,
        clientId: booking.clientId,
        employeeId: booking.employeeId,
        score: dto.score,
        comment: dto.comment,
        isPublic: dto.isPublic ?? false,
      },
    });
  }
}
