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
export class GroupsEnrollmentsService {
  private readonly logger = new Logger(GroupsEnrollmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async enroll(groupId: string, patientId: string) {
    const groupExists = await this.prisma.group.findFirst({
      where: { id: groupId, deletedAt: null },
      select: { id: true },
    });

    if (!groupExists) {
      throw new NotFoundException('Group not found');
    }

    const existing = await this.prisma.groupEnrollment.findFirst({
      where: { groupId, patientId, status: { notIn: ['cancelled', 'expired'] } },
    });

    if (existing) {
      throw new BadRequestException('Patient is already enrolled in this group');
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        const group = await tx.group.findFirst({
          where: { id: groupId },
        });

        if (!group) throw new NotFoundException('Group not found');

        const blockedStatuses = ['full', 'completed', 'cancelled', 'awaiting_payment', 'confirmed'];
        if (blockedStatuses.includes(group.status)) {
          throw new BadRequestException(`Cannot enroll in a ${group.status} group`);
        }

        const isFree = group.paymentType === 'FREE_HOLD';

        const enrollment = await tx.groupEnrollment.create({
          data: {
            groupId,
            patientId,
            status: isFree ? 'confirmed' : 'registered',
          },
        });

        const newCount = group.currentEnrollment + 1;
        let newStatus = group.status;

        if (newCount >= group.maxParticipants) {
          newStatus = 'full';
        } else if (newCount >= group.minParticipants && group.status === 'open') {
          if (group.schedulingMode === 'fixed_date') {
            newStatus = 'confirmed';
          }
        }

        await tx.group.update({
          where: { id: groupId },
          data: { currentEnrollment: newCount, status: newStatus },
        });

        return { enrollment, newStatus, newCount, group, isFree };
      },
      { isolationLevel: 'Serializable' },
    );

    this.notificationsService.createNotification({
      userId: patientId,
      titleAr: `تم تسجيلك في "${result.group.nameAr}"`,
      titleEn: `You've been enrolled in "${result.group.nameEn}"`,
      bodyAr: result.isFree ? 'تسجيلك مؤكد' : 'سنبلغك عند تأكيد الجلسة للدفع',
      bodyEn: result.isFree ? 'Your enrollment is confirmed' : "We'll notify you when the session is confirmed for payment",
      type: NotificationType.group_enrollment_created,
      data: { groupId },
    }).catch((err) => this.logger.warn('Notification failed', { error: (err as Error).message }));

    if (result.newStatus === 'confirmed' && !result.isFree) {
      await this.notifyGroupConfirmed(groupId, result.group.paymentDeadlineHours);
    }

    if (
      result.group.schedulingMode === 'on_capacity' &&
      result.newCount >= result.group.minParticipants &&
      result.group.currentEnrollment < result.group.minParticipants
    ) {
      this.notificationsService.createNotification({
        userId: result.group.practitionerId,
        titleAr: `اكتمل الحد الأدنى — حدد موعد "${result.group.nameAr}"`,
        titleEn: `Minimum reached — schedule "${result.group.nameEn}"`,
        bodyAr: `وصل عدد المسجلين ${result.newCount}. حدد موعد الجلسة`,
        bodyEn: `${result.newCount} enrolled. Set a date for this session`,
        type: NotificationType.group_capacity_reached,
        data: { groupId },
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

      const group = await tx.group.findFirst({
        where: { id: enrollment.groupId },
      });

      if (!group) return;

      const newCount = group.currentEnrollment - 1;
      let newStatus = group.status;

      if (newCount < group.minParticipants && group.status !== 'open') {
        newStatus = 'open';
      } else if (newCount < group.maxParticipants && group.status === 'full') {
        newStatus = 'confirmed';
      }

      await tx.group.update({
        where: { id: enrollment.groupId },
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

  private async notifyGroupConfirmed(groupId: string, paymentDeadlineHours: number) {
    const enrollments = await this.prisma.groupEnrollment.findMany({
      where: { groupId, status: 'registered' },
      select: { id: true, patientId: true },
    });

    const deadlineAt = new Date(Date.now() + paymentDeadlineHours * 60 * 60 * 1000);

    await this.prisma.groupEnrollment.updateMany({
      where: { groupId, status: 'registered' },
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
        data: { groupId, enrollmentId: enrollment.id },
      }).catch((err) => this.logger.warn('Notification failed', { error: (err as Error).message }));
    }
  }
}
