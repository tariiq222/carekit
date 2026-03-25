import { IsOptional, IsString, IsIn, IsInt, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CouponFilterDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @IsOptional()
  @IsIn(['active', 'inactive', 'expired'])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
