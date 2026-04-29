import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const TENANT_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateTenantDto {
  @ApiProperty({ description: 'Lowercase kebab-case tenant slug', example: 'riyadh-clinic' })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(TENANT_SLUG_REGEX, { message: 'slug must be lowercase kebab-case' })
  slug!: string;

  @ApiProperty({ minLength: 2, maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nameAr!: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nameEn?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ownerUserId!: string;

  @ApiPropertyOptional({ description: 'Active vertical slug to seed into the tenant' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  verticalSlug?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  planId?: string;

  @ApiPropertyOptional({ enum: ['MONTHLY', 'ANNUAL'], default: 'MONTHLY' })
  @IsOptional()
  @IsIn(['MONTHLY', 'ANNUAL'])
  billingCycle?: 'MONTHLY' | 'ANNUAL';

  @ApiPropertyOptional({ minimum: 0, maximum: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(90)
  trialDays?: number;

  @ApiProperty({ minLength: 10, maxLength: 500 })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nameAr?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nameEn?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  verticalSlug?: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  trialEndsAt?: Date | null;

  @ApiProperty({ minLength: 10, maxLength: 500 })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}

export class ArchiveOrganizationDto {
  @ApiProperty({ minLength: 10, maxLength: 500 })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}
