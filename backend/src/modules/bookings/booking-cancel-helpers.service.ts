import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Booking, BookingSettings, RefundType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ZoomService } from '../integrations/zoom/zoom.service.js';
import { resilientFetch } from '../../common/helpers/resilient-fetch.helper.js';
import { NOTIF } from '../../common/constants/notification-messages.js';

@Injectable()
export class BookingCancelHelpersService {
  private readonly logger = new Logger(BookingCancelHelpersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly zoomService: ZoomService,
    private readonly config: ConfigService,
  ) {}

  // ───────────────────────────────────────────────────────────────
  //  Fix 12: Calculate suggested refund type
  // ───────────────────────────────────────────────────────────────

  calculateSuggestedRefund(booking: Booking, settings: BookingSettings): RefundType {
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
    dto: { refundType: RefundType; refundAmount?: number },
    payment: { totalAmount: number } | null | undefined,
  ): void {
    if (dto.refundType !== RefundType.partial) return;

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
    refundType: RefundType,
    payment: { id: string; status: string; totalAmount: number; method?: string; moyasarPaymentId?: string | null } | null | undefined,
    refundAmount?: number,
  ): Promise<void> {
    if (refundType === RefundType.none || !payment || payment.status !== 'paid') return;

    const amount = refundType === RefundType.full ? payment.totalAmount : refundAmount!;

    // For Moyasar payments: call the actual refund API before updating DB
    if (payment.method === 'moyasar' && payment.moyasarPaymentId) {
      await this.executeMoyasarRefund(payment.moyasarPaymentId, amount);
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'refunded', refundAmount: amount },
    });
  }

  private async executeMoyasarRefund(moyasarPaymentId: string, amount: number): Promise<void> {
    const apiKey = this.config.get<string>('MOYASAR_API_KEY', '');
    const credentials = Buffer.from(`${apiKey}:`).toString('base64');

    const response = await resilientFetch(
      `https://api.moyasar.com/v1/payments/${moyasarPaymentId}/refund`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount }),
      },
      { circuit: 'moyasar', timeoutMs: 15_000 },
    );

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({ message: 'Unknown error' }))) as { message?: string };
      throw new BadRequestException({
        statusCode: 400,
        message: errorBody.message ?? 'Moyasar refund failed',
        error: 'MOYASAR_REFUND_ERROR',
      });
    }
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
      ...NOTIF.BOOKING_CANCELLED,
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
      ...NOTIF.BOOKING_CANCELLED,
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
      ...NOTIF.BOOKING_CANCELLED_BY_PRACTITIONER,
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
      ...NOTIF.CANCELLATION_REJECTED,
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
