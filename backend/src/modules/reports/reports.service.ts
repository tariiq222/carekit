import { Injectable } from '@nestjs/common';
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
  ): Promise<RevenueReport> {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);

    const [byMonth, byPractitioner, byService, totals] = await Promise.all([
      this.revenueQueries.getByMonth(from, to, practitionerId),
      this.revenueQueries.getByPractitioner(from, to, practitionerId),
      this.revenueQueries.getByService(from, to, practitionerId),
      this.revenueQueries.getTotals(from, to, practitionerId),
    ]);

    return { ...totals, byMonth, byPractitioner, byService };
  }

  // ═══════════════════════════════════════════════════════════════
  //  BOOKING REPORT — SQL aggregation
  // ═══════════════════════════════════════════════════════════════

  async getBookingReport(
    dateFrom: string,
    dateTo: string,
  ): Promise<BookingReport> {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);

    const [total, statusRows, typeRows, dayRows] = await Promise.all([
      this.prisma.booking.count({
        where: { date: { gte: from, lte: to }, deletedAt: null },
      }),
      this.getBookingsByStatus(from, to),
      this.getBookingsByType(from, to),
      this.getBookingsByDay(from, to),
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
      clinic_visit: 0,
      phone_consultation: 0,
      video_consultation: 0,
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
  ): Promise<BookingStatusRow[]> {
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
  ): Promise<BookingTypeRow[]> {
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
  ): Promise<BookingByDayRow[]> {
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
        specialty: { select: { nameEn: true, nameAr: true } },
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
        practitioner.specialty.nameAr || practitioner.specialty.nameEn,
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
