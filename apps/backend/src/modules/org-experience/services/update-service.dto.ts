import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { RecurringPatternDto } from './create-service.dto';

export class UpdateServiceDto {
  // ─── الأساسيات ───────────────────────────────────────────────────────────
  @IsOptional() @IsString() @MaxLength(200) nameAr?: string;
  @IsOptional() @IsString() @MaxLength(200) nameEn?: string;
  @IsOptional() @IsString() descriptionAr?: string;
  @IsOptional() @IsString() descriptionEn?: string;
  @IsOptional() @IsInt() @Min(1) durationMins?: number;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsUUID() categoryId?: string;

  // ─── العرض/الإخفاء ───────────────────────────────────────────────────────
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() isHidden?: boolean;
  @IsOptional() @IsBoolean() hidePriceOnBooking?: boolean;
  @IsOptional() @IsBoolean() hideDurationOnBooking?: boolean;

  // ─── الهوية البصرية ───────────────────────────────────────────────────────
  @IsOptional() @IsString() @MaxLength(50) iconName?: string;
  @IsOptional() @IsString() @MaxLength(20) iconBgColor?: string;

  // ─── قواعد الجدولة ───────────────────────────────────────────────────────
  @IsOptional() @IsInt() @Min(0) bufferMinutes?: number;
  @IsOptional() @IsInt() @Min(0) minLeadMinutes?: number;
  @IsOptional() @IsInt() @Min(1) maxAdvanceDays?: number;

  // ─── العربون ─────────────────────────────────────────────────────────────
  @IsOptional() @IsBoolean() depositEnabled?: boolean;
  @ValidateIf((o: UpdateServiceDto) => o.depositEnabled === true)
  @IsOptional() @IsNumber() @Min(0) depositAmount?: number;

  // ─── التكرار ─────────────────────────────────────────────────────────────
  @IsOptional() @IsBoolean() allowRecurring?: boolean;
  @IsOptional() @IsArray() @IsEnum(RecurringPatternDto, { each: true })
  allowedRecurringPatterns?: RecurringPatternDto[];
  @IsOptional() @IsInt() @Min(1) maxRecurrences?: number;

  // ─── الجلسات الجماعية ────────────────────────────────────────────────────
  @IsOptional() @IsInt() @Min(1) minParticipants?: number;
  @IsOptional() @IsInt() @Min(1) maxParticipants?: number;
  @IsOptional() @IsBoolean() reserveWithoutPayment?: boolean;
}
