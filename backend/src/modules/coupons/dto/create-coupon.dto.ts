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
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[A-Z0-9_-]+$/i, {
    message: 'Code must contain only letters, numbers, hyphens, and underscores',
  })
  code: string;

  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @IsIn(['percentage', 'fixed'])
  discountType: string;

  @IsInt()
  @Min(1)
  discountValue: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsesPerUser?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceIds?: string[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
