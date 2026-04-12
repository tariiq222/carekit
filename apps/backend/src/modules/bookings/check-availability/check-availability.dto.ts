import { BookingType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class CheckAvailabilityDto {
  @IsUUID() employeeId!: string;
  @IsUUID() branchId!: string;
  @IsDateString() date!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) durationMins?: number;
  @IsOptional() @IsUUID() serviceId?: string;
  @IsOptional() @IsUUID() durationOptionId?: string;
  @IsOptional() @IsEnum(BookingType) bookingType?: BookingType;
}
