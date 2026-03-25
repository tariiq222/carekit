import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
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

  // ── No-show policy ──────────────────────────────────────────────
  @ApiPropertyOptional({ enum: ['keep_full', 'partial_refund', 'admin_decides'] })
  @IsOptional()
  @IsIn(['keep_full', 'partial_refund', 'admin_decides'])
  noShowPolicy?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  noShowRefundPercent?: number;

  // ── Cancellation review timeout ────────────────────────────────
  @ApiPropertyOptional({ minimum: 1, maximum: 168 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  cancellationReviewTimeoutHours?: number;

  // ── Cancellation policy text ─────────────────────────────────
  @ApiPropertyOptional({ description: 'Cancellation policy text displayed to patients (English)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  cancellationPolicyEn?: string;

  @ApiPropertyOptional({ description: 'Cancellation policy text displayed to patients (Arabic)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  cancellationPolicyAr?: string;

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

  // ── Lead time ──────────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Minimum minutes before appointment for booking', minimum: 0, maximum: 1440 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  minBookingLeadMinutes?: number;

  // ── Admin override ────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Allow admin to book outside clinic working hours' })
  @IsOptional()
  @IsBoolean()
  adminCanBookOutsideHours?: boolean;

  // ── Advance booking window ────────────────────────────────────
  @ApiPropertyOptional({ description: 'Maximum days in advance a booking can be made (0 = no limit)', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxAdvanceBookingDays?: number;
}
