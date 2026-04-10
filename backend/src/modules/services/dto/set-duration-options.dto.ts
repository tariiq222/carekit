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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DurationOptionDto {
  @ApiProperty({ description: 'Label for this duration option', example: '30 min' })
  @IsString()
  @MinLength(1)
  label!: string;

  @ApiPropertyOptional({ description: 'Label in Arabic' })
  @IsOptional()
  @IsString()
  labelAr?: string;

  @ApiProperty({ description: 'Duration in minutes', minimum: 5, maximum: 480 })
  @IsInt()
  @Min(5)
  @Max(480)
  durationMinutes!: number;

  @ApiProperty({ description: 'Price in halalat', minimum: 0 })
  @IsInt()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ description: 'Whether this is the default option' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: 'Display sort order', minimum: 0 })
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
  @ApiProperty({ format: 'uuid', description: 'ServiceBookingType ID this option belongs to' })
  @IsUUID()
  serviceBookingTypeId!: string;
}

export class SetDurationOptionsDto {
  @ApiProperty({
    isArray: true,
    type: () => DurationOptionDto,
    description: 'Duration options — replaces existing options',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DurationOptionDto)
  options!: DurationOptionDto[];
}
