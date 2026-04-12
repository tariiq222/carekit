import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ActivityAction } from '@prisma/client';
import { PaginationDto } from '../../../common/dto';

export class ListActivityDto extends PaginationDto {
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @IsString() entity?: string;
  @IsOptional() @IsUUID() entityId?: string;
  @IsOptional() @IsEnum(ActivityAction) action?: ActivityAction;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
