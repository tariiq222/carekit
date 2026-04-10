import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';
import { CourseQueryDto } from './dto/course-query.dto.js';
import { MarkCourseAttendanceDto } from './dto/mark-course-attendance.dto.js';

const COMPLETION_THRESHOLD = 0.75; // 75% of total sessions

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreateCourseDto) {
    if (new Date(dto.startDate) <= new Date()) {
      throw new BadRequestException('Start date must be in the future');
    }
    if (dto.isGroup && !dto.maxParticipants) {
      throw new BadRequestException('maxParticipants is required for group courses');
    }

    const sessionDates = this.generateSessionDates(
      new Date(dto.startDate),
      dto.totalSessions,
      dto.frequency,
    );

    return this.prisma.course.create({
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        descriptionAr: dto.descriptionAr,
        descriptionEn: dto.descriptionEn,
        practitionerId: dto.practitionerId,
        totalSessions: dto.totalSessions,
        durationPerSessionMin: dto.durationPerSessionMin,
        frequency: dto.frequency,
        priceHalalat: dto.priceHalalat,
        isGroup: dto.isGroup,
        maxParticipants: dto.maxParticipants,
        deliveryMode: dto.deliveryMode,
        location: dto.location,
        startDate: new Date(dto.startDate),
        sessions: {
          create: sessionDates.map((scheduledAt, idx) => ({
            sessionNumber: idx + 1,
            scheduledAt,
          })),
        },
      },
      include: {
        practitioner: { select: { id: true, nameAr: true } },
        sessions: { orderBy: { sessionNumber: 'asc' } },
      },
    });
  }

  async findAll(query: CourseQueryDto) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const where: Record<string, unknown> = { deletedAt: null };

    if (query.practitionerId) where.practitionerId = query.practitionerId;
    if (query.status) where.status = query.status;
    if (query.deliveryMode) where.deliveryMode = query.deliveryMode;
    if (query.isGroup !== undefined) where.isGroup = query.isGroup;

    if (query.search) {
      where.OR = [
        { nameAr: { contains: query.search, mode: 'insensitive' } },
        { nameEn: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        include: {
          practitioner: { select: { id: true, nameAr: true } },
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    const totalPages = Math.ceil(total / perPage);
    return {
      items,
      meta: { total, page, perPage, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
    };
  }

  async findOne(id: string) {
    const course = await this.prisma.course.findFirst({
      where: { id, deletedAt: null },
      include: {
        practitioner: { select: { id: true, nameAr: true } },
        sessions: { orderBy: { sessionNumber: 'asc' } },
        enrollments: {
          include: {
            patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
            payment: { select: { id: true, status: true, amount: true } },
          },
          orderBy: { enrolledAt: 'asc' },
        },
      },
    });

    if (!course) {
      throw new NotFoundException({ statusCode: 404, message: 'Course not found', error: 'NOT_FOUND' });
    }

    return course;
  }

  async update(id: string, dto: UpdateCourseDto) {
    await this.findOne(id);

    return this.prisma.course.update({
      where: { id },
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        descriptionAr: dto.descriptionAr,
        descriptionEn: dto.descriptionEn,
        practitionerId: dto.practitionerId,
        totalSessions: dto.totalSessions,
        durationPerSessionMin: dto.durationPerSessionMin,
        frequency: dto.frequency,
        priceHalalat: dto.priceHalalat,
        isGroup: dto.isGroup,
        maxParticipants: dto.maxParticipants,
        deliveryMode: dto.deliveryMode,
        location: dto.location,
      },
      include: { practitioner: { select: { id: true, nameAr: true } } },
    });
  }

  async remove(id: string) {
    const course = await this.findOne(id);

    if (course.status !== 'draft') {
      throw new BadRequestException('Only draft courses can be deleted');
    }

    await this.prisma.course.update({ where: { id }, data: { deletedAt: new Date() } });
    return { deleted: true };
  }

  async publish(id: string) {
    const course = await this.findOne(id);

    if (course.status !== 'draft') {
      throw new BadRequestException('Only draft courses can be published');
    }

    return this.prisma.course.update({
      where: { id },
      data: { status: 'published' },
      include: { practitioner: { select: { id: true, nameAr: true } } },
    });
  }

  async cancel(id: string) {
    const course = await this.findOne(id);
    const cancellableStatuses = ['draft', 'published', 'in_progress'];

    if (!cancellableStatuses.includes(course.status)) {
      throw new BadRequestException(`Cannot cancel course with status: ${course.status}`);
    }

    const activeEnrollments = course.enrollments.filter(
      (e) => e.status === 'enrolled' || e.status === 'active',
    );

    await this.prisma.$transaction([
      this.prisma.course.update({ where: { id }, data: { status: 'archived' } }),
      this.prisma.courseEnrollment.updateMany({
        where: { courseId: id, status: { in: ['enrolled', 'active'] } },
        data: { status: 'dropped' },
      }),
    ]);

    for (const enrollment of activeEnrollments) {
      this.notifications.createNotification({
        userId: enrollment.patientId,
        titleAr: 'تم إلغاء الدورة',
        titleEn: 'Course Cancelled',
        bodyAr: `تم إلغاء دورة "${course.nameAr}" من قبل الإدارة`,
        bodyEn: `"${course.nameEn}" course has been cancelled`,
        type: NotificationType.course_cancelled,
        data: { courseId: id },
      }).catch((err: unknown) =>
        this.logger.warn('Cancellation notification failed', { error: String(err) }),
      );
    }

    return { cancelled: true };
  }

  async markAttendance(courseId: string, dto: MarkCourseAttendanceDto) {
    const course = await this.findOne(courseId);

    const session = await this.prisma.courseSession.findFirst({
      where: { id: dto.sessionId, courseId, status: 'scheduled' },
    });

    if (!session) {
      throw new NotFoundException('Scheduled session not found for this course');
    }

    await this.prisma.$transaction([
      this.prisma.courseSession.update({
        where: { id: dto.sessionId },
        data: { status: 'completed' },
      }),
      this.prisma.courseEnrollment.updateMany({
        where: {
          courseId,
          patientId: { in: dto.attendedPatientIds },
          status: { in: ['enrolled', 'active'] },
        },
        data: { sessionsAttended: { increment: 1 } },
      }),
    ]);

    this.checkCourseCompletion(courseId, course.totalSessions).catch((err: unknown) =>
      this.logger.warn('Course completion check failed', { error: String(err) }),
    );

    for (const patientId of dto.attendedPatientIds) {
      this.notifications.createNotification({
        userId: patientId,
        titleAr: 'تم تسجيل حضورك',
        titleEn: 'Attendance Marked',
        bodyAr: `تم تسجيل حضورك في الجلسة ${session.sessionNumber} من دورة "${course.nameAr}"`,
        bodyEn: `Attendance recorded for session ${session.sessionNumber} of "${course.nameEn}"`,
        type: NotificationType.course_attendance_marked,
        data: { courseId, sessionId: dto.sessionId },
      }).catch((err: unknown) =>
        this.logger.warn('Attendance notification failed', { error: String(err) }),
      );
    }

    return { marked: true, sessionNumber: session.sessionNumber };
  }

  private async checkCourseCompletion(courseId: string, totalSessions: number): Promise<void> {
    const completedCount = await this.prisma.courseSession.count({
      where: { courseId, status: 'completed' },
    });

    if (completedCount < totalSessions) return;

    const threshold = Math.ceil(totalSessions * COMPLETION_THRESHOLD);

    await this.prisma.$transaction(async (tx) => {
      await tx.course.update({ where: { id: courseId }, data: { status: 'completed' } });

      const qualifying = await tx.courseEnrollment.findMany({
        where: { courseId, status: { in: ['active', 'enrolled'] }, sessionsAttended: { gte: threshold } },
        select: { id: true, patientId: true },
      });

      if (qualifying.length > 0) {
        await tx.courseEnrollment.updateMany({
          where: { id: { in: qualifying.map((e) => e.id) } },
          data: { status: 'completed', completedAt: new Date() },
        });
      }

      for (const enrollment of qualifying) {
        this.notifications.createNotification({
          userId: enrollment.patientId,
          titleAr: 'مبروك! أتممت الدورة',
          titleEn: 'Congratulations! Course Completed',
          bodyAr: 'لقد أتممت الدورة التدريبية بنجاح',
          bodyEn: 'You have successfully completed the training course',
          type: NotificationType.course_completed,
          data: { courseId },
        }).catch((err: unknown) =>
          this.logger.warn('Completion notification failed', { error: String(err) }),
        );
      }
    });
  }

  private generateSessionDates(
    startDate: Date,
    totalSessions: number,
    frequency: 'weekly' | 'biweekly' | 'monthly',
  ): Date[] {
    const dates: Date[] = [];

    for (let i = 0; i < totalSessions; i++) {
      const date = new Date(startDate);
      if (frequency === 'weekly') {
        date.setDate(date.getDate() + i * 7);
      } else if (frequency === 'biweekly') {
        date.setDate(date.getDate() + i * 14);
      } else {
        // monthly — use setMonth to handle end-of-month correctly
        date.setMonth(date.getMonth() + i);
      }
      dates.push(date);
    }

    return dates;
  }
}
