import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Booking, BookingSettings } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ZoomService } from '../integrations/zoom/zoom.service.js';

@Injectable()
export class BookingCancelHelpersService {
  private readonly logger = new Logger(BookingCancelHelpersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly zoomService: ZoomService,
  ) {}

  // ───────────────────────────────────────────────────────────────
  //  Fix 12: Calculate suggested refund type
  // ───────────────────────────────────────────────────────────────

  calculateSuggestedRefund(booking: Booking, settings: BookingSettings): string {
    const bookingDateTime = new Date(booking.date);
    const [hours, minutes] = booking.startTime.split(':').map(Number);
    bookingDateTime.setHours(hours, minutes, 0, 0);

    const hoursUntilBooking = (bookingDateTime.getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursUntilBooking >= settings.freeCancelBeforeHours) {
      return settings.freeCancelRefundType;
    }
    return settings.lateCancelRefundType;
  }

  // ───────────────────────────────────────────────────────────────
  //  Validation
  // ───────────────────────────────────────────────────────────────

  validatePartialRefund(
    dto: { refundType: string; refundAmount?: number },
    payment: { totalAmount: number } | null | undefined,
  ): void {
    if (dto.refundType !== 'partial') return;

    if (!dto.refundAmount) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'refundAmount is required when refundType is partial',
        error: 'VALIDATION_ERROR',
      });
    }
    if (payment && dto.refundAmount > payment.totalAmount) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'refundAmount cannot exceed the total payment amount',
        error: 'VALIDATION_ERROR',
      });
    }
  }

  // ───────────────────────────────────────────────────────────────
  //  Refund processing
  // ───────────────────────────────────────────────────────────────

  async processRefund(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    refundType: string,
    payment: { id: string; status: string; totalAmount: number } | null | undefined,
    refundAmount?: number,
  ): Promise<void> {
    if (refundType === 'none' || !payment || payment.status !== 'paid') return;

    const amount = refundType === 'full' ? payment.totalAmount : refundAmount!;
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'refunded', refundAmount: amount },
    });
  }

  // ───────────────────────────────────────────────────────────────
  //  Notifications
  // ───────────────────────────────────────────────────────────────

  async notifyPatientCancelled(
    booking: { patientId: string | null; id: string },
    trigger: 'admin' | 'approved',
  ): Promise<void> {
    if (!booking.patientId) return;

    const bodyMap = {
      admin: { ar: 'تم إلغاء موعدك من قبل الإدارة', en: 'Your booking has been cancelled by the administration' },
      approved: { ar: 'تم الموافقة على طلب إلغاء موعدك', en: 'Your booking cancellation request has been approved' },
    };
    await this.notificationsService.createNotification({
      userId: booking.patientId,
      titleAr: 'تم إلغاء الموعد',
      titleEn: 'Booking Cancelled',
      bodyAr: bodyMap[trigger].ar,
      bodyEn: bodyMap[trigger].en,
      type: 'booking_cancelled',
      data: { bookingId: booking.id },
    });
  }

  async notifyPractitionerCancelled(
    booking: { practitioner?: { userId: string } | null; date: Date; startTime: string; id: string },
  ): Promise<void> {
    if (!booking.practitioner?.userId) return;

    const d = booking.date.toISOString().split('T')[0];
    await this.notificationsService.createNotification({
      userId: booking.practitioner.userId,
      titleAr: 'تم إلغاء موعد',
      titleEn: 'Booking Cancelled',
      bodyAr: `تم إلغاء الموعد بتاريخ ${d} الساعة ${booking.startTime}`,
      bodyEn: `Booking on ${d} at ${booking.startTime} has been cancelled`,
      type: 'booking_cancelled',
      data: { bookingId: booking.id },
    });
  }

  async notifyPatientPractitionerCancelled(
    booking: { patientId: string | null; date: Date; id: string },
  ): Promise<void> {
    if (!booking.patientId) return;

    const d = booking.date.toISOString().split('T')[0];
    await this.notificationsService.createNotification({
      userId: booking.patientId,
      titleAr: 'تم إلغاء موعدك من قبل الطبيب',
      titleEn: 'Your Booking Was Cancelled by Practitioner',
      bodyAr: `نعتذر، تم إلغاء موعدك بتاريخ ${d}. سيتم استرداد المبلغ كاملاً`,
      bodyEn: `We apologize, your booking on ${d} has been cancelled. A full refund will be processed`,
      type: 'booking_cancelled',
      data: { bookingId: booking.id },
    });
  }

  async notifyAdmins(
    titleAr: string, titleEn: string, bodyAr: string, bodyEn: string,
    type: string, data: Record<string, unknown>,
  ): Promise<void> {
    const adminRoles = await this.prisma.userRole.findMany({
      where: { role: { slug: { in: ['super_admin', 'receptionist'] } } },
      select: { userId: true },
    });
    await Promise.all(adminRoles.map(({ userId }) =>
      this.notificationsService.createNotification({ userId, titleAr, titleEn, bodyAr, bodyEn, type, data }),
    ));
  }

  /** Fix 4: Notify patient that cancellation request was rejected */
  async notifyPatientCancellationRejected(patientId: string, bookingId: string): Promise<void> {
    await this.notificationsService.createNotification({
      userId: patientId,
      titleAr: 'تم رفض طلب الإلغاء',
      titleEn: 'Cancellation Rejected',
      bodyAr: 'تم رفض طلب إلغاء موعدك. الموعد لا يزال مؤكداً',
      bodyEn: 'Your cancellation request was rejected. The booking remains confirmed',
      type: 'booking_cancellation_rejected',
      data: { bookingId },
    });
  }

  // ───────────────────────────────────────────────────────────────
  //  Zoom cleanup
  // ───────────────────────────────────────────────────────────────

  deleteZoomIfNeeded(booking: { type: string; zoomMeetingId: string | null }): void {
    if (booking.type === 'video_consultation' && booking.zoomMeetingId) {
      this.zoomService.deleteMeeting(booking.zoomMeetingId).catch((err) =>
        this.logger.warn(`Failed to delete Zoom meeting on cancellation: ${err.message}`),
      );
    }
  }
}
