import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { BookingType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DurationOptionDto } from './set-duration-options.dto';

export class BookingTypeConfigDto {
  // walk_in is excluded: booking types on a service only cover bookable types
  @ApiProperty({ enum: BookingType, description: 'Booking type (walk_in excluded)' })
  @IsEnum(BookingType)
  bookingType!: BookingType;

  @ApiProperty({ description: 'Price in halalat', minimum: 0 })
  @IsInt()
  @Min(0)
  price!: number;

  @ApiProperty({ description: 'Duration in minutes', minimum: 5, maximum: 480 })
  @IsInt()
  @Min(5)
  @Max(480)
  duration!: number;

  @ApiPropertyOptional({ description: 'Whether this booking type is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    isArray: true,
    type: () => DurationOptionDto,
    description: 'Custom duration options for this booking type',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DurationOptionDto)
  durationOptions?: DurationOptionDto[];
}

export class SetServiceBookingTypesDto {
  @ApiProperty({
    isArray: true,
    type: () => BookingTypeConfigDto,
    description: 'Booking type configurations — replaces existing types',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingTypeConfigDto)
  types!: BookingTypeConfigDto[];
}
