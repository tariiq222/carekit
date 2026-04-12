import { Injectable } from '@nestjs/common';
import type { BookingSettings } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface GetBookingSettingsQuery {
  tenantId: string;
  branchId: string | null;
}

/** Hardcoded fallback used when no DB row exists for the tenant at all. */
export const DEFAULT_BOOKING_SETTINGS = {
  bufferMinutes: 0,
  freeCancelBeforeHours: 24,
  freeCancelRefundType: 'FULL' as const,
  lateCancelRefundPercent: 0,
  maxReschedulesPerBooking: 3,
  autoCompleteAfterHours: 2,
  autoNoShowAfterMinutes: 30,
  minBookingLeadMinutes: 60,
  maxAdvanceBookingDays: 90,
  waitlistEnabled: true,
  waitlistMaxPerSlot: 5,
  payAtClinicEnabled: false,
  requireCancelApproval: false,
  autoRefundOnCancel: true,
} as const;

export type ResolvedBookingSettings = typeof DEFAULT_BOOKING_SETTINGS;

@Injectable()
export class GetBookingSettingsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetBookingSettingsQuery): Promise<BookingSettings | ResolvedBookingSettings> {
    if (query.branchId) {
      const branchRow = await this.prisma.bookingSettings.findUnique({
        where: { tenantId_branchId: { tenantId: query.tenantId, branchId: query.branchId } },
      });
      if (branchRow) return branchRow;
    }

    const globalRow = await this.prisma.bookingSettings.findUnique({
      where: { tenantId_branchId: { tenantId: query.tenantId, branchId: null } },
    });
    if (globalRow) return globalRow;

    return DEFAULT_BOOKING_SETTINGS;
  }
}
