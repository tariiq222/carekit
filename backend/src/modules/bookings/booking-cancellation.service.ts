import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CancelApproveDto } from './dto/cancel-approve.dto.js';
import { CancelRejectDto } from './dto/cancel-reject.dto.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ActivityLogService } from '../activity-log/activity-log.service.js';
import { bookingInclude } from './booking.constants.js';

@Injectable()
export class BookingCancellationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogService: ActivityLogService,
  ) {}

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

    const updatedBooking = await this.prisma.booking.update({
      where: { id },
      data: { status: 'pending_cancellation', cancellationReason: reason },
      include: bookingInclude,
    });

    // Notify admin users about cancellation request
    const adminRoles = await this.prisma.userRole.findMany({
      where: { role: { slug: { in: ['super_admin', 'receptionist'] } } },
      select: { userId: true },
    });
    const d = booking.date.toISOString().split('T')[0];
    for (const { userId } of adminRoles) {
      await this.notificationsService.createNotification({
        userId,
        titleAr: 'طلب إلغاء موعد جديد',
        titleEn: 'New Cancellation Request',
        bodyAr: `طلب مريض إلغاء الموعد بتاريخ ${d}`,
        bodyEn: `A patient requested cancellation for booking on ${d}`,
        type: 'booking_cancellation_requested',
        data: { bookingId: id },
      });
    }

    return updatedBooking;
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

    // Validate partial refund amount
    if (dto.refundType === 'partial') {
      if (!dto.refundAmount) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'refundAmount is required when refundType is partial',
          error: 'VALIDATION_ERROR',
        });
      }
      if (booking.payment && dto.refundAmount > booking.payment.totalAmount) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'refundAmount cannot exceed the total payment amount',
          error: 'VALIDATION_ERROR',
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const cancelledBooking = await tx.booking.update({
        where: { id },
        data: { status: 'cancelled', cancelledAt: new Date(), adminNotes: dto.adminNotes },
        include: bookingInclude,
      });

      if (
        dto.refundType !== 'none' &&
        booking.payment &&
        booking.payment.status === 'paid'
      ) {
        const refundAmount = dto.refundType === 'full'
          ? booking.payment.totalAmount
          : dto.refundAmount!;

        await tx.payment.update({
          where: { id: booking.payment.id },
          data: { status: 'refunded', refundAmount },
        });
      }

      if (cancelledBooking.patientId) {
        await this.notificationsService.createNotification({
          userId: cancelledBooking.patientId,
          titleAr: 'تم إلغاء الموعد',
          titleEn: 'Booking Cancelled',
          bodyAr: 'تم الموافقة على طلب إلغاء موعدك',
          bodyEn: 'Your booking cancellation request has been approved',
          type: 'booking_cancelled',
          data: { bookingId: id },
        });
      }

      // Notify practitioner about cancellation
      if (cancelledBooking.practitioner?.userId) {
        const d = cancelledBooking.date.toISOString().split('T')[0];
        await this.notificationsService.createNotification({
          userId: cancelledBooking.practitioner.userId,
          titleAr: 'تم إلغاء موعد',
          titleEn: 'Booking Cancelled',
          bodyAr: `تم إلغاء الموعد بتاريخ ${d} الساعة ${cancelledBooking.startTime}`,
          bodyEn: `Booking on ${d} at ${cancelledBooking.startTime} has been cancelled`,
          type: 'booking_cancelled',
          data: { bookingId: id },
        });
      }

      await this.activityLogService.log({
        action: 'cancel_approved',
        module: 'bookings',
        resourceId: id,
        description: `Booking cancellation approved. Refund type: ${dto.refundType}`,
      });

      return cancelledBooking;
    });
  }

  async rejectCancellation(id: string, dto: CancelRejectDto) {
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

    const updatedBooking = await this.prisma.booking.update({
      where: { id },
      data: {
        status: 'confirmed',
        cancellationReason: null,
        adminNotes: dto.adminNotes,
      },
      include: bookingInclude,
    });

    await this.activityLogService.log({
      action: 'cancel_rejected',
      module: 'bookings',
      resourceId: id,
      description: 'Booking cancellation request rejected',
    });

    return updatedBooking;
  }
}
