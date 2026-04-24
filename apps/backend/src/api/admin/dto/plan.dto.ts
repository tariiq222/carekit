import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const PLAN_SLUG_REGEX = /^[A-Z][A-Z0-9_]{1,31}$/;

export class CreatePlanDto {
  @ApiProperty({
    description: 'Uppercase letters, digits, underscores. 2–32 chars. Example: STARTER, TEAM_ANNUAL.',
    example: 'STARTER',
  })
  @IsString()
  @Matches(PLAN_SLUG_REGEX, {
    message: 'slug must be 2-32 uppercase letters/digits/underscores, starting with a letter',
  })
  slug!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nameAr!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nameEn!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  priceMonthly!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  priceAnnual!: number;

  @ApiPropertyOptional({ default: 'SAR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ description: 'Plan limits (see schema comment)' })
  @IsObject()
  limits!: Record<string, unknown>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string;
}

export class UpdatePlanDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) nameAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) nameEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) priceMonthly?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) priceAnnual?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() limits?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string;
}

export class DeletePlanDto {
  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string;
}
