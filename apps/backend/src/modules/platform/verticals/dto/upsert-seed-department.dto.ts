import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertSeedDepartmentDto {
  @ApiProperty({ description: 'اسم القسم بالعربية', example: 'قسم الطوارئ' })
  @IsString()
  nameAr!: string;

  @ApiProperty({ description: 'Department name in English', example: 'Emergency Department' })
  @IsString()
  nameEn!: string;

  @ApiPropertyOptional({ description: 'Display sort order (ascending)', example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
