import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ProblemReportStatusFilter {
  OPEN = 'open',
  IN_REVIEW = 'in_review',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

export class ProblemReportQueryDto {
  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  perPage?: string;

  @IsOptional()
  @IsEnum(ProblemReportStatusFilter)
  status?: ProblemReportStatusFilter;

  @IsOptional()
  @IsString()
  patientId?: string;
}
