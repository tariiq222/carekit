import { Injectable } from '@nestjs/common';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { CacheService } from '../../common/services/cache.service.js';

const CACHE_TTL_SECONDS = 300; // 5 minutes

const cacheKey = (branchId?: string) =>
  branchId ? `dashboard:stats:branch:${branchId}` : 'dashboard:stats:global';

export interface DashboardStats {
  todayBookings: number;
  pendingBookings: number;
  revenueThisMonth: number; // halalat
  activePractitioners: number;
  newPatientsThisMonth: number;
  lastUpdatedAt: string; // ISO timestamp — shown in dashboard UI
}

@Injectable()
export class DashboardStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async getStats(branchId?: string): Promise<DashboardStats> {
    const key = cacheKey(branchId);
    const cached = await this.cacheService.get<DashboardStats>(key);
    if (cached) return cached;

    const stats = await this.computeStats(branchId);
    await this.cacheService.set(key, stats, CACHE_TTL_SECONDS);
    return stats;
  }

  /** Invalidate dashboard cache after booking/payment state changes. */
  async invalidate(branchId?: string): Promise<void> {
    if (branchId) {
      await this.cacheService.del(cacheKey(branchId));
    }
    // Always invalidate global stats — they aggregate across all branches
    await this.cacheService.del(cacheKey());
  }

  // ─────────────────────────────────────────────────────────────

  private async computeStats(branchId?: string): Promise<DashboardStats> {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const bookingWhere = branchId ? { branchId } : {};

    const [
      todayBookings,
      pendingBookings,
      revenueResult,
      activePractitioners,
      newPatientsThisMonth,
    ] = await Promise.all([
      this.prisma.booking.count({
        where: {
          ...bookingWhere,
          date: { gte: startOfToday },
          deletedAt: null,
          status: {
            notIn: [BookingStatus.cancelled, BookingStatus.expired],
          },
        },
      }),

      this.prisma.booking.count({
        where: {
          ...bookingWhere,
          status: BookingStatus.pending,
          deletedAt: null,
        },
      }),

      this.prisma.payment.aggregate({
        where: {
          status: PaymentStatus.paid,
          deletedAt: null,
          createdAt: { gte: startOfMonth },
          ...(branchId ? { booking: { branchId, deletedAt: null } } : {}),
        },
        _sum: { totalAmount: true },
      }),

      branchId
        ? this.prisma.practitionerBranch.count({
            where: {
              branchId,
              practitioner: { isActive: true, deletedAt: null },
            },
          })
        : this.prisma.practitioner.count({
            where: { isActive: true, deletedAt: null },
          }),

      this.prisma.user.count({
        where: {
          createdAt: { gte: startOfMonth },
          userRoles: {
            some: { role: { slug: 'patient' } },
          },
          ...(branchId
            ? {
                bookingsAsPatient: {
                  some: { branchId, deletedAt: null },
                },
              }
            : {}),
        },
      }),
    ]);

    return {
      todayBookings,
      pendingBookings,
      revenueThisMonth: revenueResult._sum.totalAmount ?? 0,
      activePractitioners,
      newPatientsThisMonth,
      lastUpdatedAt: now.toISOString(),
    };
  }
}
