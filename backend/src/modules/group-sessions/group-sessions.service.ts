import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CreateGroupSessionDto } from './dto/create-group-session.dto.js';
import { UpdateGroupSessionDto } from './dto/update-group-session.dto.js';
import { GroupSessionQueryDto } from './dto/group-session-query.dto.js';
import { ConfirmScheduleDto } from './dto/confirm-schedule.dto.js';

@Injectable()
export class GroupSessionsService {
  private readonly logger = new Logger(GroupSessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateGroupSessionDto) {
    if (dto.minParticipants > dto.maxParticipants) {
      throw new BadRequestException('minParticipants cannot exceed maxParticipants');
    }

    if (dto.schedulingMode === 'fixed_date' && !dto.startTime) {
      throw new BadRequestException('startTime is required for fixed_date scheduling');
    }

    let startTime: Date | undefined;
    let endTime: Date | undefined;

    if (dto.startTime) {
      startTime = new Date(dto.startTime);
      if (startTime <= new Date()) {
        throw new BadRequestException('Start time must be in the future');
      }
      endTime = new Date(startTime.getTime() + dto.durationMinutes * 60 * 1000);
    }

    return this.prisma.groupSession.create({
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        descriptionAr: dto.descriptionAr,
        descriptionEn: dto.descriptionEn,
        practitionerId: dto.practitionerId,
        minParticipants: dto.minParticipants,
        maxParticipants: dto.maxParticipants,
        pricePerPersonHalalat: dto.pricePerPersonHalalat,
        durationMinutes: dto.durationMinutes,
        paymentDeadlineHours: dto.paymentDeadlineHours ?? 48,
        schedulingMode: dto.schedulingMode,
        startTime,
        endTime,
        isPublished: dto.isPublished ?? false,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
      include: {
        practitioner: { select: { id: true, nameAr: true } },
      },
    });
  }

  async findAll(query: GroupSessionQueryDto) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = { deletedAt: null };

