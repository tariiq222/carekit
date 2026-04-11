import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ActivityLogService } from '../activity-log/activity-log.service.js';
import { ConfirmScheduleDto } from './dto/confirm-schedule.dto.js';

@Injectable()
export class GroupsLifecycleService {
  private readonly logger = new Logger(GroupsLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async cancel(id: string) {
    const group = await this.prisma.group.findFirst({
      where: { id, deletedAt: null },
      include: {
        enrollments: {
          include: {
            patient: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
            payment: { select: { id: true, status: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!group) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Group not found',
        error: 'NOT_FOUND',
      });
    }

    if (group.status === 'completed' || group.status === 'cancelled') {
      throw new BadRequestException(`Cannot cancel a ${group.status} group`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.group.update({ where: { id }, data: { status: 'cancelled' } });
      await tx.groupEnrollment.updateMany({
        where: { groupId: id, status: { in: ['registered', 'confirmed'] } },
        data: { status: 'cancelled' },
      });
    });

    for (const enrollment of group.enrollments) {
      if (['registered', 'confirmed'].includes(enrollment.status)) {
        this.notificationsService
          .createNotification({
            userId: enrollment.patientId,
            titleAr: 'تم إلغاء الجلسة',
            titleEn: 'Session Cancelled',
            bodyAr: `تم إلغاء جلسة "${group.nameAr}" من قبل الإدارة`,
            bodyEn: `"${group.nameEn}" session has been cancelled by admin`,
            type: NotificationType.group_session_cancelled_admin,
            data: { groupId: id },
          })
          .catch((err) =>
            this.logger.warn('Notification failed', {
              error: (err as Error).message,
            }),
          );
      }
    }

    this.activityLogService
      .log({
        action: 'status_changed',
        module: 'groups',
        resourceId: id,
        description: `Group cancelled`,
        oldValues: { status: group.status },
        newValues: { status: 'cancelled' },
      })
      .catch((err) =>
        this.logger.warn('Activity log failed', {
          error: (err as Error).message,
        }),
      );

    return { cancelled: true };
  }

  async complete(id: string, attendedPatientIds: string[]) {
    const group = await this.prisma.group.findFirst({
      where: { id, deletedAt: null },
      include: { enrollments: true },
    });

    if (!group) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Group not found',
        error: 'NOT_FOUND',
      });
    }

    if (group.status !== 'confirmed' && group.status !== 'full') {
      throw new BadRequestException(`Cannot complete a ${group.status} group`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.group.update({ where: { id }, data: { status: 'completed' } });
      if (attendedPatientIds.length > 0) {
        await tx.groupEnrollment.updateMany({
          where: {
            groupId: id,
            patientId: { in: attendedPatientIds },
            status: 'confirmed',
          },
          data: { status: 'attended', attended: true, attendedAt: new Date() },
        });
      }
    });

    this.activityLogService
      .log({
        action: 'status_changed',
        module: 'groups',
        resourceId: id,
        description: `Group completed`,
        oldValues: { status: group.status },
        newValues: { status: 'completed' },
      })
      .catch((err) =>
        this.logger.warn('Activity log failed', {
          error: (err as Error).message,
        }),
      );

    return { completed: true };
  }

  async confirmSchedule(groupId: string, dto: ConfirmScheduleDto) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, deletedAt: null },
      include: { enrollments: true },
    });

    if (!group) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Group not found',
        error: 'NOT_FOUND',
      });
    }

    if (group.status !== 'awaiting_payment') {
      throw new BadRequestException(
        'Group must be in awaiting_payment status to confirm schedule',
      );
    }

    const startTime = new Date(dto.startTime);
    if (startTime <= new Date()) {
      throw new BadRequestException('Start time must be in the future');
    }

    const confirmedEnrollments = await this.prisma.groupEnrollment.findMany({
      where: { groupId, status: 'confirmed' },
      select: { id: true, patientId: true },
    });

    if (confirmedEnrollments.length === 0) {
      throw new BadRequestException(
        'At least one confirmed (paid) enrollment is required before scheduling',
      );
    }

    const endTime = new Date(
      startTime.getTime() + group.durationMinutes * 60 * 1000,
    );

    const updated = await this.prisma.group.update({
      where: { id: groupId },
      data: { startTime, endTime, status: 'confirmed' },
      include: { practitioner: { select: { id: true, nameAr: true } } },
    });

    for (const enrollment of confirmedEnrollments) {
      this.notificationsService
        .createNotification({
          userId: enrollment.patientId,
          titleAr: 'تم تحديد موعد جلستك',
          titleEn: 'Session Scheduled',
          bodyAr: `تم تحديد موعد جلسة "${group.nameAr}" بتاريخ ${startTime.toLocaleDateString('ar-SA')}`,
          bodyEn: `"${group.nameEn}" has been scheduled for ${startTime.toLocaleDateString('en-US', { dateStyle: 'medium' })}`,
          type: NotificationType.group_session_confirmed,
          data: { groupId, startTime: startTime.toISOString() },
        })
        .catch((err) =>
          this.logger.warn('Schedule notification failed', {
            error: (err as Error).message,
          }),
        );
    }

    this.activityLogService
      .log({
        action: 'status_changed',
        module: 'groups',
        resourceId: groupId,
        description: `Group schedule confirmed`,
        oldValues: { status: group.status },
        newValues: { status: 'confirmed' },
      })
      .catch((err) =>
        this.logger.warn('Activity log failed', {
          error: (err as Error).message,
        }),
      );

    return updated;
  }

  async confirmGroupAfterDateSet(
    groupId: string,
    paymentDeadlineHours: number,
    paymentType: string,
  ) {
    await this.prisma.group.update({
      where: { id: groupId },
      data: { status: 'confirmed' },
    });

    const isFree = paymentType === 'FREE_HOLD';

    if (!isFree) {
      const enrollments = await this.prisma.groupEnrollment.findMany({
        where: { groupId, status: 'registered' },
        select: { id: true, patientId: true },
      });

      const deadlineAt = new Date(
        Date.now() + paymentDeadlineHours * 60 * 60 * 1000,
      );

      await this.prisma.groupEnrollment.updateMany({
        where: { groupId, status: 'registered' },
        data: { paymentDeadlineAt: deadlineAt },
      });

      for (const enrollment of enrollments) {
        this.notificationsService
          .createNotification({
            userId: enrollment.patientId,
            titleAr: 'تم تحديد موعد الجلسة — أكمل الدفع',
            titleEn: 'Session Scheduled — Complete Payment',
            bodyAr: `أكمل الدفع خلال ${paymentDeadlineHours} ساعة للحفاظ على مكانك`,
            bodyEn: `Pay within ${paymentDeadlineHours} hours to keep your spot`,
            type: NotificationType.group_session_confirmed,
            data: { groupId, enrollmentId: enrollment.id },
          })
          .catch((err) =>
            this.logger.warn('Notification failed', {
              error: (err as Error).message,
            }),
          );
      }
    }
  }
}
