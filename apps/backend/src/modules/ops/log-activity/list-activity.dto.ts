import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ActivityAction } from '@prisma/client';

export class ListActivityDto {
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @IsString() entity?: string;
  @IsOptional() @IsUUID() entityId?: string;
  @IsOptional() @IsEnum(ActivityAction) action?: ActivityAction;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number;
}
