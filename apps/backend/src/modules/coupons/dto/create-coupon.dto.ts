import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsIn,
  IsInt,
  IsArray,
  IsBoolean,
  IsDateString,
  MinLength,
  MaxLength,
  Matches,
  Min,
} from 'class-validator';

export class CreateCouponDto {
  @ApiProperty({ description: 'Unique coupon code (letters, numbers, hyphens, underscores)', example: 'SUMMER25', minLength: 3, maxLength: 20 })
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[A-Z0-9_-]+$/i, {
    message:
      'Code must contain only letters, numbers, hyphens, and underscores',
  })
  code: string;

  @ApiPropertyOptional({ description: 'Arabic description' })
  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @ApiPropertyOptional({ description: 'English description' })
  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @ApiProperty({ description: 'Discount type', enum: ['percentage', 'fixed'] })
  @IsIn(['percentage', 'fixed'])
  discountType: string;

  @ApiProperty({ description: 'Discount value — percentage (1-100) or fixed amount in halalat', minimum: 1 })
  @IsInt()
  @Min(1)
  discountValue: number;

  @ApiPropertyOptional({ description: 'Minimum booking amount in halalat to apply this coupon', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minAmount?: number;

  @ApiPropertyOptional({ description: 'Maximum total uses allowed', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @ApiPropertyOptional({ description: 'Maximum uses per user', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsesPerUser?: number;

  @ApiPropertyOptional({ description: 'Service IDs this coupon is restricted to', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceIds?: string[];

  @ApiPropertyOptional({ description: 'Expiry date (ISO 8601)', example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'Whether the coupon is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
