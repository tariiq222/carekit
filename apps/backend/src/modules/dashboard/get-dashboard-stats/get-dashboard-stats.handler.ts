import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { BookingStatus, PaymentStatus, PaymentMethod } from '@prisma/client';

export interface DashboardStats {
  todayBookings: number;
  confirmedToday: number;
  pendingToday: number;
  pendingPayments: number;
  cancelRequests: number;
  todayRevenue: number;
}

@Injectable()
export class GetDashboardStatsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(): Promise<DashboardStats> {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      todayBookingsCount,
      confirmedCount,
      pendingCount,
      cancelRequestedCount,
      pendingPaymentsCount,
      revenueResult,
    ] = await Promise.all([
      // Total bookings scheduled today
      this.prisma.booking.count({
        where: {
          organizationId,
          scheduledAt: { gte: today, lt: tomorrow },
        },
      }),

      // Confirmed bookings scheduled today
      this.prisma.booking.count({
        where: {
          organizationId,
          scheduledAt: { gte: today, lt: tomorrow },
          status: BookingStatus.CONFIRMED,
        },
      }),

      // Pending bookings scheduled today
      this.prisma.booking.count({
        where: {
          organizationId,
          scheduledAt: { gte: today, lt: tomorrow },
          status: BookingStatus.PENDING,
        },
      }),

      // Cancel-requested bookings
      this.prisma.booking.count({
        where: {
          organizationId,
          status: BookingStatus.CANCEL_REQUESTED,
        },
      }),

      // Pending bank transfer payments
      this.prisma.payment.count({
        where: {
          invoice: { organizationId },
          method: PaymentMethod.BANK_TRANSFER,
          status: PaymentStatus.PENDING_VERIFICATION,
        },
      }),

      // Today's revenue: sum of COMPLETED payments processed today
      this.prisma.payment.aggregate({
        where: {
          invoice: { organizationId },
          status: PaymentStatus.COMPLETED,
          processedAt: { gte: today, lt: tomorrow },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      todayBookings: todayBookingsCount,
      confirmedToday: confirmedCount,
      pendingToday: pendingCount,
      cancelRequests: cancelRequestedCount,
      pendingPayments: pendingPaymentsCount,
      todayRevenue: Number(revenueResult._sum.amount?.toString() ?? 0),
    };
  }
}
