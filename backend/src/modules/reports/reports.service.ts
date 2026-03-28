import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { RevenueQueriesService } from './revenue-queries.service.js';
import type {
  RevenueReport,
  BookingReport,
  BookingByDay,
  PractitionerReport,
  PractitionerRating,
  BookingStatusRow,
  BookingTypeRow,
  BookingByDayRow,
} from './reports.interfaces.js';

// Re-export interfaces for backward compatibility
export type {
  RevenueReport,
  RevenueByMonth,
  RevenueByPractitioner,
  RevenueByService,
  BookingReport,
  BookingByDay,
  PractitionerReport,
  PractitionerRating,
} from './reports.interfaces.js';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly revenueQueries: RevenueQueriesService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  //  REVENUE REPORT — delegates to RevenueQueriesService
  // ═══════════════════════════════════════════════════════════════

  async getRevenueReport(
    dateFrom: string,
    dateTo: string,
    practitionerId?: string,
    branchId?: string,
  ): Promise<RevenueReport> {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);

    const [byMonth, byPractitioner, byService, totals] = await Promise.all([
      this.revenueQueries.getByMonth(from, to, practitionerId, branchId),
      this.revenueQueries.getByPractitioner(from, to, practitionerId, branchId),
      this.revenueQueries.getByService(from, to, practitionerId, branchId),
      this.revenueQueries.getTotals(from, to, practitionerId, branchId),
    ]);

    return { ...totals, byMonth, byPractitioner, byService };
  }

  // ═══════════════════════════════════════════════════════════════
  //  BOOKING REPORT — SQL aggregation
  // ═══════════════════════════════════════════════════════════════

  async getBookingReport(
    dateFrom: string,
    dateTo: string,
    branchId?: string,
  ): Promise<BookingReport> {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    const bookingWhere: Prisma.BookingWhereInput = {
      date: { gte: from, lte: to },
      deletedAt: null,
      ...(branchId ? { branchId } : {}),
    };

    const [total, statusRows, typeRows, dayRows] = await Promise.all([
      this.prisma.booking.count({ where: bookingWhere }),
      this.getBookingsByStatus(from, to, branchId),
      this.getBookingsByType(from, to, branchId),
      this.getBookingsByDay(from, to, branchId),
    ]);

    const byStatus = {
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      pending_cancellation: 0,
    };
    for (const row of statusRows) {
      const key = row.status as keyof typeof byStatus;
      if (key in byStatus) byStatus[key] = Number(row.count);
    }

    const byType = {
      in_person: 0,
      online: 0,
      walk_in: 0,
    };
    for (const row of typeRows) {
      const key = row.type as keyof typeof byType;
      if (key in byType) byType[key] = Number(row.count);
    }

    const byDay: BookingByDay[] = dayRows.map((r) => ({
      date: new Date(r.date).toISOString().split('T')[0],
      count: Number(r.count),
    }));

    return { total, byStatus, byType, byDay };
  }

  private async getBookingsByStatus(
    from: Date,
    to: Date,
    branchId?: string,
  ): Promise<BookingStatusRow[]> {
    if (branchId) {
      return this.prisma.$queryRaw<BookingStatusRow[]>`
        SELECT status::text, COUNT(*)::bigint AS count
        FROM bookings
        WHERE date >= ${from}
          AND date <= ${to}
          AND deleted_at IS NULL
          AND branch_id = ${branchId}::uuid
        GROUP BY status`;
    }

    return this.prisma.$queryRaw<BookingStatusRow[]>`
      SELECT status::text, COUNT(*)::bigint AS count
      FROM bookings
      WHERE date >= ${from}
        AND date <= ${to}
        AND deleted_at IS NULL
      GROUP BY status`;
  }

  private async getBookingsByType(
    from: Date,
    to: Date,
    branchId?: string,
  ): Promise<BookingTypeRow[]> {
    if (branchId) {
      return this.prisma.$queryRaw<BookingTypeRow[]>`
        SELECT type::text, COUNT(*)::bigint AS count
        FROM bookings
        WHERE date >= ${from}
          AND date <= ${to}
          AND deleted_at IS NULL
          AND branch_id = ${branchId}::uuid
        GROUP BY type`;
    }

    return this.prisma.$queryRaw<BookingTypeRow[]>`
      SELECT type::text, COUNT(*)::bigint AS count
      FROM bookings
      WHERE date >= ${from}
        AND date <= ${to}
        AND deleted_at IS NULL
      GROUP BY type`;
  }

  private async getBookingsByDay(
    from: Date,
    to: Date,
    branchId?: string,
  ): Promise<BookingByDayRow[]> {
    if (branchId) {
      return this.prisma.$queryRaw<BookingByDayRow[]>`
        SELECT date::date AS date, COUNT(*)::bigint AS count
        FROM bookings
        WHERE date >= ${from}
          AND date <= ${to}
          AND deleted_at IS NULL
          AND branch_id = ${branchId}::uuid
        GROUP BY date::date
        ORDER BY date`;
    }

    return this.prisma.$queryRaw<BookingByDayRow[]>`
      SELECT date::date AS date, COUNT(*)::bigint AS count
      FROM bookings
      WHERE date >= ${from}
        AND date <= ${to}
        AND deleted_at IS NULL
      GROUP BY date::date
      ORDER BY date`;
  }

  // ═══════════════════════════════════════════════════════════════
  //  PRACTITIONER REPORT
  // ═══════════════════════════════════════════════════════════════

  async getPractitionerReport(
    practitionerId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<PractitionerReport> {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);

    const practitioner = await this.prisma.practitioner.findFirst({
      where: { id: practitionerId, deletedAt: null },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    if (!practitioner) {
      return this.emptyPractitionerReport(practitionerId);
    }

    const bookingWhere = {
      practitionerId,
      date: { gte: from, lte: to },
      deletedAt: null as Date | null,
    };

    const [totalBookings, completedBookings, revenueAgg, ratings] =
      await Promise.all([
        this.prisma.booking.count({ where: bookingWhere }),
        this.prisma.booking.count({
          where: { ...bookingWhere, status: 'completed' },
        }),
        this.prisma.payment.aggregate({
          _sum: { totalAmount: true },
          where: { status: 'paid', booking: bookingWhere },
        }),
        this.prisma.rating.findMany({
          where: { practitionerId },
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            patient: { select: { firstName: true, lastName: true } },
          },
        }),
      ]);

    const practitionerRatings: PractitionerRating[] = ratings.map((r) => ({
      id: r.id,
      stars: r.stars,
      comment: r.comment,
      createdAt: r.createdAt,
      patientName: r.patient
        ? `${r.patient.firstName} ${r.patient.lastName}`
        : '\u0645\u0631\u064A\u0636',
    }));

    return {
      id: practitioner.id,
      name: `${practitioner.user.firstName} ${practitioner.user.lastName}`,
      specialty:
        practitioner.specialtyAr || practitioner.specialty,
      rating: practitioner.rating,
      reviewCount: practitioner.reviewCount,
      totalBookings,
      completedBookings,
      totalRevenue: revenueAgg._sum.totalAmount ?? 0,
      ratings: practitionerRatings,
    };
  }

  private emptyPractitionerReport(id: string): PractitionerReport {
    return {
      id,
      name: 'Unknown',
      specialty: '',
      rating: 0,
      reviewCount: 0,
      totalBookings: 0,
      completedBookings: 0,
      totalRevenue: 0,
      ratings: [],
    };
  }
}
