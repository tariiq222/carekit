import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBookingSettingsDto {
  // ── Payment ──────────────────────────────────────────────────────
  @ApiPropertyOptional({ minimum: 5, maximum: 1440 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  paymentTimeoutMinutes?: number;

  // ── Cancellation ─────────────────────────────────────────────────
  @ApiPropertyOptional({ minimum: 0, maximum: 168 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(168)
  freeCancelBeforeHours?: number;

  @ApiPropertyOptional({ enum: ['full', 'partial', 'none'] })
  @IsOptional()
  @IsIn(['full', 'partial', 'none'])
  freeCancelRefundType?: string;

  @ApiPropertyOptional({ enum: ['full', 'partial', 'none'] })
  @IsOptional()
  @IsIn(['full', 'partial', 'none'])
  lateCancelRefundType?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  lateCancelRefundPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  adminCanDirectCancel?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  patientCanCancelPending?: boolean;

  // ── Rescheduling ─────────────────────────────────────────────────
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  patientCanReschedule?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 168 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(168)
  rescheduleBeforeHours?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  maxReschedulesPerBooking?: number;

  // ── Walk-in ──────────────────────────────────────────────────────
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowWalkIn?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  walkInPaymentRequired?: boolean;

  // ── Recurring ────────────────────────────────────────────────────
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowRecurring?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 52 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(52)
  maxRecurringWeeks?: number;

  // ── Waitlist ─────────────────────────────────────────────────────
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  waitlistEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  waitlistMaxPerSlot?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  waitlistAutoNotify?: boolean;

  // ── Buffer ───────────────────────────────────────────────────────
  @ApiPropertyOptional({ minimum: 0, maximum: 120 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  bufferMinutes?: number;

  // ── Auto-complete / No-show ──────────────────────────────────────
  @ApiPropertyOptional({ minimum: 1, maximum: 48 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(48)
  autoCompleteAfterHours?: number;

  @ApiPropertyOptional({ minimum: 5, maximum: 120 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  autoNoShowAfterMinutes?: number;

  // ── Reminders ────────────────────────────────────────────────────
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reminder24hEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reminder1hEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reminderInteractive?: boolean;

  // ── Suggestions ──────────────────────────────────────────────────
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  suggestAlternativesOnConflict?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  suggestAlternativesCount?: number;
}
