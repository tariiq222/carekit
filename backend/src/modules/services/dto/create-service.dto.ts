import { IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecurringPattern } from '@prisma/client';

export class CreateServiceDto {
  @ApiProperty({ description: 'Service name in English', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }: { value: string }) => value?.trim())
  nameEn!: string;

  @ApiProperty({ description: 'Service name in Arabic', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }: { value: string }) => value?.trim())
  nameAr!: string;

  @ApiPropertyOptional({ description: 'Service description in English', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descriptionEn?: string;

  @ApiPropertyOptional({ description: 'Service description in Arabic', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descriptionAr?: string;

  @ApiProperty({ description: 'Category UUID' })
  @IsUUID()
  @IsNotEmpty()
  categoryId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ minimum: 0, description: 'Price in halalat (smallest currency unit)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ minimum: 1, description: 'Duration in minutes', default: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hidePriceOnBooking?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hideDurationOnBooking?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'calendarColor must be a valid hex color' })
  calendarColor?: string;

  // ── Booking settings per service ───────────────────────────────
  @ApiPropertyOptional({ minimum: 0, maximum: 120, description: 'Buffer applied before and after appointment. 0 = use global setting.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  bufferMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  depositEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  depositPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowRecurring?: boolean;

  @ApiPropertyOptional({ enum: RecurringPattern, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(RecurringPattern, { each: true })
  allowedRecurringPatterns?: RecurringPattern[];

  @ApiPropertyOptional({ minimum: 1, maximum: 52 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(52)
  maxRecurrences?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxParticipants?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 1440 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  minLeadMinutes?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 365 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  maxAdvanceDays?: number;

  @ApiPropertyOptional({ type: [String], description: 'Practitioner UUIDs to link atomically on create' })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  practitionerIds?: string[];
}
