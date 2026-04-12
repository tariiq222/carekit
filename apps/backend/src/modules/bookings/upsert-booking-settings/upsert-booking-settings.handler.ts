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
  payAtClinicEnabled?: boolean;
  requireCancelApproval?: boolean;
  autoRefundOnCancel?: boolean;
}

@Injectable()
export class UpsertBookingSettingsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpsertBookingSettingsCommand): Promise<BookingSettings> {
    const { tenantId, branchId, ...fields } = cmd;

    const updateData = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined),
    );

    const existing = await this.prisma.bookingSettings.findFirst({
      where: { tenantId, branchId },
    });

    if (existing) {
      return this.prisma.bookingSettings.update({
        where: { id: existing.id },
        data: updateData,
      });
    }

    return this.prisma.bookingSettings.create({
      data: { tenantId, branchId, ...updateData },
    });
  }
}
