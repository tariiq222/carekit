import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CancelApproveDto } from './dto/cancel-approve.dto.js';
import { CancelRejectDto } from './dto/cancel-reject.dto.js';

const bookingInclude = {
  patient: true,
  practitioner: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      specialty: { select: { nameEn: true, nameAr: true } },
    },
  },
  service: true,
};

@Injectable()
export class BookingCancellationService {
  constructor(private readonly prisma: PrismaService) {}

  async requestCancellation(id: string, patientId: string, reason?: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
    });
    if (!booking) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Booking not found',
        error: 'NOT_FOUND',
      });
    }

    if (booking.patientId !== patientId) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'You can only request cancellation for your own bookings',
        error: 'FORBIDDEN',
      });
    }

    if (booking.status !== 'confirmed') {
      throw new ConflictException({
        statusCode: 409,
        message: `Cannot request cancellation for booking with status '${booking.status}'`,
        error: 'CONFLICT',
      });
    }

    return this.prisma.booking.update({
      where: { id },
      data: { status: 'pending_cancellation', cancellationReason: reason },
      include: bookingInclude,
    });
  }

  async approveCancellation(id: string, dto: CancelApproveDto) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
      include: { payment: true },
    });
    if (!booking) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Booking not found',
        error: 'NOT_FOUND',
      });
    }

    if (booking.status !== 'pending_cancellation') {
      throw new ConflictException({
        statusCode: 409,
        message: `Cannot approve cancellation for booking with status '${booking.status}'`,
        error: 'CONFLICT',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const cancelledBooking = await tx.booking.update({
        where: { id },
        data: { status: 'cancelled', cancelledAt: new Date() },
        include: bookingInclude,
      });

      if (
        dto.refundType !== 'none' &&
        booking.payment &&
        booking.payment.status === 'paid'
      ) {
        await tx.payment.update({
          where: { id: booking.payment.id },
          data: { status: 'refunded' },
        });
      }

      return cancelledBooking;
    });
  }

  async rejectCancellation(id: string, _dto: CancelRejectDto) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
    });
    if (!booking) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Booking not found',
        error: 'NOT_FOUND',
      });
    }

    if (booking.status !== 'pending_cancellation') {
      throw new ConflictException({
        statusCode: 409,
        message: `Cannot reject cancellation for booking with status '${booking.status}'`,
        error: 'CONFLICT',
      });
    }

    return this.prisma.booking.update({
      where: { id },
      data: { status: 'confirmed', cancellationReason: null },
      include: bookingInclude,
    });
  }
}
