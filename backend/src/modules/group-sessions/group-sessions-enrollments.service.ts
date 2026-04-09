import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class GroupSessionsEnrollmentsService {
  private readonly logger = new Logger(GroupSessionsEnrollmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async enroll(sessionId: string, patientId: string) {
    const session = await this.prisma.groupSession.findFirst({
      where: { id: sessionId, deletedAt: null },
    });

    if (!session) {
      throw new NotFoundException('Group session not found');
    }

    if (session.status === 'full' || session.status === 'completed' || session.status === 'cancelled') {
      throw new BadRequestException(`Cannot enroll in a ${session.status} session`);
    }

    const existing = await this.prisma.groupEnrollment.findFirst({
      where: { groupSessionId: sessionId, patientId, status: { notIn: ['cancelled', 'expired'] } },
    });

    if (existing) {
      throw new BadRequestException('Patient is already enrolled in this session');
    }

    const isFree = session.pricePerPersonHalalat === 0;

    const result = await this.prisma.$transaction(async (tx) => {
      const enrollment = await tx.groupEnrollment.create({
        data: {
          groupSessionId: sessionId,
          patientId,
          status: isFree ? 'confirmed' : 'registered',
        },
      });

      const newCount = session.currentEnrollment + 1;
      let newStatus = session.status;

      if (newCount >= session.maxParticipants) {
        newStatus = 'full';
      } else if (newCount >= session.minParticipants && session.status === 'open') {
        if (session.schedulingMode === 'fixed_date') {
          newStatus = 'confirmed';
        }
        // on_capacity: stays open until admin sets date
      }

      await tx.groupSession.update({
        where: { id: sessionId },
        data: { currentEnrollment: newCount, status: newStatus },
      });

      return { enrollment, newStatus, newCount };
    });

    this.notificationsService.createNotification({
      userId: patientId,
      titleAr: `تم تسجيلك في "${session.nameAr}"`,
      titleEn: `You've been enrolled in "${session.nameEn}"`,
      bodyAr: isFree ? 'تسجيلك مؤكد' : 'سنبلغك عند تأكيد الجلسة للدفع',
      bodyEn: isFree ? 'Your enrollment is confirmed' : "We'll notify you when the session is confirmed for payment",
      type: NotificationType.group_enrollment_created,
      data: { groupSessionId: sessionId },
    }).catch((err) => this.logger.warn('Notification failed', { error: (err as Error).message }));

    // fixed_date: min reached → confirm + payment flow
    if (result.newStatus === 'confirmed' && session.status === 'open' && !isFree) {
      await this.notifySessionConfirmed(sessionId, session.paymentDeadlineHours);
    }

    // on_capacity: min reached → notify admin to set date
    if (
      session.schedulingMode === 'on_capacity' &&
      result.newCount >= session.minParticipants &&
      session.currentEnrollment < session.minParticipants
    ) {
      this.notificationsService.createNotification({
        userId: session.practitionerId,
        titleAr: `اكتمل الحد الأدنى — حدد موعد "${session.nameAr}"`,
        titleEn: `Minimum reached — schedule "${session.nameEn}"`,
        bodyAr: `وصل عدد المسجلين ${result.newCount}. حدد موعد الجلسة`,
        bodyEn: `${result.newCount} enrolled. Set a date for this session`,
        type: NotificationType.group_capacity_reached,
        data: { groupSessionId: sessionId },
      }).catch((err) => this.logger.warn('Notification failed', { error: (err as Error).message }));
    }

    return result.enrollment;
  }

  async cancelEnrollment(enrollmentId: string, patientId: string) {
    const enrollment = await this.prisma.groupEnrollment.findFirst({
      where: { id: enrollmentId, patientId },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    if (enrollment.status !== 'registered') {
      throw new BadRequestException('Can only cancel enrollment before payment');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.groupEnrollment.update({
        where: { id: enrollmentId },
        data: { status: 'cancelled' },
      });

      const session = await tx.groupSession.findFirst({
        where: { id: enrollment.groupSessionId },
      });

      if (!session) return;

      const newCount = session.currentEnrollment - 1;
      let newStatus = session.status;

      if (newCount < session.minParticipants && session.status !== 'open') {
        newStatus = 'open';
      } else if (newCount < session.maxParticipants && session.status === 'full') {
        newStatus = 'confirmed';
      }

      await tx.groupSession.update({
        where: { id: enrollment.groupSessionId },
        data: { currentEnrollment: newCount, status: newStatus },
      });
    });

    return { cancelled: true };
  }

  async removeEnrollment(enrollmentId: string) {
    const enrollment = await this.prisma.groupEnrollment.findFirst({
      where: { id: enrollmentId },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    if (enrollment.status === 'confirmed' || enrollment.status === 'attended') {
      throw new BadRequestException('Cannot remove a paid/attended enrollment');
    }

    return this.cancelEnrollment(enrollmentId, enrollment.patientId);
  }

  private async notifySessionConfirmed(sessionId: string, paymentDeadlineHours: number) {
    const enrollments = await this.prisma.groupEnrollment.findMany({
      where: { groupSessionId: sessionId, status: 'registered' },
      select: { id: true, patientId: true },
    });

    const deadlineAt = new Date(Date.now() + paymentDeadlineHours * 60 * 60 * 1000);

    await this.prisma.groupEnrollment.updateMany({
      where: { groupSessionId: sessionId, status: 'registered' },
      data: { paymentDeadlineAt: deadlineAt },
    });

    for (const enrollment of enrollments) {
      this.notificationsService.createNotification({
        userId: enrollment.patientId,
        titleAr: 'الجلسة مؤكدة — أكمل الدفع',
        titleEn: 'Session Confirmed — Complete Payment',
        bodyAr: `أكمل الدفع خلال ${paymentDeadlineHours} ساعة للحفاظ على مكانك`,
        bodyEn: `Pay within ${paymentDeadlineHours} hours to keep your spot`,
        type: NotificationType.group_session_confirmed,
        data: { groupSessionId: sessionId, enrollmentId: enrollment.id },
      }).catch((err) => this.logger.warn('Notification failed', { error: (err as Error).message }));
    }
  }
}
