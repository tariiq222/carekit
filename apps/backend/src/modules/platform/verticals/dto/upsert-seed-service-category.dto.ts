import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertSeedServiceCategoryDto {
  @ApiProperty({ description: 'اسم الفئة بالعربية', example: 'خدمات الطوارئ' })
  @IsString()
  nameAr!: string;

  @ApiProperty({ description: 'Service category name in English', example: 'Emergency Services' })
  @IsString()
  nameEn!: string;

  @ApiPropertyOptional({ description: 'UUID of the parent seed department', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Display sort order (ascending)', example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
