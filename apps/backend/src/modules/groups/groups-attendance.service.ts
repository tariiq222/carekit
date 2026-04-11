import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { MessagingDispatcherService } from '../messaging/core/messaging-dispatcher.service.js';
import { MessagingEvent } from '../messaging/core/messaging-events.js';
import { ConfirmAttendanceDto } from './dto/confirm-attendance.dto.js';

@Injectable()
export class GroupsAttendanceService {
  private readonly logger = new Logger(GroupsAttendanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagingDispatcher: MessagingDispatcherService,
  ) {}

  async confirmAttendance(dto: ConfirmAttendanceDto) {
    const enrollment = await this.prisma.groupEnrollment.findFirst({
      where: { id: dto.enrollmentId },
      include: { group: { select: { id: true, nameAr: true, nameEn: true } } },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    if (enrollment.status !== 'confirmed' && enrollment.status !== 'attended') {
      throw new BadRequestException(
        'Can only confirm attendance for confirmed enrollments',
      );
    }

    const updated = await this.prisma.groupEnrollment.update({
      where: { id: dto.enrollmentId },
      data: {
        attended: dto.attended,
        attendedAt: dto.attended ? new Date() : null,
        status: dto.attended
          ? 'attended'
          : enrollment.status === 'attended'
            ? 'confirmed'
            : enrollment.status,
      },
    });

    return updated;
  }

  async bulkConfirmAttendance(groupId: string, attendedPatientIds: string[]) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, deletedAt: null },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Mark attended patients
      if (attendedPatientIds.length > 0) {
        await tx.groupEnrollment.updateMany({
          where: {
            groupId,
            patientId: { in: attendedPatientIds },
            status: { in: ['confirmed', 'attended'] },
          },
          data: { attended: true, attendedAt: new Date(), status: 'attended' },
        });
      }

      // Mark all other confirmed enrollments as not attended
      await tx.groupEnrollment.updateMany({
        where: {
          groupId,
          status: 'confirmed',
          patientId: { notIn: attendedPatientIds },
        },
        data: { attended: false, attendedAt: null },
      });

      return attendedPatientIds.length;
    });

    return { markedAttended: result };
  }

  async issueCertificate(enrollmentId: string) {
    const enrollment = await this.prisma.groupEnrollment.findFirst({
      where: { id: enrollmentId },
      include: { group: { select: { id: true, nameAr: true, nameEn: true } } },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    if (!enrollment.attended) {
      throw new BadRequestException(
        'Cannot issue certificate for non-attended enrollment',
      );
    }

    // Idempotent: check existing certificate
    const existing = await this.prisma.groupCertificate.findUnique({
      where: { enrollmentId },
    });

    if (existing) {
      return existing;
    }

    const certificate = await this.prisma.groupCertificate.create({
      data: {
        enrollmentId,
        groupId: enrollment.groupId,
        patientId: enrollment.patientId,
      },
    });

    // Fire-and-forget notification
    this.messagingDispatcher
      .dispatch({
        event: MessagingEvent.GROUP_ATTENDANCE_MARKED,
        recipientUserId: enrollment.patientId,
        context: {},
      })
      .catch((err) =>
        this.logger.warn('Certificate notification failed', {
          error: (err as Error).message,
        }),
      );

    return certificate;
  }
}
