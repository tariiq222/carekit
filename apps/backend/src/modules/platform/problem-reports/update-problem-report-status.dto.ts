import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ProblemReportStatus } from '@prisma/client';

export class UpdateProblemReportStatusDto {
  @IsEnum(ProblemReportStatus) status!: ProblemReportStatus;
  @IsOptional() @IsString() resolution?: string;
}
