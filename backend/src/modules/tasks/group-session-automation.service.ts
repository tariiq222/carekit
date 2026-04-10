import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class GroupSessionAutomationService {
  private readonly logger = new Logger(GroupSessionAutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async expireUnpaidEnrollments(): Promise<void> {
    const expired = await this.prisma.groupEnrollment.findMany({
      where: {
        status: { in: ['registered', 'payment_requested'] },
        paymentDeadlineAt: { not: null, lt: new Date() },
      },
      select: {
        id: true,
        patientId: true,
        groupSessionId: true,
        groupSession: {
          select: {
            id: true,
            currentEnrollment: true,
            status: true,
            minParticipants: true,
            maxParticipants: true,
          },
        },
      },
    });

    for (const enrollment of expired) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const current = await tx.groupEnrollment.findFirst({
            where: { id: enrollment.id, status: { in: ['registered', 'payment_requested'] } },
          });
          if (!current) return;

          await tx.groupEnrollment.update({
            where: { id: enrollment.id },
            data: { status: 'expired', expiredAt: new Date() },
          });

          const session = enrollment.groupSession;
          const newCount = session.currentEnrollment - 1;
          let newStatus = session.status;

          if (newCount < session.minParticipants && newStatus !== 'open') {
            newStatus = 'open';
          } else if (newCount < session.maxParticipants && newStatus === 'full') {
            newStatus = 'confirmed';
          }

          await tx.groupSession.update({
            where: { id: session.id },
            data: { currentEnrollment: newCount, status: newStatus },
          });
        }, { isolationLevel: 'Serializable', timeout: 10000 });

        this.notificationsService.createNotification({
          userId: enrollment.patientId,
          titleAr: 'انتهت مهلة الدفع',
          titleEn: 'Payment Deadline Expired',
          bodyAr: 'انتهت مهلة الدفع — فقدت مكانك في الجلسة',
          bodyEn: 'Payment deadline has passed — you lost your spot',
          type: NotificationType.group_enrollment_expired,
          data: { groupSessionId: enrollment.groupSessionId },
        }).catch((err) => this.logger.warn('Notification failed', { error: (err as Error).message }));
      } catch (err) {
        this.logger.warn(`Failed to expire enrollment ${enrollment.id}: ${(err as Error).message}`);
      }
    }

    if (expired.length > 0) {
      this.logger.log(`Expired ${expired.length} unpaid group enrollments`);
    }
  }

  async cancelExpiredSessions(): Promise<void> {
    const sessions = await this.prisma.groupSession.findMany({
      where: {
        status: 'open',
        expiresAt: { not: null, lt: new Date() },
      },
      include: {
        enrollments: {
          where: { status: 'registered' },
          select: { id: true, patientId: true },
        },
      },
    });

    for (const session of sessions) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.groupSession.update({
            where: { id: session.id },
            data: { status: 'cancelled' },
          });

          await tx.groupEnrollment.updateMany({
            where: { groupSessionId: session.id, status: 'registered' },
            data: { status: 'cancelled' },
          });
        });

        for (const enrollment of session.enrollments) {
          this.notificationsService.createNotification({
            userId: enrollment.patientId,
            titleAr: 'تم إلغاء الجلسة',
            titleEn: 'Session Cancelled',
            bodyAr: `تم إلغاء جلسة "${session.nameAr}" لعدم اكتمال العدد`,
            bodyEn: `"${session.nameEn}" cancelled due to insufficient enrollment`,
            type: NotificationType.group_session_cancelled,
            data: { groupSessionId: session.id },
          }).catch((err) => this.logger.warn('Notification failed', { error: (err as Error).message }));
        }
      } catch (err) {
        this.logger.warn(`Failed to cancel session ${session.id}: ${(err as Error).message}`);
      }
    }

    if (sessions.length > 0) {
      this.logger.log(`Cancelled ${sessions.length} expired group sessions`);
    }
  }

  async sendSessionReminders(): Promise<void> {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const sessions = await this.prisma.groupSession.findMany({
      where: {
        status: { in: ['confirmed', 'full'] },
        startTime: { not: null, gt: now, lte: in24h },
        reminderSent: false,
      },
      include: {
        enrollments: {
          where: { status: 'confirmed' },
          select: { patientId: true },
        },
      },
    });

    for (const session of sessions) {
      for (const enrollment of session.enrollments) {
        this.notificationsService.createNotification({
          userId: enrollment.patientId,
          titleAr: 'تذكير: جلسة غداً',
          titleEn: 'Reminder: Session Tomorrow',
          bodyAr: `جلسة "${session.nameAr}" غداً`,
          bodyEn: `"${session.nameEn}" session is tomorrow`,
          type: NotificationType.group_session_reminder,
          data: { groupSessionId: session.id },
        }).catch((err) => this.logger.warn('Notification failed', { error: (err as Error).message }));
      }

      await this.prisma.groupSession.update({
        where: { id: session.id },
        data: { reminderSent: true },
      });
    }

    if (sessions.length > 0) {
      this.logger.log(`Sent reminders for ${sessions.length} group sessions`);
    }
  }
}
