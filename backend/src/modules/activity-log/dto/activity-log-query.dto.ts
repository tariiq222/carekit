import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

export class ActivityLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by module (bookings, users, payments, etc.)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  module?: string;

  @ApiPropertyOptional({ description: 'Filter by action (created, updated, deleted, login, etc.)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  action?: string;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter from date (ISO string)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter to date (ISO string)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  dateTo?: string;
}
