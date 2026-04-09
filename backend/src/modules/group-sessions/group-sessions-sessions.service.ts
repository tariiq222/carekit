import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { GroupSessionsService } from './group-sessions.service.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { SessionListQueryDto } from './dto/session-list-query.dto.js';

@Injectable()
export class GroupSessionsSessionsService {
  private readonly logger = new Logger(GroupSessionsSessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly offeringsService: GroupSessionsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createSession(offeringId: string, dto: CreateSessionDto) {
    const offering = await this.offeringsService.findOneOffering(offeringId);

    const startTime = new Date(dto.startTime);
    const endTime = new Date(startTime.getTime() + offering.durationMin * 60 * 1000);
    const deadline = new Date(dto.registrationDeadline);

    if (deadline >= startTime) {
      throw new BadRequestException('Registration deadline must be before session start time');
    }

    if (startTime <= new Date()) {
      throw new BadRequestException('Session start time must be in the future');
    }

    return this.prisma.groupSession.create({
      data: {
        groupOfferingId: offeringId,
        startTime,
        endTime,
        registrationDeadline: deadline,
      },
      include: {
        groupOffering: {
          select: { nameAr: true, nameEn: true, practitionerId: true },
        },
      },
    });
  }

  async findAllSessions(query: SessionListQueryDto) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = {};
    if (query.groupOfferingId) where.groupOfferingId = query.groupOfferingId;
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.prisma.groupSession.findMany({
        where,
        include: {
          groupOffering: {
            select: {
              nameAr: true,
              nameEn: true,
              maxParticipants: true,
              minParticipants: true,
              practitioner: { select: { id: true, nameAr: true } },
            },
          },
        },
        orderBy: { startTime: 'asc' },
        skip,
        take: perPage,
      }),
      this.prisma.groupSession.count({ where }),
    ]);

    const totalPages = Math.ceil(total / perPage);

    return {
      items,
      meta: {
        total,
        page,
        perPage,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOneSession(id: string) {
    const session = await this.prisma.groupSession.findFirst({
      where: { id },
      include: {
        groupOffering: {
          select: {
            nameAr: true,
            nameEn: true,
            minParticipants: true,
            maxParticipants: true,
            pricePerPersonHalalat: true,
            durationMin: true,
            paymentDeadlineHours: true,
            practitioner: { select: { id: true, nameAr: true } },
          },
        },
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
      throw new NotFoundException({
        statusCode: 404,
        message: 'Group session not found',
        error: 'NOT_FOUND',
      });
    }

    return session;
  }

  async cancelSession(id: string) {
    const session = await this.findOneSession(id);

    if (session.status === 'completed' || session.status === 'cancelled') {
      throw new BadRequestException(`Cannot cancel a ${session.status} session`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.groupSession.update({
        where: { id },
        data: { status: 'cancelled' },
      });

      await tx.groupEnrollment.updateMany({
        where: {
          groupSessionId: id,
          status: { in: ['registered', 'confirmed'] },
        },
        data: { status: 'cancelled' },
      });
    });

    for (const enrollment of session.enrollments) {
      if (['registered', 'confirmed'].includes(enrollment.status)) {
        this.notificationsService.createNotification({
          userId: enrollment.patientId,
          titleAr: 'تم إلغاء الجلسة',
          titleEn: 'Session Cancelled',
          bodyAr: `تم إلغاء جلسة "${session.groupOffering.nameAr}" من قبل الإدارة`,
          bodyEn: `"${session.groupOffering.nameEn}" session has been cancelled by admin`,
          type: NotificationType.group_session_cancelled_admin,
          data: { groupSessionId: id },
        }).catch((err) => this.logger.warn('Notification failed', { error: (err as Error).message }));
      }
    }

    return { cancelled: true };
  }

  async completeSession(id: string, attendedPatientIds: string[]) {
    const session = await this.findOneSession(id);

    if (session.status !== 'confirmed' && session.status !== 'full') {
      throw new BadRequestException(`Cannot complete a ${session.status} session`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.groupSession.update({
        where: { id },
        data: { status: 'completed' },
      });

      if (attendedPatientIds.length > 0) {
        await tx.groupEnrollment.updateMany({
          where: {
            groupSessionId: id,
            patientId: { in: attendedPatientIds },
            status: 'confirmed',
          },
          data: { status: 'attended' },
        });
      }
    });

    return { completed: true };
  }
}
