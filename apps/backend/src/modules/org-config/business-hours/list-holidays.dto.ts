import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListHolidaysDto {
  @IsUUID() @Type(() => String) branchId!: string;
  @IsOptional() @IsInt() @Min(2000) @Max(3000) @Type(() => Number) year?: number;
}
