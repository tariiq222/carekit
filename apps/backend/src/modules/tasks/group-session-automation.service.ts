import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { MessagingDispatcherService } from '../messaging/core/messaging-dispatcher.service.js';
import { MessagingEvent } from '../messaging/core/messaging-events.js';

@Injectable()
export class GroupAutomationService {
  private readonly logger = new Logger(GroupAutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagingDispatcher: MessagingDispatcherService,
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
        groupId: true,
        group: {
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
        await this.prisma.$transaction(
          async (tx) => {
            const current = await tx.groupEnrollment.findFirst({
              where: {
                id: enrollment.id,
                status: { in: ['registered', 'payment_requested'] },
              },
            });
            if (!current) return;

            await tx.groupEnrollment.update({
              where: { id: enrollment.id },
              data: { status: 'expired', expiredAt: new Date() },
            });

            const group = enrollment.group;
            const newCount = group.currentEnrollment - 1;
            let newStatus = group.status;

            if (newCount < group.minParticipants && newStatus !== 'open') {
              newStatus = 'open';
            } else if (
              newCount < group.maxParticipants &&
              newStatus === 'full'
            ) {
              newStatus = 'confirmed';
            }

            await tx.group.update({
              where: { id: group.id },
              data: { currentEnrollment: newCount, status: newStatus },
            });
          },
          { isolationLevel: 'Serializable', timeout: 10000 },
        );

        this.messagingDispatcher
          .dispatch({
            event: MessagingEvent.GROUP_SESSION_CONFIRMED,
            recipientUserId: enrollment.patientId,
            context: { serviceName: '', date: '' },
          })
          .catch((err) =>
            this.logger.warn('Notification failed', {
              error: (err as Error).message,
            }),
          );
      } catch (err) {
        this.logger.warn(
          `Failed to expire enrollment ${enrollment.id}: ${(err as Error).message}`,
        );
      }
    }

    if (expired.length > 0) {
      this.logger.log(`Expired ${expired.length} unpaid group enrollments`);
    }
  }

  async cancelExpiredSessions(): Promise<void> {
    const groups = await this.prisma.group.findMany({
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

    for (const group of groups) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.group.update({
            where: { id: group.id },
            data: { status: 'cancelled' },
          });

          await tx.groupEnrollment.updateMany({
            where: { groupId: group.id, status: 'registered' },
            data: { status: 'cancelled' },
          });
        });

        for (const enrollment of group.enrollments) {
          this.messagingDispatcher
            .dispatch({
              event: MessagingEvent.GROUP_CAPACITY_REACHED,
              recipientUserId: enrollment.patientId,
              context: { serviceName: group.nameEn ?? '' },
            })
            .catch((err) =>
              this.logger.warn('Notification failed', {
                error: (err as Error).message,
              }),
            );
        }
      } catch (err) {
        this.logger.warn(
          `Failed to cancel group ${group.id}: ${(err as Error).message}`,
        );
      }
    }

    if (groups.length > 0) {
      this.logger.log(`Cancelled ${groups.length} expired groups`);
    }
  }

  async sendSessionReminders(): Promise<void> {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const groups = await this.prisma.group.findMany({
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

    for (const group of groups) {
      for (const enrollment of group.enrollments) {
        this.messagingDispatcher
          .dispatch({
            event: MessagingEvent.GROUP_SESSION_REMINDER,
            recipientUserId: enrollment.patientId,
            context: { practitionerName: '', time: '' },
          })
          .catch((err) =>
            this.logger.warn('Notification failed', {
              error: (err as Error).message,
            }),
          );
      }

      await this.prisma.group.update({
        where: { id: group.id },
        data: { reminderSent: true },
      });
    }

    if (groups.length > 0) {
      this.logger.log(`Sent reminders for ${groups.length} groups`);
    }
  }
}
