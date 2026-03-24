import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

export class ActivityLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by module (bookings, users, payments, etc.)' })
  @IsOptional()
  @IsString()
  module?: string;

  @ApiPropertyOptional({ description: 'Filter by action (created, updated, deleted, login, etc.)' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter from date (ISO string)' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter to date (ISO string)' })
  @IsOptional()
  @IsString()
  dateTo?: string;
}
