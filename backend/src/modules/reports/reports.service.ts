import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

export interface RevenueByMonth {
  month: string;
  revenue: number;
  bookings: number;
}

export interface RevenueByPractitioner {
  practitionerId: string;
  name: string;
  revenue: number;
  bookings: number;
}

export interface RevenueByService {
  serviceId: string;
  name: string;
  revenue: number;
  bookings: number;
}

export interface RevenueReport {
  totalRevenue: number;
  totalBookings: number;
  paidBookings: number;
  averagePerBooking: number;
  byMonth: RevenueByMonth[];
  byPractitioner: RevenueByPractitioner[];
  byService: RevenueByService[];
}

export interface BookingByDay {
  date: string;
  count: number;
}

export interface BookingReport {
  total: number;
  byStatus: {
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    pending_cancellation: number;
  };
  byType: {
    clinic_visit: number;
    phone_consultation: number;
    video_consultation: number;
  };
  byDay: BookingByDay[];
}

export interface PractitionerRating {
  id: string;
  stars: number;
  comment: string | null;
  createdAt: Date;
  patientName: string;
}

export interface PractitionerReport {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  reviewCount: number;
  totalBookings: number;
  completedBookings: number;
  totalRevenue: number;
  ratings: PractitionerRating[];
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════
  //  REVENUE REPORT
  // ═══════════════════════════════════════════════════════════════

  async getRevenueReport(
    dateFrom: string,
    dateTo: string,
    practitionerId?: string,
  ): Promise<RevenueReport> {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    // Include the full end day
    to.setHours(23, 59, 59, 999);

    const bookingWhere: Record<string, unknown> = {
      date: { gte: from, lte: to },
      deletedAt: null,
    };
    if (practitionerId) {
      bookingWhere.practitionerId = practitionerId;
    }

    // Fetch all bookings in range with payment info
    const bookings = await this.prisma.booking.findMany({
      where: bookingWhere,
      include: {
        payment: true,
        practitioner: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        service: { select: { id: true, nameAr: true, nameEn: true } },
      },
    });

    const paidBookings = bookings.filter((b) => b.payment?.status === 'paid');

    const totalRevenue = paidBookings.reduce(
      (sum, b) => sum + (b.payment?.totalAmount ?? 0),
      0,
    );

    // By month aggregation
    const monthMap = new Map<string, { revenue: number; bookings: number }>();
    for (const b of paidBookings) {
      const d = new Date(b.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthMap.get(key) ?? { revenue: 0, bookings: 0 };
      existing.revenue += b.payment?.totalAmount ?? 0;
      existing.bookings += 1;
      monthMap.set(key, existing);
    }
    const byMonth: RevenueByMonth[] = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }));

    // By practitioner aggregation
    const practitionerMap = new Map<
      string,
      { name: string; revenue: number; bookings: number }
    >();
    for (const b of paidBookings) {
      const pid = b.practitionerId;
      const name = `${b.practitioner.user.firstName} ${b.practitioner.user.lastName}`;
      const existing = practitionerMap.get(pid) ?? {
        name,
        revenue: 0,
        bookings: 0,
      };
      existing.revenue += b.payment?.totalAmount ?? 0;
      existing.bookings += 1;
      practitionerMap.set(pid, existing);
    }
    const byPractitioner: RevenueByPractitioner[] = Array.from(
      practitionerMap.entries(),
    ).map(([practitionerId, data]) => ({ practitionerId, ...data }));

    // By service aggregation
    const serviceMap = new Map<
      string,
      { name: string; revenue: number; bookings: number }
    >();
    for (const b of paidBookings) {
      const sid = b.serviceId;
      const name = b.service.nameAr || b.service.nameEn;
      const existing = serviceMap.get(sid) ?? { name, revenue: 0, bookings: 0 };
      existing.revenue += b.payment?.totalAmount ?? 0;
      existing.bookings += 1;
      serviceMap.set(sid, existing);
    }
    const byService: RevenueByService[] = Array.from(
      serviceMap.entries(),
    ).map(([serviceId, data]) => ({ serviceId, ...data }));

    const averagePerBooking =
      paidBookings.length > 0
        ? Math.round(totalRevenue / paidBookings.length)
        : 0;

    return {
      totalRevenue,
      totalBookings: bookings.length,
      paidBookings: paidBookings.length,
      averagePerBooking,
      byMonth,
      byPractitioner,
      byService,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  BOOKING REPORT
  // ═══════════════════════════════════════════════════════════════

  async getBookingReport(
    dateFrom: string,
    dateTo: string,
  ): Promise<BookingReport> {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);

    const bookings = await this.prisma.booking.findMany({
      where: {
        date: { gte: from, lte: to },
        deletedAt: null,
      },
      select: {
        status: true,
        type: true,
        date: true,
      },
    });

    const byStatus = {
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      pending_cancellation: 0,
    };

    const byType = {
      clinic_visit: 0,
      phone_consultation: 0,
      video_consultation: 0,
    };

    const dayMap = new Map<string, number>();

    for (const b of bookings) {
      // Status
      const s = b.status as keyof typeof byStatus;
      if (s in byStatus) byStatus[s] += 1;

      // Type
      const t = b.type as keyof typeof byType;
      if (t in byType) byType[t] += 1;

      // By day
      const dateStr = new Date(b.date).toISOString().split('T')[0];
      dayMap.set(dateStr, (dayMap.get(dateStr) ?? 0) + 1);
    }

    const byDay: BookingByDay[] = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return {
      total: bookings.length,
      byStatus,
      byType,
      byDay,
    };
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
      return {
        id: practitionerId,
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

    const bookings = await this.prisma.booking.findMany({
      where: {
        practitionerId,
        date: { gte: from, lte: to },
        deletedAt: null,
      },
      include: { payment: true },
    });

    const completedBookings = bookings.filter(
      (b) => b.status === 'completed',
    ).length;

    const totalRevenue = bookings
      .filter((b) => b.payment?.status === 'paid')
      .reduce((sum, b) => sum + (b.payment?.totalAmount ?? 0), 0);

    const ratings = await this.prisma.rating.findMany({
      where: { practitionerId },
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { firstName: true, lastName: true } },
      },
    });

    const practitionerRatings: PractitionerRating[] = ratings.map((r) => ({
      id: r.id,
      stars: r.stars,
      comment: r.comment,
      createdAt: r.createdAt,
      patientName: r.patient
        ? `${r.patient.firstName} ${r.patient.lastName}`
        : 'مريض',
    }));

    return {
      id: practitioner.id,
      name: `${practitioner.user.firstName} ${practitioner.user.lastName}`,
      specialty:
        practitioner.specialty.nameAr || practitioner.specialty.nameEn,
      rating: practitioner.rating,
      reviewCount: practitioner.reviewCount,
      totalBookings: bookings.length,
      completedBookings,
      totalRevenue,
      ratings: practitionerRatings,
    };
  }
}
