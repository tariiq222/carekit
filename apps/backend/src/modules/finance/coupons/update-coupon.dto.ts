import { IsString, IsIn, IsNumber, IsOptional, IsBoolean, IsInt, IsDateString, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCouponDto {
  @IsOptional() @IsString() descriptionAr?: string;
  @IsOptional() @IsString() descriptionEn?: string;
  @IsOptional() @Type(() => Number) @IsNumber() discountValue?: number;
  @IsOptional() @IsIn(['PERCENTAGE', 'FIXED']) discountType?: 'PERCENTAGE' | 'FIXED';
  @IsOptional() @Type(() => Number) @IsNumber() minOrderAmt?: number;
  @IsOptional() @Type(() => Number) @IsInt() maxUses?: number;
  @IsOptional() @Type(() => Number) @IsInt() maxUsesPerUser?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) serviceIds?: string[];
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
