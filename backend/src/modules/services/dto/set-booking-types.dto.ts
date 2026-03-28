import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { BookingType } from '@prisma/client';

export class DurationOptionInput {
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
}

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
  @Type(() => DurationOptionInput)
  durationOptions?: DurationOptionInput[];
}

export class SetServiceBookingTypesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingTypeConfigDto)
  types!: BookingTypeConfigDto[];
}
