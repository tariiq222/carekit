import {
  IsOptional,
  IsNumberString,
  IsString,
  IsIn,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SessionListQueryDto {
  @ApiPropertyOptional({ description: 'Page number', example: '1' })
  @IsOptional()
  @IsNumberString()
  page?: string;

  @ApiPropertyOptional({ description: 'Results per page', example: '20' })
  @IsOptional()
  @IsNumberString()
  perPage?: string;

  @ApiPropertyOptional({ description: 'Search by session content or user', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by handed-off status', enum: ['true', 'false'] })
  @IsOptional()
  @IsIn(['true', 'false'])
  handedOff?: string;

  @ApiPropertyOptional({ description: 'Start date filter in YYYY-MM-DD format', example: '2026-01-01' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'End date filter in YYYY-MM-DD format', example: '2026-12-31' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Filter by session language', enum: ['ar', 'en'] })
  @IsOptional()
  @IsIn(['ar', 'en'])
  language?: string;
}
