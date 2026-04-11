import { PrismaService } from '../../../infrastructure/database';
import { PaymentStatus, BookingStatus } from '@prisma/client';

export interface RevenueReportParams {
  tenantId: string;
  from: Date;
  to: Date;
  branchId?: string;
  employeeId?: string;
}

export interface RevenueReportResult {
  period: { from: string; to: string };
  summary: {
    totalRevenue: number;
    totalPayments: number;
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    averageBookingValue: number;
  };
  byBranch: Array<{ branchId: string; revenue: number; count: number }>;
  byEmployee: Array<{ employeeId: string; revenue: number; count: number }>;
  byDay: Array<{ date: string; revenue: number; count: number }>;
}

export async function buildRevenueReport(
  prisma: PrismaService,
  params: RevenueReportParams,
): Promise<RevenueReportResult> {
  const { tenantId, from, to, branchId, employeeId } = params;

  const bookingWhere = {
    tenantId,
    scheduledAt: { gte: from, lte: to },
    ...(branchId ? { branchId } : {}),
    ...(employeeId ? { employeeId } : {}),
  };

  const [bookings, payments] = await Promise.all([
    prisma.booking.findMany({
      where: bookingWhere,
      select: {
        id: true,
        status: true,
        price: true,
        branchId: true,
        employeeId: true,
        scheduledAt: true,
      },
    }),
    prisma.payment.findMany({
      where: {
        tenantId,
        createdAt: { gte: from, lte: to },
        status: PaymentStatus.COMPLETED,
      },
      select: { amount: true, createdAt: true },
    }),
  ]);

  const completedBookings = bookings.filter((b) => b.status === BookingStatus.COMPLETED);
  const cancelledBookings = bookings.filter((b) => b.status === BookingStatus.CANCELLED);
  const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  // By branch
  const branchMap = new Map<string, { revenue: number; count: number }>();
  for (const b of completedBookings) {
    const existing = branchMap.get(b.branchId) ?? { revenue: 0, count: 0 };
    branchMap.set(b.branchId, {
      revenue: existing.revenue + Number(b.price),
      count: existing.count + 1,
    });
  }

  // By employee
  const employeeMap = new Map<string, { revenue: number; count: number }>();
  for (const b of completedBookings) {
    const existing = employeeMap.get(b.employeeId) ?? { revenue: 0, count: 0 };
    employeeMap.set(b.employeeId, {
      revenue: existing.revenue + Number(b.price),
      count: existing.count + 1,
    });
  }

  // By day
  const dayMap = new Map<string, { revenue: number; count: number }>();
  for (const p of payments) {
    const day = p.createdAt.toISOString().slice(0, 10);
    const existing = dayMap.get(day) ?? { revenue: 0, count: 0 };
    dayMap.set(day, {
      revenue: existing.revenue + Number(p.amount),
      count: existing.count + 1,
    });
  }

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    summary: {
      totalRevenue,
      totalPayments: payments.length,
      totalBookings: bookings.length,
      completedBookings: completedBookings.length,
      cancelledBookings: cancelledBookings.length,
      averageBookingValue:
        completedBookings.length > 0 ? totalRevenue / completedBookings.length : 0,
    },
    byBranch: [...branchMap.entries()].map(([branchId, v]) => ({ branchId, ...v })),
    byEmployee: [...employeeMap.entries()].map(([employeeId, v]) => ({ employeeId, ...v })),
    byDay: [...dayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v })),
  };
}
