import { BookingType } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateBookingDto {
  @IsUUID() branchId!: string;
  @IsUUID() clientId!: string;
  @IsUUID() employeeId!: string;
  @IsUUID() serviceId!: string;
  @IsDateString() scheduledAt!: string;

  /** Optional — resolves price/duration from this specific ServiceDurationOption */
  @IsOptional() @IsUUID() durationOptionId?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsEnum(BookingType) bookingType?: BookingType;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsUUID() groupSessionId?: string;
  @IsOptional() @IsBoolean() payAtClinic?: boolean;
  @IsOptional() @IsString() couponCode?: string;
  @IsOptional() @IsString() giftCardCode?: string;
}
