import { IsEnum, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ProblemReportStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto';

export class ListProblemReportsDto extends PaginationDto {
  @IsOptional() @IsEnum(ProblemReportStatus) status?: ProblemReportStatus;
}
