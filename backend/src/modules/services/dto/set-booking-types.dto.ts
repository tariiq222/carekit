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
import { DurationOptionDto } from './set-duration-options.dto';

export class BookingTypeConfigDto {
  // walk_in is excluded: booking types on a service only cover bookable types
  @IsEnum(BookingType)
  bookingType!: BookingType;

  @IsInt()
  @Min(0)
  price!: number; // halalat

  @IsInt()
  @Min(5)
  @Max(480)
  duration!: number; // minutes

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DurationOptionDto)
  durationOptions?: DurationOptionDto[];
}

export class SetServiceBookingTypesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingTypeConfigDto)
  types!: BookingTypeConfigDto[];
}
