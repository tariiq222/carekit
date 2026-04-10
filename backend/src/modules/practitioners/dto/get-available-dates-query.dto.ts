import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export enum BookingTypeDateParam {
  in_person = 'in_person',
  online = 'online',
}

export class GetAvailableDatesQueryDto {
  @ApiProperty({ description: 'Month in YYYY-MM format (e.g. 2026-04)' })
  @IsString()
  @IsNotEmpty()
  month!: string;

  @ApiPropertyOptional({ description: 'Duration in minutes (overrides service-resolved duration)', minimum: 5, maximum: 240 })
  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  @IsInt()
  @Min(5)
  @Max(240)
  duration?: number;

  @ApiPropertyOptional({ format: 'uuid', description: 'Service ID — used with bookingType to resolve duration automatically' })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional({ enum: BookingTypeDateParam, description: 'Booking type — used with serviceId to resolve duration automatically' })
  @IsOptional()
  @IsEnum(BookingTypeDateParam)
  bookingType?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Branch ID' })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
