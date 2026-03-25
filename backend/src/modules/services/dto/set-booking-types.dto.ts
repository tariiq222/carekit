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
  @IsEnum(['clinic_visit', 'phone_consultation', 'video_consultation'])
  bookingType!: string;

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
