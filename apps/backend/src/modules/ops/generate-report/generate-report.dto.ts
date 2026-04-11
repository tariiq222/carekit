import { IsEnum, IsOptional, IsDateString, IsString } from 'class-validator';
import { ReportType, ReportFormat } from '@prisma/client';

export class GenerateReportDto {
  @IsString()
  tenantId!: string;

  @IsEnum(ReportType)
  type!: ReportType;

  @IsEnum(ReportFormat)
  @IsOptional()
  format?: ReportFormat;

  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsString()
  @IsOptional()
  branchId?: string;

  @IsString()
  @IsOptional()
  employeeId?: string;

  @IsString()
  @IsOptional()
  requestedBy?: string;
}