    if (query.practitionerId) where.practitionerId = query.practitionerId;
    if (query.status) where.status = query.status;
    if (query.visibility === 'published') where.isPublished = true;
    if (query.visibility === 'draft') where.isPublished = false;
    if (query.search) {
      where.OR = [
        { nameAr: { contains: query.search, mode: 'insensitive' } },
        { nameEn: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.groupSession.findMany({
        where,
        include: {
          practitioner: { select: { id: true, nameAr: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.groupSession.count({ where }),
    ]);

    const totalPages = Math.ceil(total / perPage);

    return {
      items,
      meta: { total, page, perPage, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
    };
  }

  async findOne(id: string) {
    const session = await this.prisma.groupSession.findFirst({
      where: { id, deletedAt: null },
      include: {
        practitioner: { select: { id: true, nameAr: true } },
        enrollments: {
          include: {
            patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
            payment: { select: { id: true, status: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException({ statusCode: 404, message: 'Group session not found', error: 'NOT_FOUND' });
    }

    return session;
  }

  async update(id: string, dto: UpdateGroupSessionDto) {
    const session = await this.findOne(id);

    if (dto.minParticipants !== undefined && dto.maxParticipants !== undefined) {
      if (dto.minParticipants > dto.maxParticipants) {
        throw new BadRequestException('minParticipants cannot exceed maxParticipants');
      }
    }

    const isSettingDate = !!dto.startTime && !session.startTime;
    let startTime: Date | undefined;
    let endTime: Date | undefined;

    if (dto.startTime) {
      startTime = new Date(dto.startTime);
      if (startTime <= new Date()) {
        throw new BadRequestException('Start time must be in the future');
      }
      const duration = dto.durationMinutes ?? session.durationMinutes;
      endTime = new Date(startTime.getTime() + duration * 60 * 1000);
    }

    const updated = await this.prisma.groupSession.update({
      where: { id },
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        descriptionAr: dto.descriptionAr,
        descriptionEn: dto.descriptionEn,
        practitionerId: dto.practitionerId,
        minParticipants: dto.minParticipants,
        maxParticipants: dto.maxParticipants,
        pricePerPersonHalalat: dto.pricePerPersonHalalat,
        durationMinutes: dto.durationMinutes,
        paymentDeadlineHours: dto.paymentDeadlineHours,
        startTime,
        endTime,
        isPublished: dto.isPublished,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
      include: { practitioner: { select: { id: true, nameAr: true } } },
    });

    if (isSettingDate && session.schedulingMode === 'on_capacity' && session.currentEnrollment >= session.minParticipants) {
      await this.confirmSessionAfterDateSet(id, session.paymentDeadlineHours);
    }

    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.groupSession.update({ where: { id }, data: { deletedAt: new Date() } });
    return { deleted: true };
  }

  async cancel(id: string) {
    const session = await this.findOne(id);

    if (session.status === 'completed' || session.status === 'cancelled') {
      throw new BadRequestException(`Cannot cancel a ${session.status} session`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.groupSession.update({ where: { id }, data: { status: 'cancelled' } });
      await tx.groupEnrollment.updateMany({
        where: { groupSessionId: id, status: { in: ['registered', 'confirmed'] } },
        data: { status: 'cancelled' },
      });
    });

    for (const enrollment of session.enrollments) {
      if (['registered', 'confirmed'].includes(enrollment.status)) {
        this.notificationsService.createNotification({
          userId: enrollment.patientId,
          titleAr: 'تم إلغاء الجلسة',
          titleEn: 'Session Cancelled',
          bodyAr: `تم إلغاء جلسة "${session.nameAr}" من قبل الإدارة`,
          bodyEn: `"${session.nameEn}" session has been cancelled by admin`,
          type: NotificationType.group_session_cancelled_admin,
          data: { groupSessionId: id },
        }).catch((err) => this.logger.warn('Notification failed', { error: (err as Error).message }));
      }
    }

    return { cancelled: true };
  }

  async complete(id: string, attendedPatientIds: string[]) {
    const session = await this.findOne(id);

    if (session.status !== 'confirmed' && session.status !== 'full') {
      throw new BadRequestException(`Cannot complete a ${session.status} session`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.groupSession.update({ where: { id }, data: { status: 'completed' } });
      if (attendedPatientIds.length > 0) {
        await tx.groupEnrollment.updateMany({
          where: { groupSessionId: id, patientId: { in: attendedPatientIds }, status: 'confirmed' },
          data: { status: 'attended' },
        });
      }
    });

    return { completed: true };
  }

  async triggerPaymentRequest(sessionId: string): Promise<{
    triggered: boolean;
    enrollmentsNotified: number;
    deadlineAt: Date;
  }> {
    const session = await this.findOne(sessionId);

    if (session.status !== 'open' && session.status !== 'full') {
      throw new BadRequestException('Session must be open or full to trigger payment request');
    }

    if (session.currentEnrollment < session.minParticipants) {
      throw new BadRequestException('Session does not meet minimum participant requirement');
    }

    const deadlineAt = new Date(Date.now() + session.paymentDeadlineHours * 60 * 60 * 1000);

    const enrollments = await this.prisma.$transaction(async (tx) => {
      await tx.groupSession.update({
        where: { id: sessionId },
        data: { status: 'awaiting_payment' },
      });

      const registered = await tx.groupEnrollment.findMany({
        where: { groupSessionId: sessionId, status: 'registered' },
        select: { id: true, patientId: true },
      });

      if (registered.length > 0) {
        await tx.groupEnrollment.updateMany({
          where: { groupSessionId: sessionId, status: 'registered' },
          data: { status: 'payment_requested', paymentDeadlineAt: deadlineAt },
        });
      }

      return registered;
    });

    const requiredAmountHalalat = Math.ceil(
      session.pricePerPersonHalalat * session.depositPercent / 100,
    );

    for (const enrollment of enrollments) {
      this.notificationsService.createNotification({
        userId: enrollment.patientId,
        titleAr: 'طلب إكمال الدفع',
        titleEn: 'Complete Your Payment',
        bodyAr: `أكمل الدفع (${requiredAmountHalalat} هللة) خلال ${session.paymentDeadlineHours} ساعة للحفاظ على مكانك`,
        bodyEn: `Pay ${requiredAmountHalalat} halalat within ${session.paymentDeadlineHours} hours to keep your spot`,
        type: NotificationType.group_session_confirmed,
        data: { groupSessionId: sessionId, enrollmentId: enrollment.id, deadlineAt: deadlineAt.toISOString() },
      }).catch((err) => this.logger.warn('Notification failed', { error: (err as Error).message }));
    }

    return { triggered: true, enrollmentsNotified: enrollments.length, deadlineAt };
  }

  async resendPaymentRequest(
    sessionId: string,
    enrollmentId: string,
  ): Promise<{ resent: boolean }> {
    const enrollment = await this.prisma.groupEnrollment.findFirst({
      where: { id: enrollmentId, groupSessionId: sessionId, status: 'payment_requested' },
      include: { groupSession: { select: { pricePerPersonHalalat: true, depositPercent: true, paymentDeadlineHours: true } } },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found or not awaiting payment');
    }

    const requiredAmountHalalat = Math.ceil(
      enrollment.groupSession.pricePerPersonHalalat * enrollment.groupSession.depositPercent / 100,
    );

    this.notificationsService.createNotification({
      userId: enrollment.patientId,
      titleAr: 'تذكير: أكمل دفعك',
      titleEn: 'Reminder: Complete Your Payment',
      bodyAr: `تذكير: أكمل الدفع (${requiredAmountHalalat} هللة) قبل انتهاء المهلة`,
      bodyEn: `Reminder: Pay ${requiredAmountHalalat} halalat before the deadline`,
      type: NotificationType.group_session_confirmed,
      data: { groupSessionId: sessionId, enrollmentId, deadlineAt: enrollment.paymentDeadlineAt?.toISOString() },
    }).catch((err) => this.logger.warn('Resend notification failed', { error: (err as Error).message }));

    return { resent: true };
  }

  async confirmSchedule(sessionId: string, dto: ConfirmScheduleDto) {
    const session = await this.findOne(sessionId);

    if (session.status !== 'awaiting_payment') {
      throw new BadRequestException('Session must be in awaiting_payment status to confirm schedule');
    }

    const startTime = new Date(dto.startTime);
    if (startTime <= new Date()) {
      throw new BadRequestException('Start time must be in the future');
    }

    const confirmedEnrollments = await this.prisma.groupEnrollment.findMany({
      where: { groupSessionId: sessionId, status: 'confirmed' },
      select: { id: true, patientId: true },
    });

    if (confirmedEnrollments.length === 0) {
      throw new BadRequestException('At least one confirmed (paid) enrollment is required before scheduling');
    }

    const endTime = new Date(startTime.getTime() + session.durationMinutes * 60 * 1000);

    const updated = await this.prisma.groupSession.update({
      where: { id: sessionId },
      data: { startTime, endTime, status: 'confirmed' },
      include: { practitioner: { select: { id: true, nameAr: true } } },
    });

    for (const enrollment of confirmedEnrollments) {
      this.notificationsService.createNotification({
        userId: enrollment.patientId,
        titleAr: 'تم تحديد موعد جلستك',
        titleEn: 'Session Scheduled',
        bodyAr: `تم تحديد موعد جلسة "${session.nameAr}" بتاريخ ${startTime.toLocaleDateString('ar-SA')}`,
        bodyEn: `"${session.nameEn}" has been scheduled for ${startTime.toLocaleDateString('en-US', { dateStyle: 'medium' })}`,
        type: NotificationType.group_session_confirmed,
        data: { groupSessionId: sessionId, startTime: startTime.toISOString() },
      }).catch((err) => this.logger.warn('Schedule notification failed', { error: (err as Error).message }));
    }

    return updated;
  }

  private async confirmSessionAfterDateSet(sessionId: string, paymentDeadlineHours: number) {
    await this.prisma.groupSession.update({
      where: { id: sessionId },
      data: { status: 'confirmed' },
    });

    const isFree = (await this.prisma.groupSession.findUnique({
      where: { id: sessionId },
      select: { pricePerPersonHalalat: true },
    }))?.pricePerPersonHalalat === 0;

    if (!isFree) {
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
          titleAr: 'تم تحديد موعد الجلسة — أكمل الدفع',
          titleEn: 'Session Scheduled — Complete Payment',
          bodyAr: `أكمل الدفع خلال ${paymentDeadlineHours} ساعة للحفاظ على مكانك`,
          bodyEn: `Pay within ${paymentDeadlineHours} hours to keep your spot`,
          type: NotificationType.group_session_confirmed,
          data: { groupSessionId: sessionId, enrollmentId: enrollment.id },
        }).catch((err) => this.logger.warn('Notification failed', { error: (err as Error).message }));
      }
    }
  }
}
