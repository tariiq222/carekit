import { BookingType, RecurringFrequency } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

/**
 * Payload for creating a recurring series of bookings.
 *
 * Exactly one of `occurrences` or `until` must be provided — the handler
 * validates this and throws BadRequestException otherwise.
 *
 * For CUSTOM frequency, `customDates` must be provided; `intervalDays` is ignored.
 * For DAILY/WEEKLY, `intervalDays` controls the gap (default 1 for DAILY, 7 for WEEKLY).
 */
export class CreateRecurringBookingDto {
  @IsUUID() branchId!: string;
  @IsUUID() clientId!: string;
  @IsUUID() employeeId!: string;
  @IsUUID() serviceId!: string;

  /** First occurrence */
  @IsDateString() scheduledAt!: string;

  @IsInt() @Min(1) durationMins!: number;
  @IsNumber() @Min(0) price!: number;

  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsEnum(BookingType) bookingType?: BookingType;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsDateString() expiresAt?: string;

  @IsEnum(RecurringFrequency) frequency!: RecurringFrequency;

  /** Required for DAILY/WEEKLY. Ignored for CUSTOM. */
  @IsOptional() @IsInt() @Min(1) intervalDays?: number;

  /** Number of bookings to create (including the first). Mutually exclusive with `until`. */
  @IsOptional() @IsInt() @Min(1) occurrences?: number;

  /** Last possible date for bookings (inclusive). Mutually exclusive with `occurrences`. */
  @IsOptional() @IsDateString() until?: string;

  /** Required when frequency === 'CUSTOM'. Exact list of dates (time portion used). */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsDateString({}, { each: true })
  customDates?: string[];

  /**
   * When true, skip conflicting slots silently instead of aborting the whole series.
   * Default: false (abort on first conflict).
   */
  @IsOptional() @IsBoolean() skipConflicts?: boolean;
}
