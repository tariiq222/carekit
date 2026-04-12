import { IsOptional, IsString, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ListCouponsDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(['active', 'inactive', 'expired']) status?: 'active' | 'inactive' | 'expired';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
