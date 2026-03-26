import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ProblemReportStatus, ProblemReportType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { parsePaginationParams, buildPaginationMeta } from '../../common/helpers/pagination.helper.js';

const ADMIN_ROLE_SLUGS = ['super_admin', 'receptionist'];

interface CreateReportInput {
  bookingId: string;
  patientId: string;
  type: string;
  description: string;
}

interface ResolveReportInput {
  status: string;
  adminNotes?: string;
}

interface ReportListQuery {
  page?: number;
  perPage?: number;
  status?: string;
  patientId?: string;
}

@Injectable()
export class ProblemReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateReportInput) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: dto.bookingId, patientId: dto.patientId, deletedAt: null },
      select: { id: true, status: true, date: true, practitionerId: true },
    });

    if (!booking) {
      throw new NotFoundException({ statusCode: 404, message: 'Booking not found', error: 'NOT_FOUND' });
    }

    if (booking.status !== 'completed') {
      throw new BadRequestException(
        'Can only report problems for completed bookings',
      );
    }

    const report = await this.prisma.problemReport.create({
      data: {
        bookingId: dto.bookingId,
        patientId: dto.patientId,
        type: dto.type as ProblemReportType,
        description: dto.description,
        status: 'open',
      },
      include: {
        booking: { select: { date: true, startTime: true } },
        patient: { select: { firstName: true, lastName: true } },
      },
    });

    await this.notifyAdmins(report.id, dto);

    return report;
  }

  async findAll(query: ReportListQuery) {
    const { page, perPage, skip } = parsePaginationParams(query.page, query.perPage);
    const { status, patientId } = query;

    const where: Prisma.ProblemReportWhereInput = {};
    if (status) {
      where.status = status as ProblemReportStatus;
    }
    if (patientId) {
      where.patientId = patientId;
    }

    const [items, total] = await Promise.all([
      this.prisma.problemReport.findMany({
        where,
        include: {
          booking: {
            select: { date: true, startTime: true, type: true },
          },
          patient: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          resolvedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.problemReport.count({ where }),
    ]);

    return {
      items,
      meta: buildPaginationMeta(total, page, perPage),
    };
  }

  async findOne(id: string) {
    const report = await this.prisma.problemReport.findUnique({
      where: { id },
      include: {
        booking: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            type: true,
            status: true,
          },
        },
        patient: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        resolvedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!report) {
      throw new NotFoundException({ statusCode: 404, message: 'Problem report not found', error: 'NOT_FOUND' });
    }

    return report;
  }

  async resolve(id: string, adminId: string, dto: ResolveReportInput) {
    const report = await this.prisma.problemReport.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!report) {
      throw new NotFoundException({ statusCode: 404, message: 'Problem report not found', error: 'NOT_FOUND' });
    }

    if (report.status === 'resolved' || report.status === 'dismissed') {
      throw new BadRequestException('Report is already resolved or dismissed');
    }

    return this.prisma.problemReport.update({
      where: { id },
      data: {
        status: dto.status as ProblemReportStatus,
        adminNotes: dto.adminNotes,
        resolvedById: adminId,
        resolvedAt: new Date(),
      },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        resolvedBy: { select: { firstName: true, lastName: true } },
      },
    });
  }

  private async notifyAdmins(reportId: string, dto: CreateReportInput) {
    const adminRoles = await this.prisma.userRole.findMany({
      where: { role: { slug: { in: ADMIN_ROLE_SLUGS } } },
      select: { userId: true },
    });

    for (const { userId } of adminRoles) {
      await this.notificationsService.createNotification({
        userId,
        titleAr: 'بلاغ مشكلة جديد',
        titleEn: 'New Problem Report',
        bodyAr: `قام مريض بالإبلاغ عن مشكلة: ${dto.type}`,
        bodyEn: `A patient reported a problem: ${dto.type}`,
        type: 'problem_report',
        data: { reportId, bookingId: dto.bookingId },
      });
    }
  }
}
