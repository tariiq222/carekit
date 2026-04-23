import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOrgProfileDto {
  @ApiPropertyOptional({ description: 'Organization name in Arabic', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameAr?: string;

  @ApiPropertyOptional({ description: 'Organization name in English', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameEn?: string;

  @ApiPropertyOptional({
    description: 'URL-safe identifier (lowercase alphanum and hyphens only)',
    maxLength: 40,
    pattern: '^[a-z0-9][a-z0-9-]*$',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[a-z0-9][a-z0-9-]*$/, {
    message: 'slug must be lowercase alphanumeric with hyphens only',
  })
  slug?: string;

  @ApiPropertyOptional({ description: 'Organization tagline or description', maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  tagline?: string;
}