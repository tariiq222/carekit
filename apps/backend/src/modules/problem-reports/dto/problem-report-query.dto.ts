import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum ProblemReportStatusFilter {
  OPEN = 'open',
  IN_REVIEW = 'in_review',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

export class ProblemReportQueryDto {
  @ApiPropertyOptional({ description: 'Page number', example: '1' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  page?: string;

  @ApiPropertyOptional({ description: 'Items per page', example: '20' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  perPage?: string;

  @ApiPropertyOptional({ enum: ProblemReportStatusFilter, description: 'Filter by report status' })
  @IsOptional()
  @IsEnum(ProblemReportStatusFilter)
  status?: ProblemReportStatusFilter;

  @ApiPropertyOptional({ description: 'Filter by patient ID', format: 'uuid' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  patientId?: string;
}
