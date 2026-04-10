import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ActivityLogService } from '../activity-log/activity-log.service.js';

@Injectable()
export class GroupsPaymentService {
  private readonly logger = new Logger(GroupsPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async triggerPaymentRequest(groupId: string): Promise<{
    triggered: boolean;
    enrollmentsNotified: number;
    deadlineAt: Date;
  }> {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, deletedAt: null },
      include: { enrollments: true },
    });

    if (!group) {
      throw new NotFoundException({ statusCode: 404, message: 'Group not found', error: 'NOT_FOUND' });
    }

    if (group.status !== 'open' && group.status !== 'full') {
      throw new BadRequestException('Group must be open or full to trigger payment request');
    }

    if (group.currentEnrollment < group.minParticipants) {
      throw new BadRequestException('Group does not meet minimum participant requirement');
    }

    const deadlineAt = new Date(Date.now() + group.paymentDeadlineHours * 60 * 60 * 1000);

    const enrollments = await this.prisma.$transaction(async (tx) => {
      await tx.group.update({
        where: { id: groupId },
        data: { status: 'awaiting_payment' },
      });

      const registered = await tx.groupEnrollment.findMany({
        where: { groupId, status: 'registered' },
        select: { id: true, patientId: true },
      });

      if (registered.length > 0) {
        await tx.groupEnrollment.updateMany({
          where: { groupId, status: 'registered' },
          data: { status: 'payment_requested', paymentDeadlineAt: deadlineAt },
        });

        const requiredAmount = this.getRequiredAmount(group);
        await tx.groupPayment.createMany({
          data: registered.map((e) => ({
            enrollmentId: e.id,
            groupId,
            totalAmount: requiredAmount,
            paidAmount: 0,
            remainingAmount: requiredAmount,
            method: 'online' as const,
            status: 'pending' as const,
          })),
          skipDuplicates: true,
        });
      }

      return registered;
    });

    const requiredAmountHalalat = this.getRequiredAmount(group);

    for (const enrollment of enrollments) {
      this.notificationsService.createNotification({
        userId: enrollment.patientId,
        titleAr: 'طلب إكمال الدفع',
        titleEn: 'Complete Your Payment',
        bodyAr: `أكمل الدفع (${requiredAmountHalalat} هللة) خلال ${group.paymentDeadlineHours} ساعة للحفاظ على مكانك`,
        bodyEn: `Pay ${requiredAmountHalalat} halalat within ${group.paymentDeadlineHours} hours to keep your spot`,
        type: NotificationType.group_session_confirmed,
        data: { groupId, enrollmentId: enrollment.id, deadlineAt: deadlineAt.toISOString() },
      }).catch((err) => this.logger.warn('Notification failed', { error: (err as Error).message }));
    }

    this.activityLogService.log({
      action: 'status_changed',
      module: 'groups',
      resourceId: groupId,
      description: `Group awaiting payment — ${enrollments.length} enrollment(s) notified`,
      oldValues: { status: group.status },
      newValues: { status: 'awaiting_payment' },
    }).catch((err) => this.logger.warn('Activity log failed', { error: (err as Error).message }));

    return { triggered: true, enrollmentsNotified: enrollments.length, deadlineAt };
  }

  async resendPaymentRequest(
    groupId: string,
    enrollmentId: string,
  ): Promise<{ resent: boolean }> {
    const enrollment = await this.prisma.groupEnrollment.findFirst({
      where: { id: enrollmentId, groupId, status: 'payment_requested' },
      include: { group: { select: { pricePerPersonHalalat: true, depositAmount: true, paymentType: true, paymentDeadlineHours: true } } },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found or not awaiting payment');
    }

    const requiredAmountHalalat = this.getRequiredAmount(enrollment.group as { pricePerPersonHalalat: number; depositAmount: number | null; paymentType: string });

    this.notificationsService.createNotification({
      userId: enrollment.patientId,
      titleAr: 'تذكير: أكمل دفعك',
      titleEn: 'Reminder: Complete Your Payment',
      bodyAr: `تذكير: أكمل الدفع (${requiredAmountHalalat} هللة) قبل انتهاء المهلة`,
      bodyEn: `Reminder: Pay ${requiredAmountHalalat} halalat before the deadline`,
      type: NotificationType.group_session_confirmed,
      data: { groupId, enrollmentId, deadlineAt: enrollment.paymentDeadlineAt?.toISOString() },
    }).catch((err) => this.logger.warn('Resend notification failed', { error: (err as Error).message }));

    return { resent: true };
  }

  getRequiredAmount(group: { pricePerPersonHalalat: number; depositAmount: number | null; paymentType: string }): number {
    switch (group.paymentType) {
      case 'FREE_HOLD':
        return 0;
      case 'DEPOSIT':
        return group.depositAmount ?? 0;
      case 'FULL_PAYMENT':
      default:
        return group.pricePerPersonHalalat;
    }
  }

  async confirmEnrollmentAfterPayment(enrollmentId: string): Promise<void> {
    const enrollment = await this.prisma.groupEnrollment.findUnique({
      where: { id: enrollmentId },
      select: { id: true, patientId: true, groupId: true, status: true },
    });

    if (!enrollment) throw new NotFoundException('Enrollment not found');

    await this.prisma.groupEnrollment.update({
      where: { id: enrollmentId },
      data: { status: 'confirmed' },
    });

    this.notificationsService.createNotification({
      userId: enrollment.patientId,
      titleAr: 'تم تأكيد تسجيلك في المجموعة',
      titleEn: 'Your group enrollment has been confirmed',
      bodyAr: 'تم تأكيد تسجيلك. شكراً لك.',
      bodyEn: 'Your enrollment is confirmed. Thank you.',
      type: NotificationType.group_payment_confirmed,
      data: { groupId: enrollment.groupId, enrollmentId: enrollment.id },
    }).catch((err: unknown) =>
      this.logger.warn('Confirmation notification failed', { error: String(err) }),
    );

    this.activityLogService.log({
      action: 'payment_confirmed',
      module: 'groups',
      resourceId: enrollment.id,
      description: `Group enrollment confirmed after payment`,
      oldValues: { status: enrollment.status },
      newValues: { status: 'confirmed' },
    }).catch((err: unknown) =>
      this.logger.warn('ActivityLog failed', { error: String(err) }),
    );
  }
}
