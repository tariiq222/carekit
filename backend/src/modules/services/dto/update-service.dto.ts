import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUrl, IsUUID, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RecurringPattern } from '@prisma/client';

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }: { value: string }) => value?.trim())
  nameEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }: { value: string }) => value?.trim())
  nameAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descriptionEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descriptionAr?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

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

  @ApiPropertyOptional({ description: 'HugeIcon name, e.g. StethoscopeIcon' })
  @IsOptional()
  @ValidateIf((o: UpdateServiceDto) => o.iconName !== null && o.iconName !== undefined)
  @IsString()
  @MaxLength(100)
  iconName?: string | null;

  @ApiPropertyOptional({ description: 'Background color for icon, e.g. #354FD8' })
  @IsOptional()
  @ValidateIf((o: UpdateServiceDto) => o.iconBgColor !== null && o.iconBgColor !== undefined)
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'iconBgColor must be a valid hex color' })
  iconBgColor?: string | null;

  @ApiPropertyOptional({ description: 'MinIO image URL — takes priority over icon' })
  @IsOptional()
  @ValidateIf((o: UpdateServiceDto) => o.imageUrl !== null && o.imageUrl !== undefined)
  @IsUrl()
  imageUrl?: string | null;

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
  @ValidateIf((o: UpdateServiceDto) => o.minLeadMinutes !== null)
  @IsInt()
  @Min(0)
  @Max(1440)
  minLeadMinutes?: number | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 365 })
  @IsOptional()
  @ValidateIf((o: UpdateServiceDto) => o.maxAdvanceDays !== null)
  @IsInt()
  @Min(1)
  @Max(365)
  maxAdvanceDays?: number | null;
}
