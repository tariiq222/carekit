import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ProblemReportStatus } from '@prisma/client';

export class ListProblemReportsDto {
  @IsOptional() @IsEnum(ProblemReportStatus) status?: ProblemReportStatus;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number;
}
