import { IsEnum, IsString, MinLength } from 'class-validator';
import { ProblemReportType } from '@prisma/client';

export class CreateProblemReportDto {
  @IsString() tenantId!: string;
  @IsString() reporterId!: string;
  @IsEnum(ProblemReportType) type!: ProblemReportType;
  @IsString() @MinLength(3) title!: string;
  @IsString() @MinLength(10) description!: string;
}
