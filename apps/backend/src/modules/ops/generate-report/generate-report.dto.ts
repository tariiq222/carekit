import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ReportFormat, ReportType } from '@prisma/client';

export class GenerateReportDto {
  @IsEnum(ReportType) type!: ReportType;
  @IsOptional() @IsEnum(ReportFormat) format?: ReportFormat;
  @IsDateString() from!: string;
  @IsDateString() to!: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @IsString() requestedBy?: string;
}
