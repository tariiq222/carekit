import { IsEnum, IsString, IsUUID, MinLength } from 'class-validator';
import { ProblemReportType } from '@prisma/client';

export class CreateProblemReportDto {
  @IsUUID() reporterId!: string;
  @IsEnum(ProblemReportType) type!: ProblemReportType;
  @IsString() @MinLength(3) title!: string;
  @IsString() @MinLength(10) description!: string;
}
