import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ProblemReportStatusFilter {
  OPEN = 'open',
  IN_REVIEW = 'in_review',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

export class ProblemReportQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  page?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  perPage?: string;

  @IsOptional()
  @IsEnum(ProblemReportStatusFilter)
  status?: ProblemReportStatusFilter;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  patientId?: string;
}
