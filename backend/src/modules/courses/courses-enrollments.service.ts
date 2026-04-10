import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, NotificationType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

type CourseRow = Prisma.CourseGetPayload<{
  select: {
    id: true;
    nameAr: true;
    nameEn: true;
    priceHalalat: true;
    isGroup: true;
    maxParticipants: true;
    currentEnrollment: true;
    status: true;
  };
}>;

@Injectable()
export class CoursesEnrollmentsService {
  private readonly logger = new Logger(CoursesEnrollmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async enroll(courseId: string, patientId: string) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, deletedAt: null },
      select: {
        id: true, nameAr: true, nameEn: true, priceHalalat: true,
        isGroup: true, maxParticipants: true, currentEnrollment: true, status: true,
      },
    });

    if (!course) throw new NotFoundException('Course not found');

    if (!['published', 'in_progress'].includes(course.status)) {
      throw new BadRequestException('Course is not open for enrollment');
    }

    if (course.isGroup && course.maxParticipants !== null && course.currentEnrollment >= course.maxParticipants) {
      throw new BadRequestException('Course is full');
    }

    const existing = await this.prisma.courseEnrollment.findFirst({
      where: { courseId, patientId, status: { notIn: ['dropped', 'refunded'] } },
    });

    if (existing) throw new ConflictException('Patient is already enrolled in this course');

    if (course.priceHalalat === 0) {
      return this.enrollFree(course, patientId);
    }

    return this.enrollPaid(course, patientId);
  }

  private async enrollFree(course: CourseRow, patientId: string) {
    const enrollment = await this.prisma.courseEnrollment.create({
      data: { courseId: course.id, patientId, status: 'active' },
    });

    await this.prisma.course.update({
      where: { id: course.id },
      data: {
        currentEnrollment: { increment: 1 },
        ...(course.status === 'published' && { status: 'in_progress' }),
      },
    });

    this.notifications.createNotification({
      userId: patientId,
      titleAr: `تم تسجيلك في دورة "${course.nameAr}"`,
      titleEn: `You've been enrolled in "${course.nameEn}"`,
      bodyAr: 'تسجيلك مؤكد. نراك في الجلسات القادمة.',
      bodyEn: 'Your enrollment is confirmed. See you in the upcoming sessions.',
      type: NotificationType.course_enrolled,
      data: { courseId: course.id },
    }).catch((err: unknown) =>
      this.logger.warn('Enrollment notification failed', { error: String(err) }),
    );

    return enrollment;
  }

  private async enrollPaid(course: CourseRow, patientId: string) {
    const enrollment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.courseEnrollment.create({
        data: { courseId: course.id, patientId, status: 'enrolled' },
      });

      await tx.coursePayment.create({
        data: {
          enrollmentId: created.id,
          courseId: course.id,
          amount: course.priceHalalat,
          method: 'moyasar',
          status: 'pending',
        },
      });

      await tx.course.update({
        where: { id: course.id },
        data: {
          currentEnrollment: { increment: 1 },
          ...(course.status === 'published' && { status: 'in_progress' }),
        },
      });

      return created;
    });

    this.notifications.createNotification({
      userId: patientId,
      titleAr: `تم تسجيلك في دورة "${course.nameAr}"`,
      titleEn: `Enrolled in "${course.nameEn}"`,
      bodyAr: 'أكمل الدفع لتفعيل تسجيلك في الدورة.',
      bodyEn: 'Complete your payment to activate your enrollment.',
      type: NotificationType.course_enrolled,
      data: { courseId: course.id },
    }).catch((err: unknown) =>
      this.logger.warn('Enrollment notification failed', { error: String(err) }),
    );

    // paymentUrl: null — Moyasar initiation handled separately in v2
    return { enrollment, paymentUrl: null };
  }

  async dropEnrollment(enrollmentId: string): Promise<{ dropped: true }> {
    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: { id: enrollmentId },
    });

    if (!enrollment) throw new NotFoundException('Enrollment not found');

    if (!['enrolled', 'active'].includes(enrollment.status)) {
      throw new BadRequestException(`Cannot drop enrollment with status: ${enrollment.status}`);
    }

    await this.prisma.$transaction([
      this.prisma.courseEnrollment.update({ where: { id: enrollmentId }, data: { status: 'dropped' } }),
      this.prisma.course.update({
        where: { id: enrollment.courseId },
        data: { currentEnrollment: { decrement: 1 } },
      }),
    ]);

    return { dropped: true };
  }

  async refundEnrollment(enrollmentId: string): Promise<{ refunded: true }> {
    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { payment: { select: { id: true } } },
    });

    if (!enrollment) throw new NotFoundException('Enrollment not found');

    if (enrollment.status !== 'dropped') {
      throw new BadRequestException('Can only refund dropped enrollments');
    }

    await this.prisma.courseEnrollment.update({
      where: { id: enrollmentId },
      data: { status: 'refunded' },
    });

    if (enrollment.payment) {
      await this.prisma.coursePayment.update({
        where: { id: enrollment.payment.id },
        data: { status: 'refunded', refundedAt: new Date() },
      });
    }

    return { refunded: true };
  }
}
