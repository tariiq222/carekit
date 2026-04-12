import { Injectable } from '@nestjs/common';
import type { BookingSettings, RefundType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface UpsertBookingSettingsCommand {
  tenantId: string;
  branchId: string | null;
  bufferMinutes?: number;
  freeCancelBeforeHours?: number;
  freeCancelRefundType?: RefundType;
  lateCancelRefundPercent?: number;
  maxReschedulesPerBooking?: number;
  autoCompleteAfterHours?: number;
  autoNoShowAfterMinutes?: number;
  minBookingLeadMinutes?: number;
  maxAdvanceBookingDays?: number;
  waitlistEnabled?: boolean;
  waitlistMaxPerSlot?: number;
}

@Injectable()
export class UpsertBookingSettingsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpsertBookingSettingsCommand): Promise<BookingSettings> {
    const { tenantId, branchId, ...fields } = cmd;

    const updateData = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined),
    );

    return this.prisma.bookingSettings.upsert({
      where: { tenantId_branchId: { tenantId, branchId } },
      update: updateData,
      create: { tenantId, branchId, ...updateData },
    });
  }
}
