import { BookingStatus, BookingType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto';

export class ListBookingsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by client', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() clientId?: string;

  @ApiPropertyOptional({ description: 'Filter by employee', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() employeeId?: string;

  @ApiPropertyOptional({ description: 'Filter by branch', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() branchId?: string;

  @ApiPropertyOptional({ description: 'Filter by service', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() serviceId?: string;

  @ApiPropertyOptional({ description: 'Filter by booking status', enum: BookingStatus, enumName: 'BookingStatus', example: BookingStatus.CONFIRMED })
  @IsOptional() @IsEnum(BookingStatus) status?: BookingStatus;

  @ApiPropertyOptional({ description: 'Filter by booking type', enum: BookingType, enumName: 'BookingType', example: BookingType.INDIVIDUAL })
  @IsOptional() @IsEnum(BookingType) bookingType?: BookingType;

  @ApiPropertyOptional({ description: 'Return bookings on or after this date (ISO 8601)', example: '2026-05-01T00:00:00.000Z' })
  @IsOptional() @IsDateString() fromDate?: string;

  @ApiPropertyOptional({ description: 'Return bookings on or before this date (ISO 8601)', example: '2026-05-31T23:59:59.000Z' })
  @IsOptional() @IsDateString() toDate?: string;
}
