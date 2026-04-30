import { TemplateFamily } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUrl, Matches, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVerticalDto {
  @ApiProperty({ description: 'URL-safe slug for the vertical', example: 'medical-general' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must contain only lowercase letters, digits, and hyphens' })
  slug!: string;

  @ApiProperty({ description: 'اسم التخصص بالعربية', example: 'طب عام' })
  @IsString()
  nameAr!: string;

  @ApiProperty({ description: 'Vertical name in English', example: 'General Medicine' })
  @IsString()
  nameEn!: string;

  @ApiProperty({ description: 'Template family that drives the seed data', enum: TemplateFamily, example: TemplateFamily.MEDICAL })
  @IsEnum(TemplateFamily)
  templateFamily!: TemplateFamily;

  @ApiPropertyOptional({ description: 'وصف التخصص بالعربية', example: 'عيادات الطب العام والرعاية الأولية' })
  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @ApiPropertyOptional({ description: 'Vertical description in English', example: 'General medicine and primary care clinics' })
  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @ApiPropertyOptional({ description: 'URL for the vertical icon image', example: 'https://cdn.deqah.app/icons/medical.svg' })
  @IsOptional()
  @IsUrl()
  iconUrl?: string;

  @ApiPropertyOptional({ description: 'Display sort order (ascending)', example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Whether this vertical is active in the catalog', example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
