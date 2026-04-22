import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TemplateFamily } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateVerticalDto {
  @ApiProperty({ description: 'kebab-case unique slug' })
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: 'slug must be kebab-case' })
  @MaxLength(60)
  slug!: string;

  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) nameAr!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) nameEn!: string;

  @ApiProperty({ enum: TemplateFamily })
  @IsEnum(TemplateFamily)
  templateFamily!: TemplateFamily;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) descriptionAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) descriptionEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl() iconUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string;
}

export class UpdateVerticalDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) nameAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) nameEn?: string;

  @ApiPropertyOptional({ enum: TemplateFamily })
  @IsOptional()
  @IsEnum(TemplateFamily)
  templateFamily?: TemplateFamily;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) descriptionAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) descriptionEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl() iconUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string;
}

export class DeleteVerticalDto {
  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string;
}
