import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { MessagingDispatcherService } from '../messaging/core/messaging-dispatcher.service.js';
import { MessagingEvent } from '../messaging/core/messaging-events.js';

@Injectable()
export class GroupsEnrollmentsService {
  private readonly logger = new Logger(GroupsEnrollmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagingDispatcher: MessagingDispatcherService,
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
      where: {
        groupId,
        patientId,
        status: { notIn: ['cancelled', 'expired'] },
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Patient is already enrolled in this group',
      );
    }

    let result;
    try {
      result = await this.prisma.$transaction(
        async (tx) => {
          const group = await tx.group.findFirst({
            where: { id: groupId },
          });

          if (!group) throw new NotFoundException('Group not found');

          const blockedStatuses = [
            'full',
            'completed',
            'cancelled',
            'awaiting_payment',
            'confirmed',
          ];
          if (blockedStatuses.includes(group.status)) {
            throw new BadRequestException(
              `Cannot enroll in a ${group.status} group`,
            );
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
          } else if (
            newCount >= group.minParticipants &&
            group.status === 'open'
          ) {
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
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2034'
      ) {
        throw new ConflictException('Enrollment conflict — please try again');
      }
      throw err;
    }

    this.messagingDispatcher
      .dispatch({
        event: MessagingEvent.GROUP_ENROLLMENT_CONFIRMED,
        recipientUserId: patientId,
        context: { serviceName: result.group.nameEn ?? '' },
      })
      .catch((err) =>
        this.logger.warn('Notification failed', {
          error: (err as Error).message,
        }),
      );

    if (result.newStatus === 'confirmed' && !result.isFree) {
      await this.notifyGroupConfirmed(
        groupId,
        result.group.paymentDeadlineHours,
      );
    }

    if (
      result.group.schedulingMode === 'on_capacity' &&
      result.newCount >= result.group.minParticipants &&
      result.group.currentEnrollment < result.group.minParticipants
    ) {
      this.messagingDispatcher
        .dispatch({
          event: MessagingEvent.GROUP_CAPACITY_REACHED,
          recipientUserId: result.group.practitionerId,
          context: { serviceName: result.group.nameEn ?? '' },
        })
        .catch((err) =>
          this.logger.warn('Notification failed', {
            error: (err as Error).message,
          }),
        );
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
      throw new BadRequestException(
        'Can only cancel enrollment before payment',
      );
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

  private async notifyGroupConfirmed(
    groupId: string,
    paymentDeadlineHours: number,
  ) {
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
    }
  }
}
