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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// The dashboard uses 'in_person' / 'online' literals.
// We store them as-is in ServiceBookingConfig.bookingType (TEXT in DB via migration).
export type ServiceBookingTypeValue = 'in_person' | 'online';

export class BookingConfigInputDto {
  @ApiProperty({ description: 'Booking delivery type', enum: ['in_person', 'online'], example: 'in_person' })
  @IsIn(['in_person', 'online']) bookingType!: ServiceBookingTypeValue;

  @ApiProperty({ description: 'Price for this booking type', example: 50 })
  @IsNumber() @Min(0) price!: number;

  @ApiProperty({ description: 'Duration in minutes for this booking type', example: 30 })
  @IsInt() @Min(1) durationMins!: number;

  @ApiPropertyOptional({ description: 'Whether this config is active', example: true })
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class SetServiceBookingConfigsDto {
  @ApiProperty({ description: 'Booking type configurations (must include at least one)', type: [BookingConfigInputDto] })
  @IsArray() @ArrayNotEmpty()
  @ValidateNested({ each: true }) @Type(() => BookingConfigInputDto)
  types!: BookingConfigInputDto[];
}
