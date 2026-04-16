import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RecurringPatternDto {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
}

export class CreateServiceDto {
  // ─── الأساسيات ───────────────────────────────────────────────────────────
  @ApiProperty({ example: 'قص الشعر' })
  @IsString() @MaxLength(200) nameAr!: string;

  @ApiPropertyOptional({ example: 'Haircut' })
  @IsOptional() @IsString() @MaxLength(200) nameEn?: string;

  @ApiPropertyOptional({ description: 'Service description in Arabic' }) @IsOptional() @IsString() descriptionAr?: string;
  @ApiPropertyOptional({ description: 'Service description in English' }) @IsOptional() @IsString() descriptionEn?: string;

  @ApiProperty({ example: 30, description: 'Duration in minutes' })
  @IsInt() @Min(1) durationMins!: number;

  @ApiProperty({ example: 50 })
  @IsNumber() @Min(0) price!: number;

  @ApiPropertyOptional({ example: 'SAR', default: 'SAR' })
  @IsOptional() @IsString() @MaxLength(8) currency?: string;

  @ApiPropertyOptional({ description: 'Service image URL', example: 'https://example.com/logo.png' }) @IsOptional() @IsString() imageUrl?: string;
  @ApiPropertyOptional({ description: 'Category UUID', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' }) @IsOptional() @IsUUID() categoryId?: string;

  // ─── العرض/الإخفاء ───────────────────────────────────────────────────────
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() isHidden?: boolean;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() hidePriceOnBooking?: boolean;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() hideDurationOnBooking?: boolean;

  // ─── الهوية البصرية ───────────────────────────────────────────────────────
  @ApiPropertyOptional({ example: 'scissors-01' }) @IsOptional() @IsString() @MaxLength(50) iconName?: string;
  @ApiPropertyOptional({ example: '#F0F4FF' }) @IsOptional() @IsString() @MaxLength(20) iconBgColor?: string;

  // ─── قواعد الجدولة ───────────────────────────────────────────────────────
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() @Min(0) bufferMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) minLeadMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) maxAdvanceDays?: number;

  // ─── العربون ─────────────────────────────────────────────────────────────
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() depositEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Fixed deposit amount — must not exceed price' })
  @ValidateIf((o: CreateServiceDto) => o.depositEnabled === true)
  @IsNumber() @Min(0) depositAmount?: number;

  // ─── التكرار ─────────────────────────────────────────────────────────────
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() allowRecurring?: boolean;

  @ApiPropertyOptional({ enum: RecurringPatternDto, isArray: true })
  @IsOptional() @IsArray() @IsEnum(RecurringPatternDto, { each: true })
  allowedRecurringPatterns?: RecurringPatternDto[];

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) maxRecurrences?: number;

  // ─── الجلسات الجماعية ────────────────────────────────────────────────────
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1) minParticipants?: number;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1) maxParticipants?: number;

  @ApiPropertyOptional({ description: 'Defer payment until minParticipants is reached. Requires maxParticipants > 1' })
  @ValidateIf((o: CreateServiceDto) => o.maxParticipants !== undefined && o.maxParticipants > 1)
  @IsOptional() @IsBoolean() reserveWithoutPayment?: boolean;
}
