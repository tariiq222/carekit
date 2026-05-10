import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { DEFAULT_RESERVED_SUBDOMAINS } from '../../../common/tenant/subdomain.utils';
import {
  SLUG_MAX_LEN,
  SLUG_MIN_LEN,
  SLUG_REGEX,
} from '../../../common/tenant/slug-generator.util';

@ValidatorConstraint({ name: 'NotReservedSubdomain', async: false })
class NotReservedSubdomainConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return !DEFAULT_RESERVED_SUBDOMAINS.has(value.toLowerCase());
  }
  defaultMessage(): string {
    return 'slug is reserved';
  }
}

export class CreateTenantDto {
  @ApiProperty({
    example: 'sawa-clinic',
    description:
      'Subdomain slug; 3–30 chars, lowercase, [a-z0-9-], no leading/trailing hyphen, not reserved',
  })
  @IsString()
  @Length(SLUG_MIN_LEN, SLUG_MAX_LEN, {
    message: `slug must be ${SLUG_MIN_LEN}–${SLUG_MAX_LEN} chars`,
  })
  @Matches(SLUG_REGEX, { message: 'slug must match subdomain regex' })
  @Validate(NotReservedSubdomainConstraint)
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

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'UUID of an existing active user to make owner. Mutually exclusive with ownerEmail.',
  })
  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @ApiPropertyOptional({
    description:
      'Full name of the new owner to create. Required when ownerEmail is provided and no existing user matches.',
    example: 'Ahmed Al-Zahrani',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  ownerName?: string;

  @ApiPropertyOptional({
    description:
      'Email of the owner. If an existing active user matches, they are linked; otherwise a new user is created.',
    example: 'ahmed@example.com',
  })
  @IsOptional()
  @IsEmail()
  ownerEmail?: string;

  @ApiPropertyOptional({
    description:
      'Phone number of the new owner. Required when creating a new user via ownerEmail.',
    example: '+966501234567',
  })
  @IsOptional()
  @IsString()
  ownerPhone?: string;

  @ApiPropertyOptional({
    description:
      'Password for the new owner. If omitted, a strong password is auto-generated and emailed.',
    example: 'SecurePass1',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[A-Z])(?=.*\d)/, {
    message: 'password must have at least one uppercase letter and one digit',
  })
  ownerPassword?: string;

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
}

export class ArchiveOrganizationDto {}
