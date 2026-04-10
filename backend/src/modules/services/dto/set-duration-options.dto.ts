import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DurationOptionDto {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsOptional()
  @IsString()
  labelAr?: string;

  @IsInt()
  @Min(5)
  @Max(480)
  durationMinutes!: number;

  @IsInt()
  @Min(0)
  price!: number; // halalat

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  /**
   * Required: associates this option with a specific ServiceBookingType.
   * Duration options without a serviceBookingTypeId are unreachable by the
   * pricing fallback chain and are considered dead data (fix #6).
   * Prefer using PUT /:id/booking-types with embedded durationOptions instead.
   */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  serviceBookingTypeId!: string;
}

export class SetDurationOptionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DurationOptionDto)
  options!: DurationOptionDto[];
}
