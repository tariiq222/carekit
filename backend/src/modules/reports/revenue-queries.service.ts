import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  RevenueByMonth,
  RevenueByPractitioner,
  RevenueByService,
  RevenueByMonthRow,
  RevenueByPractitionerRow,
  RevenueByServiceRow,
} from './reports.interfaces.js';

@Injectable()
export class RevenueQueriesService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════
  //  BY MONTH — raw SQL aggregation
  // ═══════════════════════════════════════════════════════════════

  async getByMonth(
    from: Date,
    to: Date,
    practitionerId?: string,
    branchId?: string,
  ): Promise<RevenueByMonth[]> {
    const rows = await this.prisma.$queryRaw<RevenueByMonthRow[]>(
      Prisma.sql`
        SELECT DATE_TRUNC('month', b.date) AS month,
               COUNT(*)::int AS bookings,
               COALESCE(SUM(p.total_amount), 0)::bigint AS revenue
        FROM bookings b
        JOIN payments p ON p.booking_id = b.id
                       AND p.status = 'paid'::"payment_status"
        ${this.buildBookingWhere(from, to, practitionerId, branchId)}
        GROUP BY DATE_TRUNC('month', b.date)
        ORDER BY month
      `,
    );

    return rows.map((r) => ({
      month: this.formatMonth(r.month),
      bookings: r.bookings,
      revenue: Number(r.revenue),
    }));
  }

  // ═══════════════════════════════════════════════════════════════
  //  BY PRACTITIONER — raw SQL aggregation
  // ═══════════════════════════════════════════════════════════════

  async getByPractitioner(
    from: Date,
    to: Date,
    practitionerId?: string,
    branchId?: string,
  ): Promise<RevenueByPractitioner[]> {
    const rows = await this.prisma.$queryRaw<RevenueByPractitionerRow[]>(
      Prisma.sql`
        SELECT b.practitioner_id,
               u.first_name,
               u.last_name,
               COUNT(*)::int AS bookings,
               COALESCE(SUM(p.total_amount), 0)::bigint AS revenue
        FROM bookings b
        JOIN payments p ON p.booking_id = b.id
                       AND p.status = 'paid'::"payment_status"
        JOIN practitioners pr ON pr.id = b.practitioner_id
        JOIN users u ON u.id = pr.user_id
        ${this.buildBookingWhere(from, to, practitionerId, branchId)}
        GROUP BY b.practitioner_id, u.first_name, u.last_name
      `,
    );

    return rows.map((r) => ({
      practitionerId: r.practitioner_id,
      name: `${r.first_name} ${r.last_name}`,
      bookings: r.bookings,
      revenue: Number(r.revenue),
    }));
  }

  // ═══════════════════════════════════════════════════════════════
  //  BY SERVICE — raw SQL aggregation
  // ═══════════════════════════════════════════════════════════════

  async getByService(
    from: Date,
    to: Date,
    practitionerId?: string,
    branchId?: string,
  ): Promise<RevenueByService[]> {
    const rows = await this.prisma.$queryRaw<RevenueByServiceRow[]>(
      Prisma.sql`
        SELECT b.service_id,
               s.name_ar,
               s.name_en,
               COUNT(*)::int AS bookings,
               COALESCE(SUM(p.total_amount), 0)::bigint AS revenue
        FROM bookings b
        JOIN payments p ON p.booking_id = b.id
                       AND p.status = 'paid'::"payment_status"
        JOIN services s ON s.id = b.service_id
        ${this.buildBookingWhere(from, to, practitionerId, branchId)}
        GROUP BY b.service_id, s.name_ar, s.name_en
      `,
    );

    return rows.map((r) => ({
      serviceId: r.service_id,
      name: r.name_ar || r.name_en,
      bookings: r.bookings,
      revenue: Number(r.revenue),
    }));
  }

  // ═══════════════════════════════════════════════════════════════
  //  TOTALS — Prisma aggregate + count
  // ═══════════════════════════════════════════════════════════════

  async getTotals(from: Date, to: Date, practitionerId?: string, branchId?: string) {
    const where: Prisma.BookingWhereInput = {
      date: { gte: from, lte: to },
      deletedAt: null,
      ...(practitionerId ? { practitionerId } : {}),
      ...(branchId ? { branchId } : {}),
    };

    const [totalBookings, paidAggregate] = await Promise.all([
      this.prisma.booking.count({ where }),
      this.prisma.payment.aggregate({
        _sum: { totalAmount: true },
        _count: true,
        where: { status: 'paid', booking: where },
      }),
    ]);

    const totalRevenue = paidAggregate._sum.totalAmount ?? 0;
    const paidBookings = paidAggregate._count;
    const averagePerBooking =
      paidBookings > 0 ? Math.round(totalRevenue / paidBookings) : 0;

    return { totalRevenue, totalBookings, paidBookings, averagePerBooking };
  }

  private formatMonth(date: Date): string {
    const d = new Date(date);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private buildBookingWhere(
    from: Date,
    to: Date,
    practitionerId?: string,
    branchId?: string,
  ): Prisma.Sql {
    const filters: Prisma.Sql[] = [
      Prisma.sql`b.date >= ${from}`,
      Prisma.sql`b.date <= ${to}`,
      Prisma.sql`b.deleted_at IS NULL`,
    ];

    if (practitionerId) {
      filters.push(Prisma.sql`b.practitioner_id = ${practitionerId}::uuid`);
    }

    if (branchId) {
      filters.push(Prisma.sql`b.branch_id = ${branchId}::uuid`);
    }

    return Prisma.sql`WHERE ${Prisma.join(filters, ' AND ')}`;
  }
}
