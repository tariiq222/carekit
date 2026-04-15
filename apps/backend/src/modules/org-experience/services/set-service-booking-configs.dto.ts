import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// The dashboard uses 'in_person' / 'online' literals.
// We store them as-is in ServiceBookingConfig.bookingType (TEXT in DB via migration).
export type ServiceBookingTypeValue = 'in_person' | 'online';

export class BookingConfigInputDto {
  @IsIn(['in_person', 'online']) bookingType!: ServiceBookingTypeValue;
  @IsNumber() @Min(0) price!: number;
  @IsInt() @Min(1) durationMins!: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class SetServiceBookingConfigsDto {
  @IsArray() @ArrayNotEmpty()
  @ValidateNested({ each: true }) @Type(() => BookingConfigInputDto)
  types!: BookingConfigInputDto[];
}
